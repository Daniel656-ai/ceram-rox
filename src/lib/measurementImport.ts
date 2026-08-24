/**
 * Generischer Messdaten-Import (Copy & Paste aus externer Messsoftware).
 *
 * Bewusst geräte-unabhängig: die Erkennung basiert ausschließlich auf der
 * Struktur des eingefügten Textes. Gerätespezifisches Wissen (Parameternamen,
 * Zielfelder, Einheiten) steckt ausschließlich im Importprofil.
 */
import type { ImportMapping, MeasurementImportProfile } from "@/lib/api/measurementImportProfiles";
import { canonicalParameter, splitNameUnit } from "@/lib/measurementClassification";

export type DecimalSeparator = "auto" | "," | ".";

export interface ParsedReading {
  /** Parametername exakt wie geliefert. */
  sourceName: string;
  /** Rohwert wie geliefert (inkl. Einheit / "<0,01"). */
  raw: string;
  /** Numerischer Wert, null wenn nicht interpretierbar. */
  value: number | null;
  /** Aus dem Rohwert erkannte Einheit (falls vorhanden). */
  unit: string | null;
  /** true bei Werten wie "<0,01" oder "n.b." */
  belowDetection: boolean;
}

export interface ParsedSample {
  /** Spalten-/Zeilenbezeichnung der Probe (leer bei Einzelmessung). */
  label: string;
  readings: ParsedReading[];
}

export interface ParseResult {
  samples: ParsedSample[];
  /** Erkanntes Format (nur informativ für die UI). */
  detectedFormat: "key_value" | "table_params_in_rows" | "table_params_in_columns" | "empty";
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Normalisierung & Zahlen                                             */
/* ------------------------------------------------------------------ */

const SUB = "₀₁₂₃₄₅₆₇₈₉";

/** Vergleichsform eines Parameternamens: SiO₂ / SiO 2 / sio2 -> "sio2". */
export function normalizeName(s: string): string {
  return String(s ?? "")
    .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String("⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

const NON_NUMERIC_MARKERS = ["n.b.", "nb", "n/a", "na", "-", "--", "n.n."];

/** Zahl aus einem Rohwert lesen – tolerant gegenüber DE/EN-Format und Einheiten. */
export function parseValue(raw: string, sep: DecimalSeparator = "auto"): { value: number | null; unit: string | null; belowDetection: boolean } {
  const s = String(raw ?? "").trim();
  if (!s) return { value: null, unit: null, belowDetection: false };
  if (NON_NUMERIC_MARKERS.includes(s.toLowerCase())) return { value: null, unit: null, belowDetection: true };

  const below = /^[<>]/.test(s);
  const cleaned = s.replace(/^[<>≈~]\s*/, "").replace(/\s/g, "");
  const m = cleaned.match(/^[+-]?[\d.,]+(?:[eE][+-]?\d+)?/);
  if (!m) return { value: null, unit: null, belowDetection: below };

  let num = m[0];
  const unit = cleaned.slice(m[0].length).replace(/^[*]+/, "").trim() || null;

  const hasComma = num.includes(",");
  const hasDot = num.includes(".");
  let decimal: "," | "." | null = null;
  if (sep !== "auto") decimal = sep;
  else if (hasComma && hasDot) decimal = num.lastIndexOf(",") > num.lastIndexOf(".") ? "," : ".";
  else if (hasComma) decimal = ",";
  else decimal = ".";

  if (decimal === ",") num = num.replace(/\./g, "").replace(",", ".");
  else num = num.replace(/,/g, "");

  const v = Number(num);
  return { value: Number.isFinite(v) ? v : null, unit, belowDetection: below };
}

const looksNumeric = (s: string) => parseValue(s).value != null;

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function splitCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((c) => c.trim());
  // Komma nur als Spaltentrenner werten, wenn es sich sicher nicht um ein
  // deutsches Dezimalkomma handelt (mehr als zwei Felder).
  if (line.includes(",")) {
    const parts = line.split(",").map((c) => c.trim());
    if (parts.length > 2 && parts.filter((p) => looksNumeric(p)).length !== parts.length - 1) return parts;
  }
  return [line.trim()];
}

function keyValueLine(line: string): [string, string] | null {
  const m = line.match(/^(.+?)\s*[:=]\s*(.+)$/);
  if (m) return [m[1].trim(), m[2].trim()];
  if (line.includes("\t") || line.includes(";")) {
    const cells = splitCells(line);
    if (cells.length === 2) return [cells[0], cells[1]];
  }
  // "Fe2O3 <0,01" / "D50 12,5 µm" – Wert steht am Zeilenende.
  const tail = line.trim().match(/^(.*?\S)\s+([<>≈~]?\s*[+-]?[\d.,]+(?:[eE][+-]?\d+)?\s*\S*)$/);
  if (tail && !looksNumeric(tail[1])) return [tail[1], tail[2]];
  const cells = splitCells(line);
  if (cells.length === 2) return [cells[0], cells[1]];
  return null;
}

function makeReading(name: string, raw: string, sep: DecimalSeparator): ParsedReading {
  const { value, unit, belowDetection } = parseValue(raw, sep);
  return { sourceName: name.trim(), raw: String(raw ?? "").trim(), value, unit, belowDetection };
}

/**
 * Erkennt Key-Value-Listen, Tabellen mit Parametern in Zeilen (mehrere
 * Proben-Spalten) und Tabellen mit Parametern in Spalten (eine Zeile je Probe).
 */
export function parseMeasurementText(
  text: string,
  opts: { format?: MeasurementImportProfile["format"]; decimalSeparator?: DecimalSeparator; knownNames?: string[] } = {}
): ParseResult {
  const sep = (opts.decimalSeparator ?? "auto") as DecimalSeparator;
  const known = new Set((opts.knownNames ?? []).map(normalizeName));
  const warnings: string[] = [];
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { samples: [], detectedFormat: "empty", warnings: ["Kein Inhalt eingefügt."] };

  const rows = lines.map(splitCells);
  const maxCells = Math.max(...rows.map((r) => r.length));
  const forced = opts.format && opts.format !== "auto" ? opts.format : null;

  // --- Key/Value ---
  if (forced === "key_value" || (!forced && maxCells <= 2)) {
    const readings: ParsedReading[] = [];
    for (const line of lines) {
      const kv = keyValueLine(line);
      if (!kv) { warnings.push(`Zeile ignoriert: „${line}“`); continue; }
      readings.push(makeReading(kv[0], kv[1], sep));
    }
    return { samples: [{ label: "", readings }], detectedFormat: "key_value", warnings };
  }

  // --- Tabelle ---
  const header = rows[0];
  const body = rows.slice(1);
  if (body.length === 0) return { samples: [], detectedFormat: "empty", warnings: ["Tabelle ohne Datenzeilen."] };

  const headerMatches = header.slice(1).filter((h) => known.has(normalizeName(h))).length;
  const firstColMatches = body.filter((r) => known.has(normalizeName(r[0] ?? ""))).length;

  let paramsInRows: boolean;
  if (forced) paramsInRows = forced === "table_params_in_rows";
  else if (headerMatches > firstColMatches) paramsInRows = false;
  else paramsInRows = true;

  if (paramsInRows) {
    // Zeile = Parameter, Spalten 1..n = Proben
    const sampleLabels = header.slice(1).map((h, i) => h || `Probe ${i + 1}`);
    const samples: ParsedSample[] = sampleLabels.map((label) => ({ label, readings: [] }));
    for (const r of body) {
      const name = r[0];
      if (!name) continue;
      for (let i = 0; i < samples.length; i++) {
        const raw = r[i + 1];
        if (raw === undefined || raw === "") continue;
        samples[i].readings.push(makeReading(name, raw, sep));
      }
    }
    if (samples.length === 0) warnings.push("Keine Proben-Spalten erkannt.");
    return { samples, detectedFormat: "table_params_in_rows", warnings };
  }

  // Spalte = Parameter, Zeile = Probe
  const paramNames = header.slice(1);
  const samples: ParsedSample[] = body.map((r, idx) => ({
    label: r[0] || `Probe ${idx + 1}`,
    readings: paramNames
      .map((n, i) => ({ n, raw: r[i + 1] }))
      .filter((x) => x.n && x.raw !== undefined && x.raw !== "")
      .map((x) => makeReading(x.n, x.raw as string, sep)),
  }));
  return { samples, detectedFormat: "table_params_in_columns", warnings };
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

export interface TargetCandidate {
  field_key: string;
  display_name: string;
  unit?: string | null;
  field_type?: string;
}

export interface MappedRow extends ParsedReading {
  /** Zielfeld-Key oder null (= wird nicht übernommen). */
  targetFieldKey: string | null;
  /** Woher die Zuordnung stammt. */
  origin: "profile" | "auto" | "manual" | "none";
  targetUnit?: string | null;
  factor?: number | null;
  unitMismatch?: boolean;
}

export function allSourceNames(profile: MeasurementImportProfile | null | undefined): string[] {
  return (profile?.mappings ?? []).flatMap((m) => m.source_names ?? []);
}

function findMapping(name: string, mappings: ImportMapping[]): ImportMapping | null {
  const n = canonicalParameter(name);
  return mappings.find((m) => (m.source_names ?? []).some((s) => canonicalParameter(s) === n)) ?? null;
}

/** Ordnet gelesene Werte den Formularfeldern zu (Profil zuerst, dann Namensähnlichkeit). */
export function mapReadings(
  readings: ParsedReading[],
  profile: MeasurementImportProfile | null | undefined,
  targets: TargetCandidate[]
): MappedRow[] {
  const mappings = profile?.mappings ?? [];
  const byKey = new Map(targets.map((t) => [t.field_key, t]));
  // Kanonischer Abgleich: Einheiten im Namen ("As (PPM)"), Groß-/Kleinschreibung
  // und bekannte Aliasnamen ("Arsenic") dürfen die Zuordnung nicht verhindern.
  const canon = new Map<string, TargetCandidate>();
  for (const t of targets) {
    for (const cand of [t.field_key, t.display_name]) {
      const c = canonicalParameter(cand);
      if (c && !canon.has(c)) canon.set(c, t);
    }
  }

  return readings.map((r) => {
    const m = findMapping(r.sourceName, mappings);
    let targetFieldKey: string | null = null;
    let origin: MappedRow["origin"] = "none";
    let factor: number | null = null;

    if (m && byKey.has(m.target_field_key)) {
      targetFieldKey = m.target_field_key;
      origin = "profile";
      factor = m.factor ?? null;
    } else {
      const t = canon.get(canonicalParameter(r.sourceName));
      if (t) { targetFieldKey = t.field_key; origin = "auto"; }
    }

    const target = targetFieldKey ? byKey.get(targetFieldKey) : undefined;
    const targetUnit = target?.unit ?? m?.unit ?? null;
    // Einheit kann im Namen stecken ("As (PPM)") – Parametername bleibt sauber.
    const unit = r.unit ?? splitNameUnit(r.sourceName).unit ?? null;
    const unitMismatch = !!(unit && targetUnit && normalizeName(unit) !== normalizeName(targetUnit));
    return { ...r, unit, targetFieldKey, origin, targetUnit, factor, unitMismatch };
  });
}

/** Wert, der tatsächlich in das Formularfeld geschrieben wird. */
export function outputValue(row: MappedRow): number | string | null {
  // Werte unterhalb der Nachweisgrenze werden als Rohtext übernommen ("<0,01"),
  // damit die fachliche Aussage erhalten bleibt.
  if (row.belowDetection) return row.raw || null;
  if (row.value == null) return null;
  const f = row.factor;
  return typeof f === "number" && Number.isFinite(f) && f !== 0 ? row.value * f : row.value;
}
