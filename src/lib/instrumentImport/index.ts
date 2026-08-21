/**
 * Registry aller Datei-Importer für Messgeräte.
 *
 * Die Registry ist bewusst offen: neue Geräte werden hier ergänzt und stehen
 * damit automatisch im bestehenden Messdatenimport der Formulare zur Verfügung.
 */
import type { FileImporter, ImportedMeasurement, ImportedResult } from "./types";
import { tristarImporter } from "./micromeritics/tristar";
import { normalizeName, type MappedRow, type TargetCandidate } from "@/lib/measurementImport";
import { mapReadings } from "@/lib/measurementImport";
import type { MeasurementImportProfile } from "@/lib/api/measurementImportProfiles";

export * from "./types";
export { TRISTAR_PARSER_VERSION } from "./micromeritics/tristar";

export const fileImporters: FileImporter[] = [tristarImporter];

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
 * Ordnet die erkannten Geräte-Ergebnisse den Feldern des aktuellen Formulars zu.
 * Es werden ausschließlich vorhandene Felder befüllt – nie neue erzeugt.
 */
export function mapImportedResults(
  results: ImportedResult[],
  profile: MeasurementImportProfile | null | undefined,
  targets: TargetCandidate[],
  currentValues?: Record<string, unknown>
): FileMappedRow[] {
  const byNormKey = new Map(targets.map((t) => [normalizeName(t.field_key), t]));
  const byNormLabel = new Map(targets.map((t) => [normalizeName(t.display_name), t]));

  return results.map((r) => {
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
}

export const analysisLabel = (t: ImportedResult["analysis"]) => {
  switch (t) {
    case "BET": return "BET";
    case "BJH_ADSORPTION": return "BJH Adsorption";
    case "BJH_DESORPTION": return "BJH Desorption";
    case "NLDFT": return "NLDFT / DFT";
    case "ISOTHERM": return "Isotherme";
    default: return "Unbekannt";
  }
};

export const measurementSummary = (m: ImportedMeasurement) =>
  m.analyses.map((a) => `${analysisLabel(a.type)} (${a.results.length})`).join(", ");
