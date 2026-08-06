/**
 * Variablenzuordnung (Data Binding) für globale Berechnungen.
 *
 * Eine Berechnung besteht aus drei Teilen:
 *   1. Eingangsvariablen – jede Variable wird an eine Datenquelle gebunden
 *   2. Formel            – verwendet ausschließlich diese Variablen
 *   3. Ausgabe           – das Ergebnis wird einem Ziel zugewiesen
 *
 * Mehrfachauswahlen werden als Arrays durchgereicht, damit COUNT(), SUM(),
 * AVERAGE(), MIN(), MAX() usw. direkt darauf arbeiten können.
 */

import { evaluateFormula } from "@/lib/formulaEngine";
import type { GlobalCalculation } from "@/lib/api/globalLibrary";

export type CalcInputSource =
  | "form_field"
  | "system"
  | "master_data"
  | "constant"
  | "calculation";

export const CALC_INPUT_SOURCES: { value: CalcInputSource; label: string }[] = [
  { value: "form_field", label: "Formularfeld" },
  { value: "system", label: "Systemvariable" },
  { value: "master_data", label: "Stammdaten" },
  { value: "constant", label: "Konstanter Wert" },
  { value: "calculation", label: "Andere Berechnung" },
];

export interface CalcInputBinding {
  /** Variablenname, wie er in der Formel verwendet wird. */
  variable: string;
  source: CalcInputSource;
  /** Feldschlüssel, Systempfad, Stammdaten-Pfad oder calc_key. */
  ref?: string | null;
  /** Wert bei source = "constant". */
  value?: string | number | null;
  label?: string | null;
}

export type CalcOutputTarget =
  | "form_field"
  | "system"
  | "process"
  | "report"
  | "next_process";

export const CALC_OUTPUT_TARGETS: { value: CalcOutputTarget; label: string }[] = [
  { value: "form_field", label: "Formularfeld" },
  { value: "system", label: "Systemvariable" },
  { value: "process", label: "Prozessvariable" },
  { value: "report", label: "Bericht" },
  { value: "next_process", label: "Folgeprozess" },
];

export interface CalcOutputBinding {
  target: CalcOutputTarget;
  /** Schlüssel der Zielvariable, z.B. "benoetigte_bauteile". */
  ref: string;
  label?: string | null;
}

/** Datenquellen zur Auflösung der Eingangsvariablen. */
export interface CalculationEnvironment {
  /** Aktuelle Formularwerte (Feldschlüssel -> Wert, ggf. Array). */
  formValues?: Record<string, unknown>;
  /** Systemvariablen inkl. Stammdaten-Tokens (Punkt-Notation). */
  systemVariables?: Record<string, unknown>;
  /** Alle bekannten Berechnungen für verkettete Auswertung. */
  calculations?: GlobalCalculation[];
}

export function parseInputBindings(raw: unknown): CalcInputBinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is CalcInputBinding => !!b && typeof b === "object" && typeof (b as any).variable === "string")
    .map((b) => ({ ...b, source: (b.source ?? "form_field") as CalcInputSource }));
}

export function parseOutputBinding(raw: unknown): CalcOutputBinding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as any;
  if (!o.ref) return null;
  return { target: (o.target ?? "form_field") as CalcOutputTarget, ref: String(o.ref), label: o.label ?? null };
}

function normalizeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.includes(";")) return v.split(";").map((s) => s.trim()).filter(Boolean);
  return v;
}

/** Löst eine einzelne Eingangsvariable gegen die Datenquellen auf. */
export function resolveBinding(
  binding: CalcInputBinding,
  env: CalculationEnvironment,
  seen: string[] = []
): unknown {
  switch (binding.source) {
    case "constant":
      return binding.value ?? null;
    case "form_field":
      return normalizeValue(env.formValues?.[binding.ref ?? ""]);
    case "system":
    case "master_data":
      return normalizeValue(
        env.systemVariables?.[binding.ref ?? ""] ?? env.formValues?.[binding.ref ?? ""]
      );
    case "calculation": {
      const key = binding.ref ?? "";
      if (!key || seen.includes(key)) return null;
      const calc = env.calculations?.find((c) => c.calc_key === key);
      if (!calc) return null;
      return runCalculation(calc, env, [...seen, key]).value;
    }
    default:
      return null;
  }
}

export interface CalculationRunResult {
  value: number | null;
  error: string | null;
  /** Aufgelöste Eingangswerte – hilfreich für Test & Debug. */
  inputs: Record<string, unknown>;
  output: CalcOutputBinding | null;
}

/** Führt eine vollständige Berechnungsdefinition aus. */
export function runCalculation(
  calc: Pick<GlobalCalculation, "formula" | "calc_key"> & {
    input_bindings?: unknown;
    output_binding?: unknown;
  },
  env: CalculationEnvironment,
  seen: string[] = []
): CalculationRunResult {
  const bindings = parseInputBindings(calc.input_bindings);
  const inputs: Record<string, unknown> = {};
  for (const b of bindings) {
    inputs[b.variable] = resolveBinding(b, env, seen);
  }
  const ctx: Record<string, unknown> = { ...(env.systemVariables ?? {}), ...(env.formValues ?? {}), ...inputs };
  const res = evaluateFormula(calc.formula, ctx);
  return { value: res.value, error: res.error, inputs, output: parseOutputBinding(calc.output_binding) };
}

/**
 * Wendet alle Berechnungen an, deren Ausgabe auf ein Formularfeld zielt,
 * und liefert die zu setzenden Feldwerte zurück.
 */
export function applyCalculationOutputs(
  calcs: GlobalCalculation[],
  env: CalculationEnvironment
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of calcs) {
    const r = runCalculation(c, { ...env, calculations: calcs });
    if (r.output?.target === "form_field" && r.value != null && !r.error) {
      out[r.output.ref] = r.value;
    }
  }
  return out;
}
