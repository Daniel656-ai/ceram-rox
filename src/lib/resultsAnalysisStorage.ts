/**
 * Lokale Ablage gespeicherter Diagramm-/Analysekonfigurationen der Ergebnisdatenbank.
 * Bewusst gerätelokal: es werden ausschließlich Ansichtseinstellungen gespeichert,
 * keine Ergebnisdaten.
 */

export interface SavedAnalysis {
  id: string;
  name: string;
  createdAt: string;
  chartType: "scatter" | "bar" | "line";
  xAxis: string;
  yAxis: string;
  groupBy: string;
  xAuto: boolean;
  yAuto: boolean;
  xManual: { min: string; max: string; step: string };
  yManual: { min: string; max: string; step: string };
  showTrend: boolean;
  showMeanLines: boolean;
  showDataLabels: boolean;
  markOutliers: boolean;
  refLineY: string;
  refLineX: string;
}

const KEY = "rox.results.savedAnalyses";

export function loadSavedAnalyses(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedAnalysis[]) : [];
  } catch {
    return [];
  }
}

export function persistSavedAnalyses(items: SavedAnalysis[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* Speicher nicht verfügbar – Analysen bleiben nur für die Sitzung erhalten. */
  }
}
