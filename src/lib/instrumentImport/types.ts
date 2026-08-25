/**
 * Einheitliches Importmodell für Messgeräte-Dateien.
 *
 * Alle Geräte-Importer (RFA-Copy&Paste, Micromeritics TriStar II, künftige
 * Geräte) liefern dieses Modell. Die Weiterverarbeitung (Feld-Mapping,
 * Vorschau, Übernahme in das Formular) ist geräteunabhängig und nutzt
 * ausschließlich die bestehende Messdatenimport-Architektur.
 */

export type Confidence = "high" | "medium" | "low";

export type AnalysisType =
  | "BET"
  | "BJH_ADSORPTION"
  | "BJH_DESORPTION"
  | "LANGMUIR"
  | "T_PLOT"
  | "NLDFT"
  | "ISOTHERM"
  | "UNKNOWN";

export interface ImportedResult {
  /** Bezeichnung exakt wie in der Gerätedatei gefunden. */
  sourceName: string;
  /** Normalisierte, geräteunabhängige Bezeichnung (z.B. "bet_surface_area"). */
  normalizedName: string;
  /** Weitere Schreibweisen für den automatischen Feldabgleich. */
  aliases: string[];
  value: number | string;
  unit?: string | null;
  confidence: Confidence;
  analysis: AnalysisType;
}

export interface ImportedSeriesPoint {
  x: number;
  y: number;
}

export interface ImportedSeries {
  name: string;
  xLabel: string;
  xUnit?: string | null;
  yLabel: string;
  yUnit?: string | null;
  points: ImportedSeriesPoint[];
}

export interface ImportedAnalysis {
  type: AnalysisType;
  results: ImportedResult[];
  series: ImportedSeries[];
}

export interface ImportedMeasurement {
  source: string;
  instrumentFamily: string;
  sourceFileName: string;
  parserVersion: string;
  sampleInformation: {
    sampleName?: string;
    sampleMass?: number;
    sampleMassUnit?: string;
    analysisDate?: string;
  };
  analyses: ImportedAnalysis[];
  warnings: string[];
  /** Nicht interpretierte Datenblöcke – nur für spätere Erweiterungen. */
  unrecognized: string[];
  /** Messdatentyp laut Datei (z. B. NETZSCH #MTYPE: DIL / DSC). */
  measurementType?: string;
  /** Vollständige Rohdaten (Kanäle + Messpunkte), falls das Format sie liefert. */
  dataset?: MeasurementDataset;
  /** Rohe Kopfzeilen der Datei (Schlüssel -> Wert). */
  headerMap?: Record<string, string>;
}


/** Gemeinsame Schnittstelle aller Datei-Importer. */
export interface FileImporter {
  id: string;
  label: string;
  /** Für die UI: unterstützte Dateiendungen inkl. Punkt. */
  extensions: string[];
  /** Erkennung anhand Dateiname und Inhalt. */
  detect: (file: { name: string; buffer: ArrayBuffer }) => boolean;
  parse: (file: { name: string; buffer: ArrayBuffer }) => ImportedMeasurement;
}

export const allResults = (m: ImportedMeasurement | null | undefined): ImportedResult[] =>
  (m?.analyses ?? []).flatMap((a) => a.results);
