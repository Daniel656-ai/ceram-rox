/**
 * Generische Kurvenauswertungen.
 *
 * Prinzip: Messdaten -> Kanäle -> Kurve -> Bereichsauswahl -> Berechnung -> Ergebnis.
 * Keine Auswertung ist fest an ein Messverfahren gebunden; die Eignung ergibt
 * sich allein aus den vorhandenen Kanälen und ihren Einheiten. Weitere
 * Verfahren (RFA, Gasadsorption, …) lassen sich ohne Änderung dieser Datei
 * anschließen, indem sie Kanäle liefern.
 */
import {
  curveOf,
  interpolateAt,
  sliceRange,
  trapezoidArea,
  findChannel,
  type CurvePoint,
  type MeasurementDataset,
} from "./dataset";

export interface EvaluationContext {
  dataset: MeasurementDataset;
  xKey: string;
  yKey: string;
  from: number;
  to: number;
}

export interface EvaluationOutcome {
  value: number | null;
  unit: string | null;
  /** Nachvollziehbare Zwischenwerte der Berechnung. */
  details: { label: string; value: string }[];
  /** Formel in Klartext. */
  formula: string;
  error?: string;
}

export interface CurveEvaluation {
  id: string;
  label: string;
  description: string;
  /** Prüft anhand der Kanäle/Einheiten, ob die Auswertung sinnvoll ist. */
  isApplicable: (ctx: Omit<EvaluationContext, "from" | "to">) => boolean;
  run: (ctx: EvaluationContext) => EvaluationOutcome;
}

const num = (v: number | null | undefined, digits = 6) =>
  v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("de-AT", { maximumSignificantDigits: digits });

const fail = (message: string): EvaluationOutcome => ({
  value: null, unit: null, details: [], formula: "", error: message,
});

function prepare(ctx: EvaluationContext): { points: CurvePoint[]; yUnit: string | null; xUnit: string | null } {
  const all = curveOf(ctx.dataset, ctx.xKey, ctx.yKey);
  return {
    points: sliceRange(all, ctx.from, ctx.to),
    yUnit: findChannel(ctx.dataset, ctx.yKey)?.unit ?? null,
    xUnit: findChannel(ctx.dataset, ctx.xKey)?.unit ?? null,
  };
}

const isTemperatureX = (ctx: { dataset: MeasurementDataset; xKey: string }) =>
  findChannel(ctx.dataset, ctx.xKey)?.unit === "°C";

/** Technischer Ausdehnungskoeffizient: α = (ΔL/L₀) / ΔT zwischen zwei Temperaturen. */
const technicalExpansion: CurveEvaluation = {
  id: "technical_expansion_coefficient",
  label: "Technischer Ausdehnungskoeffizient",
  description: "α = (dL/Lo(T₂) − dL/Lo(T₁)) / (T₂ − T₁)",
  isApplicable: (ctx) => isTemperatureX(ctx) && (findChannel(ctx.dataset, ctx.yKey)?.unit ?? null) === null,
  run: (ctx) => {
    const all = curveOf(ctx.dataset, ctx.xKey, ctx.yKey);
    const y1 = interpolateAt(all, ctx.from);
    const y2 = interpolateAt(all, ctx.to);
    if (y1 == null || y2 == null) return fail("Der gewählte Bereich liegt außerhalb der Messdaten.");
    const dT = ctx.to - ctx.from;
    if (Math.abs(dT) < 1e-9) return fail("Start- und Endtemperatur sind identisch.");
    const value = (y2 - y1) / dT;
    return {
      value,
      unit: "1/K",
      formula: "α = (dL/Lo(T₂) − dL/Lo(T₁)) / (T₂ − T₁)",
      details: [
        { label: "Startwert bei T₁", value: num(y1) },
        { label: "Endwert bei T₂", value: num(y2) },
        { label: "ΔT", value: `${num(dT)} K` },
      ],
    };
  },
};

/** Differenz des Y-Kanals zwischen zwei X-Werten (ΔL/L₀, Massenverlust absolut …). */
const deltaBetween: CurveEvaluation = {
  id: "delta_between",
  label: "Differenz zwischen zwei Punkten",
  description: "Δy = y(x₂) − y(x₁)",
  isApplicable: () => true,
  run: (ctx) => {
    const all = curveOf(ctx.dataset, ctx.xKey, ctx.yKey);
    const y1 = interpolateAt(all, ctx.from);
    const y2 = interpolateAt(all, ctx.to);
    if (y1 == null || y2 == null) return fail("Der gewählte Bereich liegt außerhalb der Messdaten.");
    return {
      value: y2 - y1,
      unit: findChannel(ctx.dataset, ctx.yKey)?.unit ?? null,
      formula: "Δy = y(x₂) − y(x₁)",
      details: [
        { label: "Wert bei Start", value: num(y1) },
        { label: "Wert bei Ende", value: num(y2) },
      ],
    };
  },
};

/** Relativer Verlust in Prozent des Startwertes (Gewichtsverlust). */
const relativeLoss: CurveEvaluation = {
  id: "relative_loss",
  label: "Relative Änderung (Verlust)",
  description: "Δ% = (y(x₁) − y(x₂)) / y(x₁) × 100",
  isApplicable: () => true,
  run: (ctx) => {
    const all = curveOf(ctx.dataset, ctx.xKey, ctx.yKey);
    const y1 = interpolateAt(all, ctx.from);
    const y2 = interpolateAt(all, ctx.to);
    if (y1 == null || y2 == null) return fail("Der gewählte Bereich liegt außerhalb der Messdaten.");
    if (Math.abs(y1) < 1e-12) return fail("Startwert ist 0 – relative Änderung nicht berechenbar.");
    return {
      value: ((y1 - y2) / y1) * 100,
      unit: "%",
      formula: "Δ% = (y(x₁) − y(x₂)) / y(x₁) × 100",
      details: [
        { label: "Wert bei Start", value: num(y1) },
        { label: "Wert bei Ende", value: num(y2) },
      ],
    };
  },
};

/** Mittelwert des Y-Kanals im Bereich (z. B. mittleres Alpha). */
const meanInRange: CurveEvaluation = {
  id: "mean_in_range",
  label: "Mittelwert im Bereich",
  description: "Arithmetisches Mittel aller Messpunkte im gewählten Bereich",
  isApplicable: () => true,
  run: (ctx) => {
    const { points, yUnit } = prepare(ctx);
    if (points.length === 0) return fail("Keine Messpunkte im gewählten Bereich.");
    const sum = points.reduce((a, p) => a + p.y, 0);
    return {
      value: sum / points.length,
      unit: yUnit,
      formula: "ȳ = Σyᵢ / n",
      details: [{ label: "Anzahl Messpunkte", value: String(points.length) }],
    };
  },
};

/** Extremwert im Bereich (max. Ausdehnung, Peak-Höhe …). */
const extremum = (mode: "max" | "min"): CurveEvaluation => ({
  id: mode === "max" ? "maximum_in_range" : "minimum_in_range",
  label: mode === "max" ? "Maximum im Bereich" : "Minimum im Bereich",
  description: mode === "max" ? "Größter Y-Wert und zugehöriger X-Wert" : "Kleinster Y-Wert und zugehöriger X-Wert",
  isApplicable: () => true,
  run: (ctx) => {
    const { points, yUnit, xUnit } = prepare(ctx);
    if (points.length === 0) return fail("Keine Messpunkte im gewählten Bereich.");
    const best = points.reduce((a, p) => ((mode === "max" ? p.y > a.y : p.y < a.y) ? p : a), points[0]);
    return {
      value: best.y,
      unit: yUnit,
      formula: mode === "max" ? "y_max im Bereich" : "y_min im Bereich",
      details: [{ label: "Position (X)", value: `${num(best.x)}${xUnit ? ` ${xUnit}` : ""}` }],
    };
  },
});

/** X-Wert des Extremums – z. B. Peak-Temperatur oder Temperatur maximaler Ausdehnung. */
const extremumPosition = (mode: "max" | "min"): CurveEvaluation => ({
  id: mode === "max" ? "peak_x_max" : "peak_x_min",
  label: mode === "max" ? "X-Wert des Maximums (Peak-Temperatur)" : "X-Wert des Minimums (Peak-Temperatur)",
  description: "X-Position des Extremwertes im gewählten Bereich",
  isApplicable: () => true,
  run: (ctx) => {
    const { points, xUnit } = prepare(ctx);
    if (points.length === 0) return fail("Keine Messpunkte im gewählten Bereich.");
    const best = points.reduce((a, p) => ((mode === "max" ? p.y > a.y : p.y < a.y) ? p : a), points[0]);
    return {
      value: best.x,
      unit: xUnit,
      formula: mode === "max" ? "x bei y_max" : "x bei y_min",
      details: [{ label: "Extremwert (Y)", value: num(best.y) }],
    };
  },
});

/** Peakfläche gegenüber der Basislinie zwischen Start- und Endpunkt. */
const peakArea: CurveEvaluation = {
  id: "peak_area",
  label: "Peak-Fläche (Basislinie linear)",
  description: "Integral der Kurve abzüglich der Verbindungsgeraden zwischen Bereichsgrenzen",
  isApplicable: () => true,
  run: (ctx) => {
    const { points, yUnit, xUnit } = prepare(ctx);
    if (points.length < 2) return fail("Zu wenige Messpunkte im gewählten Bereich.");
    const a = points[0];
    const b = points[points.length - 1];
    const slope = b.x === a.x ? 0 : (b.y - a.y) / (b.x - a.x);
    const baseline = (x: number) => a.y + slope * (x - a.x);
    const value = trapezoidArea(points, baseline);
    return {
      value,
      unit: yUnit && xUnit ? `${yUnit}·${xUnit}` : yUnit,
      formula: "A = ∫ (y − Basislinie) dx (Trapezregel, lineare Basislinie)",
      details: [
        { label: "Anzahl Messpunkte", value: String(points.length) },
        { label: "Basislinie Start", value: num(a.y) },
        { label: "Basislinie Ende", value: num(b.y) },
      ],
    };
  },
};

/** Y-Wert an einer definierten X-Stelle (Längenänderung/Alpha bei Temperatur). */
const valueAt: CurveEvaluation = {
  id: "value_at_x",
  label: "Wert an definierter Stelle (Ende des Bereichs)",
  description: "Linear interpolierter Y-Wert bei x = Endwert",
  isApplicable: () => true,
  run: (ctx) => {
    const all = curveOf(ctx.dataset, ctx.xKey, ctx.yKey);
    const y = interpolateAt(all, ctx.to);
    if (y == null) return fail("Die gewählte Stelle liegt außerhalb der Messdaten.");
    return {
      value: y,
      unit: findChannel(ctx.dataset, ctx.yKey)?.unit ?? null,
      formula: "y = y(x) linear interpoliert",
      details: [{ label: "Stelle (X)", value: num(ctx.to) }],
    };
  },
};

export const curveEvaluations: CurveEvaluation[] = [
  technicalExpansion,
  deltaBetween,
  relativeLoss,
  meanInRange,
  extremum("max"),
  extremum("min"),
  extremumPosition("max"),
  extremumPosition("min"),
  peakArea,
  valueAt,
];

export const evaluationById = (id: string) => curveEvaluations.find((e) => e.id === id) ?? null;

/** Auswertungen, die für die aktuelle Kurve fachlich sinnvoll sind. */
export function applicableEvaluations(
  dataset: MeasurementDataset,
  xKey: string,
  yKey: string,
  allowed?: string[] | null,
): CurveEvaluation[] {
  const pool = allowed?.length ? curveEvaluations.filter((e) => allowed.includes(e.id)) : curveEvaluations;
  return pool.filter((e) => e.isApplicable({ dataset, xKey, yKey }));
}
