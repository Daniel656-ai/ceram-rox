/**
 * Platten-Geometrievermessung (BENCH NOx / BENCH SOx).
 *
 * Additive Ergänzung zur bestehenden Wabenkörper-Geometrie
 * (`src/lib/geometry/calculations.ts`). Bestehende Formeln, Einheiten und der
 * Mikroskop-Import für Wabenkörper bleiben unverändert.
 *
 * Grundsätze wie bisher:
 *  - Alle Formeln stehen zentral hier und werden über die vorhandene
 *    Formel-Engine ausgewertet – keine Rechenlogik in React-Komponenten.
 *  - Fehlende Eingangsgrößen ergeben `null` („nicht berechenbar“), niemals 0.
 *  - Messwerte (Ist) werden nie durch Berechnungen überschrieben.
 */

import { evaluateFormula } from "@/lib/formulaEngine";
import {
  DEFAULT_REACTOR_GEOMETRY,
  reactorCrossSectionMm2,
  type GeometryCalcDefinition,
  type GeometryCalcResult,
  type ReactorGeometry,
} from "./calculations";

/** Technischer Schlüssel der Geometrieart „Platte“. */
export const PLATE_GEOMETRY_KIND = "platte";
/** Technischer Schlüssel der bestehenden Wabenkörper-Geometrie. */
export const HONEYCOMB_GEOMETRY_KIND = "wabenkoerper";

export const PLATE_INPUT_LABELS: Record<string, string> = {
  plattenlaenge: "Plattenlänge [mm]",
  breite_1x_sicke: "Breite 1× Sicke [mm]",
  breite_2x_sicke: "Breite 2× Sicke [mm]",
  plattenanzahl: "Plattenanzahl",
  stk_doppelsicke: "Stk. Doppelsicke",
  stk_einzelsicke: "Stk. Einzelsicke",
  dicke_mittel: "Mittelwert Plattendicke [mm]",
  breite_mittel: "Mittelwert Breite [mm]",
  gewicht_mittel: "Mittelwert Gewicht [g]",
  modulbreite: "Modulbreite [mm]",
  reaktorquerschnitt: "Reaktorquerschnitt [mm²]",
  oberflaeche: "Oberfläche [m²]",
  modulvolumen: "Modulvolumen [m³]",
};

/**
 * Berechnungsdefinitionen der Plattengeometrie.
 *
 * Die Reihenfolge entspricht der fachlichen Auswertungsfolge. Mittelwerte
 * werden aus den Einzelmessungen gebildet (siehe `mean`), die abgeleiteten
 * Größen ausschließlich über diese Definitionen.
 */
export const PLATE_GEOMETRY_CALCULATIONS: GeometryCalcDefinition[] = [
  {
    calc_key: "modulbreite",
    display_name: "Modulbreite",
    description: "Stk. Einzelsicke × Breite 1× Sicke + Stk. Doppelsicke × Breite 2× Sicke",
    formula: "stk_einzelsicke * breite_1x_sicke + stk_doppelsicke * breite_2x_sicke",
    unit: "mm",
    decimals: 2,
    inputs: ["stk_einzelsicke", "breite_1x_sicke", "stk_doppelsicke", "breite_2x_sicke"],
  },
  {
    calc_key: "modulvolumen",
    display_name: "Modulvolumen",
    description: "Reaktorquerschnitt × Plattenlänge (mm³ → m³)",
    formula: "reaktorquerschnitt * plattenlaenge / 1000000000",
    unit: "m³",
    decimals: 6,
    inputs: ["reaktorquerschnitt", "plattenlaenge"],
  },
  {
    calc_key: "oberflaeche",
    display_name: "Oberfläche",
    description: "Beidseitig benetzte Plattenfläche: 2 × Länge × Breite × Plattenanzahl (mm² → m²)",
    formula: "2 * plattenlaenge * breite_mittel * plattenanzahl / 1000000",
    unit: "m²",
    decimals: 4,
    inputs: ["plattenlaenge", "breite_mittel", "plattenanzahl"],
  },
  {
    calc_key: "ap",
    display_name: "Ap (spezifische Oberfläche)",
    description: "Oberfläche bezogen auf das Modulvolumen.",
    formula: "oberflaeche / modulvolumen",
    unit: "m²/m³",
    decimals: 1,
    inputs: ["oberflaeche", "modulvolumen"],
  },
  {
    calc_key: "epsilon",
    display_name: "ε (freies Volumen)",
    description:
      "ε = (1 − Plattenvolumen / Modulvolumen) × 100; Plattenvolumen = Länge × Breite × Dicke × Plattenanzahl",
    formula:
      "(1 - (plattenlaenge * breite_mittel * dicke_mittel * plattenanzahl / 1000000000) / modulvolumen) * 100",
    unit: "%",
    decimals: 2,
    inputs: ["plattenlaenge", "breite_mittel", "dicke_mittel", "plattenanzahl", "modulvolumen"],
  },
];

export const plateCalculation = (key: string) =>
  PLATE_GEOMETRY_CALCULATIONS.find((c) => c.calc_key === key) ?? null;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Wertet eine einzelne Plattendefinition gegen einen Wertekontext aus. */
export function evaluatePlateCalculation(
  key: string,
  ctx: Record<string, unknown>,
): GeometryCalcResult {
  const def = plateCalculation(key);
  if (!def) {
    return { value: null, missing: [], error: `Unbekannte Berechnung: ${key}`, unit: "", decimals: 2 };
  }
  const missing = def.inputs.filter((k) => !isNum(ctx[k]));
  if (missing.length) {
    return { value: null, missing, error: null, unit: def.unit, decimals: def.decimals };
  }
  const res = evaluateFormula(def.formula, ctx, { knownReferences: new Set(def.inputs) });
  const value = res.error || res.value == null || !Number.isFinite(res.value) ? null : res.value;
  return { value, missing: [], error: res.error, unit: def.unit, decimals: def.decimals };
}

/* ------------------------------------------------------------------ *
 * Eingabemodell                                                        *
 * ------------------------------------------------------------------ */

/** Eine Zeile der Plattendicke-Einzelmessungen (zwei Messwerte je Platte). */
export interface PlateThicknessRow {
  messwert_1: number | null;
  messwert_2: number | null;
}

/** Eine Zeile des Bereichs Gewicht / Dimension. */
export interface PlateWeightRow {
  gewicht: number | null;
  breite_1: number | null;
  breite_2: number | null;
}

export interface PlateGeometryData {
  plattenlaenge: number | null;
  breite_1x_sicke: number | null;
  breite_2x_sicke: number | null;
  plattenanzahl: number | null;
  stk_doppelsicke: number | null;
  stk_einzelsicke: number | null;
  thickness: PlateThicknessRow[];
  weights: PlateWeightRow[];
  /** Schlüssel der Reaktorgeometrie aus den Stammdaten. */
  reaktorgeometrie?: string | null;
}

export const emptyPlateThicknessRow = (): PlateThicknessRow => ({ messwert_1: null, messwert_2: null });
export const emptyPlateWeightRow = (): PlateWeightRow => ({ gewicht: null, breite_1: null, breite_2: null });

export const emptyPlateGeometryData = (): PlateGeometryData => ({
  plattenlaenge: null,
  breite_1x_sicke: null,
  breite_2x_sicke: null,
  plattenanzahl: null,
  stk_doppelsicke: null,
  stk_einzelsicke: null,
  thickness: [],
  weights: [],
  reaktorgeometrie: null,
});

const toNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Liest einen gespeicherten Datensatz robust in das Eingabemodell ein. */
export function parsePlateGeometryData(raw: unknown): PlateGeometryData {
  const o = (raw ?? {}) as Record<string, unknown>;
  const thickness = Array.isArray(o.thickness) ? (o.thickness as Record<string, unknown>[]) : [];
  const weights = Array.isArray(o.weights) ? (o.weights as Record<string, unknown>[]) : [];
  return {
    plattenlaenge: toNum(o.plattenlaenge),
    breite_1x_sicke: toNum(o.breite_1x_sicke),
    breite_2x_sicke: toNum(o.breite_2x_sicke),
    plattenanzahl: toNum(o.plattenanzahl),
    stk_doppelsicke: toNum(o.stk_doppelsicke),
    stk_einzelsicke: toNum(o.stk_einzelsicke),
    thickness: thickness.map((r) => ({ messwert_1: toNum(r.messwert_1), messwert_2: toNum(r.messwert_2) })),
    weights: weights.map((r) => ({
      gewicht: toNum(r.gewicht),
      breite_1: toNum(r.breite_1),
      breite_2: toNum(r.breite_2),
    })),
    reaktorgeometrie: typeof o.reaktorgeometrie === "string" ? o.reaktorgeometrie : null,
  };
}

/**
 * Arithmetischer Mittelwert der gültigen Werte. Fehlende Werte werden
 * ignoriert (nie als 0 gewertet); ohne gültigen Wert ist das Ergebnis `null`.
 */
export function mean(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => isNum(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/* ------------------------------------------------------------------ *
 * Auswertung                                                           *
 * ------------------------------------------------------------------ */

export interface PlateGeometryResult {
  mittelwerte: {
    dicke: number | null;
    gewicht: number | null;
    breite: number | null;
  };
  berechnet: {
    modulbreite: number | null;
    modulvolumen: number | null;
    oberflaeche: number | null;
    ap: number | null;
    epsilon: number | null;
  };
  /** Anzahl der Zeilen, die sich fachlich aus der Plattenanzahl ergibt. */
  rowCount: number;
  hints: string[];
}

export const plateRowCount = (data: PlateGeometryData): number => {
  const n = isNum(data.plattenanzahl) ? Math.max(0, Math.floor(data.plattenanzahl)) : 0;
  return Math.max(n, data.thickness.length, data.weights.length);
};

const missingText = (label: string, missing: string[]) =>
  `${label} kann nicht berechnet werden: ${missing.map((m) => PLATE_INPUT_LABELS[m] ?? m).join(", ")} fehlt.`;

/** Vollständige Auswertung der Plattengeometrie über die zentralen Definitionen. */
export function computePlateGeometry(
  data: PlateGeometryData,
  reactor: ReactorGeometry = DEFAULT_REACTOR_GEOMETRY,
): PlateGeometryResult {
  const hints: string[] = [];

  const dicke = mean(data.thickness.flatMap((r) => [r.messwert_1, r.messwert_2]));
  const gewicht = mean(data.weights.map((r) => r.gewicht));
  const breite = mean(data.weights.flatMap((r) => [r.breite_1, r.breite_2]));

  const ctx: Record<string, unknown> = {
    plattenlaenge: data.plattenlaenge,
    breite_1x_sicke: data.breite_1x_sicke,
    breite_2x_sicke: data.breite_2x_sicke,
    plattenanzahl: data.plattenanzahl,
    stk_doppelsicke: data.stk_doppelsicke,
    stk_einzelsicke: data.stk_einzelsicke,
    dicke_mittel: dicke,
    gewicht_mittel: gewicht,
    breite_mittel: breite,
    reaktorquerschnitt: reactorCrossSectionMm2(reactor),
  };

  const evaluate = (key: string) => {
    const res = evaluatePlateCalculation(key, ctx);
    if (res.value == null && res.missing.length) {
      hints.push(missingText(plateCalculation(key)?.display_name ?? key, res.missing));
    }
    ctx[key] = res.value;
    return res.value;
  };

  const modulbreite = evaluate("modulbreite");
  const modulvolumen = evaluate("modulvolumen");
  const oberflaeche = evaluate("oberflaeche");
  const ap = evaluate("ap");
  const epsilon = evaluate("epsilon");

  return {
    mittelwerte: { dicke, gewicht, breite },
    berechnet: { modulbreite, modulvolumen, oberflaeche, ap, epsilon },
    rowCount: plateRowCount(data),
    hints,
  };
}
