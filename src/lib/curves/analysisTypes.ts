/**
 * Zentrale fachliche Zuordnung importierter Messdaten zu Auswertungstypen.
 *
 * Hier – und nur hier – ist festgelegt, welche Auswertungen es gibt, in
 * welcher Reihenfolge sie im Ergebnis erscheinen und welche Diagramme dazu
 * gehören. Die Diagrammdefinitionen selbst bleiben in ihren bestehenden
 * Modulen (z. B. `bjhCharts.ts`) und werden hier nur referenziert.
 */
import { buildBjhCharts } from "./bjhCharts";
import type { MeasurementDataset, MeasurementChannel } from "./dataset";

export type AnalysisKind = "BJH" | "STA" | "DIL" | "OTHER";

/** Feste fachliche Reihenfolge der Ergebnisdarstellung. */
export const ANALYSIS_ORDER: AnalysisKind[] = ["BJH", "STA", "DIL", "OTHER"];

export const ANALYSIS_LABELS: Record<AnalysisKind, string> = {
  BJH: "BJH – Porengrößenverteilung",
  STA: "STA – Thermische Analyse",
  DIL: "DIL – Dilatometrie",
  OTHER: "Weitere Messdaten",
};

/** Kopfdaten eines gespeicherten Rohdatensatzes (Ausschnitt). */
export interface AnalysisSource {
  importer_id?: string | null;
  measurement_type?: string | null;
  channels?: MeasurementChannel[] | null;
}

const hasChannel = (channels: MeasurementChannel[] | null | undefined, test: RegExp) =>
  (channels ?? []).some((c) => test.test(c.label ?? "") || test.test(c.key ?? ""));

/**
 * Erkennt den Auswertungstyp eines importierten Datensatzes.
 * Grundlage sind der Importer, der Messdatentyp der Datei und – als
 * fachlicher Nachweis – die tatsächlich vorhandenen Kanäle.
 */
export function detectAnalysisKind(source: AnalysisSource): AnalysisKind {
  const type = String(source.measurement_type ?? "").toUpperCase();
  const importer = String(source.importer_id ?? "").toLowerCase();

  if (
    importer.includes("gas") ||
    importer.includes("sorption") ||
    /BJH|BET|ADSORP/.test(type) ||
    hasChannel(source.channels, /pore\s*(size|width|diameter|volume|area)/i)
  ) {
    return "BJH";
  }
  if (/DIL/.test(type) || hasChannel(source.channels, /^dL(\/Lo)?\b|expansion|ausdehnung/i)) return "DIL";
  if (/STA|DSC|TG|DTA/.test(type) || hasChannel(source.channels, /\bDSC\b|\bTG\b|\bDTA\b/i)) return "STA";
  return "OTHER";
}

/** Sortiert Datensätze nach der festen fachlichen Reihenfolge (stabil). */
export function sortByAnalysisOrder<T extends AnalysisSource>(sources: T[]): T[] {
  return sources
    .map((s, index) => ({ s, index, rank: ANALYSIS_ORDER.indexOf(detectAnalysisKind(s)) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.s);
}

/** Für BJH liefert das bestehende Importprofil die vier Diagramme. */
export const analysisCharts = (kind: AnalysisKind, dataset: MeasurementDataset | null | undefined) =>
  kind === "BJH" ? buildBjhCharts(dataset) : [];
