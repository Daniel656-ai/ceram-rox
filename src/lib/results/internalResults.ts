import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";

/**
 * Interne/technische Einträge in den gespeicherten Ergebnissen.
 *
 * Reine Anzeigeregel – an den gespeicherten Daten wird nichts verändert.
 * Solche Einträge sind keine Messwerte und gehören nicht in die Wertetabelle:
 *  - Importprotokoll des Messdatenimports (JSON mit `imported_at`)
 *  - reine Konfigurations-/Metadatenobjekte (alle Schlüssel mit `__`-Präfix,
 *    z. B. `__curve_config`, `__case_elements`)
 */

export interface ImportProtocol {
  importedAt: string | null;
  profile: string | null;
  sample: string | null;
  source: string | null;
  count: number | null;
  hasCurves: boolean;
  rawDatasetId: string | null;
  assignedKeys: string[];
  unassignedCount: number;
  metadata: Array<{ label: string; value: string }>;
}

export type InternalKind = "import" | "config";

function parseJson(text: string | null | undefined): unknown {
  if (typeof text !== "string") return undefined;
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Erkennt interne Einträge ausschließlich an Inhalt/Namen, nie am Status. */
export function classifyInternalResult(
  r: Pick<SampleResultValue, "value" | "remarks" | "result_name" | "display_label">,
): InternalKind | null {
  if (r.value !== null && r.value !== undefined) return null;
  const parsed = parseJson(r.remarks);
  if (isPlainObject(parsed)) {
    if (typeof parsed.imported_at === "string" && ("profile" in parsed || "keys" in parsed || "count" in parsed)) {
      return "import";
    }
    const keys = Object.keys(parsed);
    if (keys.length > 0 && keys.every((k) => k.startsWith("__"))) return "config";
  }
  return null;
}

export const isInternalResult = (
  r: Pick<SampleResultValue, "value" | "remarks" | "result_name" | "display_label">,
): boolean => classifyInternalResult(r) !== null;

/** Liest ein Importprotokoll tolerant (fehlende Felder sind erlaubt). */
export function parseImportProtocol(remarks: string | null | undefined): ImportProtocol | null {
  const p = parseJson(remarks);
  if (!isPlainObject(p) || typeof p.imported_at !== "string") return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const metadata = Array.isArray(p.metadata)
    ? p.metadata
        .filter(isPlainObject)
        .map((m) => ({ label: String(m.label ?? ""), value: String(m.value ?? "") }))
        .filter((m) => m.label || m.value)
    : [];
  return {
    importedAt: str(p.imported_at),
    profile: str(p.profile),
    sample: str(p.sample),
    source: str(p.source),
    count: typeof p.count === "number" ? p.count : null,
    hasCurves: p.has_curves === true,
    rawDatasetId: str(p.raw_dataset_id),
    assignedKeys: Array.isArray(p.keys) ? p.keys.map(String) : [],
    unassignedCount: Array.isArray(p.unassigned) ? p.unassigned.length : 0,
    metadata,
  };
}

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
      else visible.push(r);
    } else if (kind === "config") hiddenOther.push(r);
    else visible.push(r);
  }
  return { visible, protocols, hiddenOther };
}
