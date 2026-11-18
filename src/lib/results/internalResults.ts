import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";
import { parseImportProtocol, type ImportProtocol } from "@/lib/results/importProtocol";
import {
  analyzeStructured,
  humanizeKey,
  labelFromPath,
  leafKey,
  parseStructuredText,
} from "@/lib/results/structuredValues";

export { parseImportProtocol };
export type { ImportProtocol };

/**
 * Interne/technische Einträge und strukturierte Werte in den gespeicherten Ergebnissen.
 *
 * Reine Anzeigeregel – an den gespeicherten Daten wird nichts verändert.
 *  - Importprotokoll des Messdatenimports (JSON mit `imported_at`) -> kurze Importinfo
 *  - reine Konfigurations-/Metadatenobjekte (alle Schlüssel mit `__`-Präfix, z. B. `__curve_config`)
 *    sowie Blöcke, die nur Einstellungen/Schalter enthalten -> nicht als Messwert, nur unter „Details“
 *  - Blöcke ohne jeden Wert (alles null/leer) -> keine Zeile
 *  - Blöcke mit echten Werten -> einzelne Zeilen (siehe structuredValues.ts)
 */

export type InternalKind = "import" | "config" | "empty";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type Classifiable = Pick<SampleResultValue, "value" | "remarks" | "result_name" | "display_label">;

/** Erkennt interne bzw. wertlose strukturierte Einträge ausschließlich an Inhalt/Namen, nie am Status. */
export function classifyInternalResult(r: Classifiable): InternalKind | null {
  if (r.value !== null && r.value !== undefined) return null;
  const parsed = parseStructuredText(r.remarks);
  if (parsed === undefined) return null;
  if (isPlainObject(parsed)) {
    if (typeof parsed.imported_at === "string" && ("profile" in parsed || "keys" in parsed || "count" in parsed)) {
      return "import";
    }
    const keys = Object.keys(parsed);
    if (keys.length > 0 && keys.every((k) => k.startsWith("__"))) return "config";
  }
  const a = analyzeStructured(parsed);
  if (a.values.length > 0) return null;
  if (a.config.length > 0) return "config";
  if (a.protocols.length > 0) return "import";
  return "empty";
}

export const isInternalResult = (r: Classifiable): boolean => classifyInternalResult(r) !== null;

/** Trennt echte Messwerte von internen Einträgen (nichts geht verloren). */
export function splitInternalResults<T extends SampleResultValue>(
  results: T[],
): { visible: T[]; protocols: ImportProtocol[]; hiddenOther: T[] } {
  const visible: T[] = [];
  const protocols: ImportProtocol[] = [];
  const hiddenOther: T[] = [];
  for (const r of results) {
    const kind = classifyInternalResult(r);
    if (kind === "import") {
      const p = parseImportProtocol(r.remarks);
      if (p) protocols.push(p);
      else {
        const found = analyzeStructured(parseStructuredText(r.remarks)).protocols;
        if (found.length) protocols.push(...found);
        else visible.push(r);
      }
    } else if (kind === "config" || kind === "empty") hiddenOther.push(r);
    else visible.push(r);
  }
  return { visible, protocols, hiddenOther };
}

/* ------------------------------------------------------------------ */
/* Strukturierte Werte -> einzelne Zeilen                              */
/* ------------------------------------------------------------------ */

/** Anzeigewert; `derived` = aus einem Block abgeleitet (kein eigener Datensatz). */
export type DisplayResultValue = SampleResultValue & { derived?: boolean };

/** Einstellung/Schalter für den Bereich „Details“. */
export interface DetailItem {
  label: string;
  value: string;
  /** Durchlauf/Eintrag, zu dem die Einstellung gehört. */
  group: string | null;
}

const toDisplayNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(",", "."));
  return null;
};

const detailValue = (v: string | number | boolean): string =>
  typeof v === "boolean" ? (v ? "ja" : "nein") : String(v);

/**
 * Zerlegt einen strukturierten Datensatz (JSON-Objekt/-Liste in `remarks`, kein Zahlenwert):
 *  - echte Werte -> Zeilen (leere Werte entfallen; Einheit aus dem Importprotokoll, falls vorhanden)
 *  - Einstellungen/Schalter -> `details`
 *  - Importprotokolle -> `protocols`
 * Werte, die bereits als eigener Datensatz derselben Messung vorliegen (gleicher Durchlauf,
 * gleicher Feldschlüssel), werden nicht doppelt gezeigt.
 */
export function expandStructuredResult(
  r: SampleResultValue,
  siblings: SampleResultValue[],
): { rows: DisplayResultValue[]; protocols: ImportProtocol[]; details: DetailItem[] } | null {
  if (r.value !== null && r.value !== undefined) return null;
  const parsed = parseStructuredText(r.remarks);
  if (parsed === undefined) return null;
  const a = analyzeStructured(parsed);

  const rows: DisplayResultValue[] = [];
  for (const leaf of a.values) {
    const key = leafKey(leaf.path);
    const exists = siblings.some(
      (s) =>
        s.id !== r.id &&
        (s.instance_key ?? null) === leaf.entryId &&
        (s.result_name.endsWith(`.${key}`) || s.result_name.endsWith(`:${key}`)),
    );
    if (exists) continue;
    const num = toDisplayNumber(leaf.value);
    const name = leaf.path.join(".");
    rows.push({
      ...r,
      id: `${r.id}::${leaf.entryId ?? "0"}::${name}`,
      result_name: name,
      display_label: labelFromPath(leaf.path),
      value: num,
      unit: a.units[key] ?? null,
      remarks: num === null ? String(leaf.value) : null,
      instance_key: leaf.entryId,
      instance_label: leaf.entryLabel,
      derived: true,
    });
  }
  const details: DetailItem[] = a.config.map((leaf) => ({
    label: leaf.path.map(humanizeKey).join(" · "),
    value: detailValue(leaf.value),
    group: leaf.entryLabel,
  }));
  return { rows, protocols: a.protocols, details };
}

/** Anzeigeaufbereitung der Wertetabelle: nie roher Text/JSON, leere Blöcke entfallen. */
export function prepareDisplayResults(results: SampleResultValue[]): {
  visible: DisplayResultValue[];
  protocols: ImportProtocol[];
  /** Einstellungen/Schalter (nur unter „Details“). */
  details: DetailItem[];
  /** Anzahl strukturierter Datensätze ohne jeden Wert (komplett leer). */
  emptyBlocks: number;
} {
  const base = splitInternalResults(results);
  const visible: DisplayResultValue[] = [];
  const protocols = [...base.protocols];
  const details: DetailItem[] = [];
  let emptyBlocks = 0;
  for (const r of base.visible) {
    const expanded = expandStructuredResult(r, results);
    if (expanded) {
      visible.push(...expanded.rows);
      protocols.push(...expanded.protocols);
      details.push(...expanded.details);
    } else visible.push(r);
  }
  for (const r of base.hiddenOther) {
    const expanded = expandStructuredResult(r, results);
    if (expanded && expanded.details.length) details.push(...expanded.details);
    else emptyBlocks += 1;
  }
  return { visible, protocols, details, emptyBlocks };
}
