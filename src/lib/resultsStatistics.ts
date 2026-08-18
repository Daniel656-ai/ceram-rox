/**
 * Statistik-Auswertungen für die Ergebnisdatenbank.
 * Reine Rechenlogik ohne UI-Abhängigkeiten – dadurch testbar und wiederverwendbar.
 */

export interface SeriesStats {
  n: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  /** Stichproben-Standardabweichung (n-1); bei n < 2 gleich 0. */
  sd: number;
  q1: number;
  q3: number;
  iqr: number;
}

/** Quantil nach linearer Interpolation (Typ 7, wie in R/Excel). */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

export function computeStats(values: number[]): SeriesStats | null {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return {
    n,
    mean,
    median: quantile(sorted, 0.5),
    min: sorted[0],
    max: sorted[n - 1],
    sd: Math.sqrt(variance),
    q1,
    q3,
    iqr: q3 - q1,
  };
}

/** Ausreißergrenzen nach Tukey (1,5 × IQR). */
export function outlierBounds(stats: SeriesStats, factor = 1.5): { lower: number; upper: number } {
  return { lower: stats.q1 - factor * stats.iqr, upper: stats.q3 + factor * stats.iqr };
}

export function isOutlier(value: number, stats: SeriesStats, factor = 1.5): boolean {
  const { lower, upper } = outlierBounds(stats, factor);
  return value < lower || value > upper;
}

export interface Regression {
  slope: number;
  intercept: number;
  /** Bestimmtheitsmaß R². */
  r2: number;
  n: number;
}

/** Lineare Regression (Methode der kleinsten Quadrate) über numerische Punkte. */
export function linearRegression(points: Array<{ x: number; y: number }>): Regression | null {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

export interface InsightInput {
  yLabel: string;
  xLabel: string;
  stats: SeriesStats | null;
  regression: Regression | null;
  outlierLabels: string[];
  totalPoints: number;
  visiblePoints: number;
}

/** Automatische, sachliche Kurzbewertung der aktuellen Auswertung. */
export function buildInsights(input: InsightInput): string[] {
  const out: string[] = [];
  const { stats, regression, outlierLabels, yLabel, xLabel } = input;
  if (!stats) return out;

  out.push(
    `${input.visiblePoints} von ${input.totalPoints} Datenpunkten ausgewertet · Ø ${formatNumber(stats.mean)} · Median ${formatNumber(stats.median)} · SD ${formatNumber(stats.sd)}.`
  );

  const cv = stats.mean !== 0 ? Math.abs(stats.sd / stats.mean) * 100 : null;
  if (cv != null) {
    out.push(
      cv < 5
        ? `Sehr geringe Streuung bei ${yLabel} (Variationskoeffizient ${formatNumber(cv, 1)} %).`
        : cv < 15
        ? `Moderate Streuung bei ${yLabel} (Variationskoeffizient ${formatNumber(cv, 1)} %).`
        : `Hohe Streuung bei ${yLabel} (Variationskoeffizient ${formatNumber(cv, 1)} %) – Werte vor Interpretation prüfen.`
    );
  }

  if (regression) {
    const strength = regression.r2 >= 0.7 ? "starker" : regression.r2 >= 0.3 ? "erkennbarer" : "kaum";
    const dir = regression.slope >= 0 ? "steigender" : "fallender";
    out.push(
      regression.r2 >= 0.3
        ? `${strength.charAt(0).toUpperCase() + strength.slice(1)} ${dir} Zusammenhang zwischen ${xLabel} und ${yLabel} (R² = ${formatNumber(regression.r2, 3)}, Steigung ${formatNumber(regression.slope, 4)}).`
        : `Kein belastbarer linearer Zusammenhang zwischen ${xLabel} und ${yLabel} (R² = ${formatNumber(regression.r2, 3)}).`
    );
  }

  if (outlierLabels.length > 0) {
    out.push(
      `${outlierLabels.length} Ausreißer nach Tukey (1,5 × IQR): ${outlierLabels.slice(0, 5).join(", ")}${outlierLabels.length > 5 ? " …" : ""}.`
    );
  } else {
    out.push("Keine Ausreißer nach Tukey (1,5 × IQR) erkannt.");
  }

  return out;
}
