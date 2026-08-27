/**
 * Registry aller Datei-Importer für Messgeräte.
 *
 * Die Registry ist bewusst offen: neue Geräte werden hier ergänzt und stehen
 * damit automatisch im bestehenden Messdatenimport der Formulare zur Verfügung.
 */
import type { FileImporter, ImportedMeasurement, ImportedResult } from "./types";
import { gasSorptionImporter } from "./gasSorption";
import { netzschImporter } from "./netzsch";
import { geometryImporter } from "./geometry";
import { normalizeName, type MappedRow, type TargetCandidate } from "@/lib/measurementImport";
import { mapReadings } from "@/lib/measurementImport";
import type { MeasurementImportProfile } from "@/lib/api/measurementImportProfiles";

export * from "./types";
export { GAS_SORPTION_PARSER_VERSION, GAS_SORPTION_IMPORTER_ID } from "./gasSorption";
export { NETZSCH5_PARSER_VERSION, NETZSCH5_IMPORTER_ID, measurementTypeLabel } from "./netzsch";
export { GEOMETRY_IMPORTER_ID, GEOMETRY_PARSER_VERSION, parseGeometryCsv, groupGeometryReadings, parseElementName } from "./geometry";

export const fileImporters: FileImporter[] = [gasSorptionImporter, netzschImporter, geometryImporter];


export const importerById = (id: string | null | undefined) =>
  fileImporters.find((i) => i.id === id) ?? null;

/** Automatische Erkennung anhand Dateiname und Inhalt. */
export function detectImporter(
  file: { name: string; buffer: ArrayBuffer },
  allowed?: string[] | null
): FileImporter | null {
  const pool = allowed?.length ? fileImporters.filter((i) => allowed.includes(i.id)) : fileImporters;
  return pool.find((i) => i.detect(file)) ?? null;
}

export interface FileMappedRow extends MappedRow {
  normalizedName: string;
  confidence: ImportedResult["confidence"];
  analysis: ImportedResult["analysis"];
  /** Vorhandener Wert im Zielfeld (Konflikterkennung). */
  existingValue?: string | number | null;
}

/**
 * Geometrievermessung: „D“ und „d“ sind fachlich verschiedene Messgrößen.
 * Deshalb gilt hier ausschließlich eine case-sensitive Zuordnung – die globale
 * (normalisierte) Zuordnungslogik der übrigen Importprofile bleibt unverändert.
 */
const isGeometry = (a: ImportedResult["analysis"]) => a === "GEOMETRY_MEAN" || a === "GEOMETRY_SINGLE";

/** Entfernt eine angehängte Einheit („D [mm]“, „D (mm)“) – ohne die Schreibweise zu ändern. */
const stripUnitSuffix = (s: string) => String(s ?? "").replace(/\s*[[(][^\])]*[\])]\s*$/, "").trim();

/** Exakte (case-sensitive) Übereinstimmung mit field_key oder Anzeigename. */
function exactTarget(name: string, targets: TargetCandidate[]): TargetCandidate | null {
  const n = stripUnitSuffix(name);
  return (
    targets.find((t) => t.field_key === n) ??
    targets.find((t) => stripUnitSuffix(t.display_name) === n) ??
    null
  );
}

function mapGeometryResult(
  r: ImportedResult,
  targets: TargetCandidate[],
  profile: MeasurementImportProfile | null | undefined,
  /** Kleinbuchstaben-Name -> Anzahl unterschiedlicher Schreibweisen im Import. */
  caseConflicts: Set<string>
): { targetFieldKey: string | null; origin: MappedRow["origin"]; factor: number | null } {
  // Priorität 0: Profilzuordnung, aber nur bei exakter Schreibweise.
  const mapping = (profile?.mappings ?? []).find((m) =>
    (m.source_names ?? []).some((s) => stripUnitSuffix(s) === stripUnitSuffix(r.sourceName))
  );
  if (mapping && targets.some((t) => t.field_key === mapping.target_field_key)) {
    return { targetFieldKey: mapping.target_field_key, origin: "profile", factor: mapping.factor ?? null };
  }

  // Priorität 1: exakte Schreibweise (Quellname oder Alias).
  for (const cand of [r.sourceName, ...r.aliases]) {
    const t = exactTarget(cand, targets);
    if (t) return { targetFieldKey: t.field_key, origin: "auto", factor: null };
  }

  // Priorität 2: normalisierte Zuordnung – nur wenn dadurch keine Verwechslung
  // von „D“/„d“ (bzw. „to“/„To“ …) entstehen kann.
  const lower = stripUnitSuffix(r.sourceName).toLowerCase();
  if (caseConflicts.has(lower)) return { targetFieldKey: null, origin: "none", factor: null };
  const ciMatches = targets.filter((t) =>
    [t.field_key, t.display_name].some((n) => stripUnitSuffix(n ?? "").toLowerCase() === lower)
  );
  const unique = [...new Set(ciMatches.map((t) => t.field_key))];
  if (unique.length === 1 && ciMatches.length >= 1) {
    return { targetFieldKey: unique[0], origin: "auto", factor: null };
  }
  return { targetFieldKey: null, origin: "none", factor: null };
}

/**
 * Rundet mathematisch korrekt (kaufmännisch) auf die im Ergebnisfeld
 * hinterlegte Anzahl Nachkommastellen. Ohne Angabe bleibt der Wert unverändert.
 */
export function roundToField(value: number, decimals?: number | null): number {
  if (decimals == null || !Number.isFinite(decimals) || decimals < 0) return value;
  if (!Number.isFinite(value)) return value;
  const f = 10 ** decimals;
  const scaled = value * f;
  // Korrigiert Binärdarstellungsfehler (25,42365 * 10000 = 25423,649999…).
  const corrected = Number(scaled.toPrecision(12));
  return Math.sign(corrected) * Math.round(Math.abs(corrected)) / f;
}


export function mapImportedResults(
  results: ImportedResult[],
  profile: MeasurementImportProfile | null | undefined,
  targets: TargetCandidate[],
  currentValues?: Record<string, unknown>
): FileMappedRow[] {
  const byNormKey = new Map(targets.map((t) => [normalizeName(t.field_key), t]));
  const byNormLabel = new Map(targets.map((t) => [normalizeName(t.display_name), t]));
  const byKey = new Map(targets.map((t) => [t.field_key, t]));

  // Schreibweisen, die sich nur durch Groß-/Kleinschreibung unterscheiden.
  const spellings = new Map<string, Set<string>>();
  for (const r of results.filter((x) => isGeometry(x.analysis))) {
    const n = stripUnitSuffix(r.sourceName);
    const set = spellings.get(n.toLowerCase()) ?? new Set<string>();
    set.add(n);
    spellings.set(n.toLowerCase(), set);
  }
  const caseConflicts = new Set([...spellings].filter(([, v]) => v.size > 1).map(([k]) => k));

  const mapped = results.map((r) => {
    if (isGeometry(r.analysis)) {
      const { targetFieldKey, origin, factor } = mapGeometryResult(r, targets, profile, caseConflicts);
      const target = targetFieldKey ? byKey.get(targetFieldKey) : undefined;
      const existingRaw = targetFieldKey ? currentValues?.[targetFieldKey] : undefined;
      // Maßgeblich ist die im Ergebnisfeld hinterlegte Genauigkeit, nicht die Rohdatei.
      const rounded = typeof r.value === "number" ? roundToField(r.value, target?.decimal_places) : null;
      return {
        sourceName: r.sourceName,
        raw: rounded != null ? String(rounded) : String(r.value),
        value: rounded,

        unit: r.unit ?? null,
        belowDetection: false,
        targetFieldKey,
        origin,
        factor,
        targetUnit: target?.unit ?? r.unit ?? null,
        unitMismatch: false,
        normalizedName: r.normalizedName,
        confidence: r.confidence,
        analysis: r.analysis,
        existingValue:
          existingRaw === undefined || existingRaw === null || existingRaw === ""
            ? null
            : (existingRaw as string | number),
      };
    }

    const base = mapReadings(
      [{ sourceName: r.sourceName, raw: String(r.value), value: typeof r.value === "number" ? r.value : null, unit: r.unit ?? null, belowDetection: false }],
      profile,
      targets
    )[0];

    let row: MappedRow = base;
    if (!row.targetFieldKey) {
      for (const alias of [r.normalizedName, ...r.aliases]) {
        const n = normalizeName(alias);
        const t = byNormKey.get(n) ?? byNormLabel.get(n);
        if (t) {
          row = { ...row, targetFieldKey: t.field_key, origin: "auto", targetUnit: t.unit ?? r.unit ?? null };
          break;
        }
      }
    }

    const existingRaw = row.targetFieldKey ? currentValues?.[row.targetFieldKey] : undefined;
    const existingValue =
      existingRaw === undefined || existingRaw === null || existingRaw === "" ? null : (existingRaw as string | number);

    return {
      ...row,
      normalizedName: r.normalizedName,
      confidence: r.confidence,
      analysis: r.analysis,
      existingValue,
    };
  });

  // Nur Geometrievermessung: Ausgabe in der Reihenfolge der Ergebnisfelder des
  // Formulars (targets sind bereits in Formularreihenfolge). Andere Profile
  // behalten die bisherige Reihenfolge der Datei unverändert.
  if (!mapped.some((r) => isGeometry(r.analysis))) return mapped;
  const order = new Map(targets.map((t, i) => [t.field_key, i]));
  const rank = (r: FileMappedRow) =>
    r.targetFieldKey != null ? (order.get(r.targetFieldKey) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  return mapped
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map((x) => x.r);
}



export const analysisLabel = (t: ImportedResult["analysis"]) => {
  switch (t) {
    case "BET": return "BET";
    case "BJH_ADSORPTION": return "BJH Adsorption";
    case "BJH_DESORPTION": return "BJH Desorption";
    case "LANGMUIR": return "Langmuir";
    case "T_PLOT": return "t-Plot";
    case "NLDFT": return "NLDFT / DFT";
    case "ISOTHERM": return "Isotherme";
    case "GEOMETRY_MEAN": return "Geometrie – Mittelwert";
    case "GEOMETRY_SINGLE": return "Geometrie – Einzelmessung";
    default: return "Unbekannt";
  }
};

export const measurementSummary = (m: ImportedMeasurement) =>
  m.analyses.map((a) => `${analysisLabel(a.type)} (${a.results.length})`).join(", ");
