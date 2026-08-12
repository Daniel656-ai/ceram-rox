/**
 * Auswertung lokaler (formularbezogener) Berechnungen.
 *
 * Baut auf der bestehenden Formel-Engine (`src/lib/formulaEngine.ts`) auf und
 * ergänzt sie um:
 *   - Formelaufbau aus dem visuellen Builder (Operanden + Operatoren)
 *   - automatische Auswertungsreihenfolge über Abhängigkeiten
 *   - Erkennung zyklischer Abhängigkeiten
 *   - Rundung / Nachkommastellen
 */

import { evaluateFormula, extractReferences } from "@/lib/formulaEngine";
import type { CalcToken, FormCalculation, CalcRounding } from "@/lib/api/formCalculations";

/** Zulässige Feldtypen als Eingangsgröße einer lokalen Berechnung. */
export const NUMERIC_FIELD_TYPES = [
  "number",
  "decimal",
  "percent",
  "computed",
] as const;

export const isCalcInputField = (fieldType: string) =>
  (NUMERIC_FIELD_TYPES as readonly string[]).includes(fieldType);

/** Erzeugt aus den Builder-Tokens eine auswertbare Formel. */
export function buildFormulaFromTokens(tokens: CalcToken[]): string {
  const parts: string[] = [];
  for (const t of tokens) {
    if (t.type === "op") {
      parts.push(t.op);
      continue;
    }
    if (t.source === "const") parts.push(String(t.value ?? 0));
    else if (t.ref) parts.push(t.ref);
  }
  return parts.join(" ").trim();
}

export function applyRounding(value: number, decimals: number, rounding: CalcRounding): number {
  const f = Math.pow(10, Math.max(0, decimals));
  switch (rounding) {
    case "floor": return Math.floor(value * f) / f;
    case "ceil": return Math.ceil(value * f) / f;
    case "none": return value;
    default: return Math.round(value * f) / f;
  }
}

/** Referenzen einer Berechnung auf andere lokale Berechnungen. */
export function calcDependencies(calc: Pick<FormCalculation, "formula">, allKeys: string[]): string[] {
  const refs = extractReferences(calc.formula || "");
  return refs.filter((r) => allKeys.includes(r));
}

export interface CalcOrderResult {
  /** Berechnungen in auswertbarer Reihenfolge. */
  ordered: FormCalculation[];
  /** calc_keys, die Teil eines Zyklus sind (werden nicht ausgewertet). */
  cyclic: string[];
}

/** Topologische Sortierung inkl. Zyklenerkennung. */
export function orderCalculations(calcs: FormCalculation[]): CalcOrderResult {
  const keys = calcs.map((c) => c.calc_key);
  const byKey = new Map(calcs.map((c) => [c.calc_key, c]));
  const state = new Map<string, 0 | 1 | 2>(); // 0 = offen, 1 = in Arbeit, 2 = fertig
  const ordered: FormCalculation[] = [];
  const cyclic = new Set<string>();

  const visit = (key: string, stack: string[]) => {
    const st = state.get(key) ?? 0;
    if (st === 2) return;
    if (st === 1) {
      // Zyklus: alle beteiligten Schlüssel markieren
      const start = stack.indexOf(key);
      stack.slice(start >= 0 ? start : 0).forEach((k) => cyclic.add(k));
      cyclic.add(key);
      return;
    }
    const calc = byKey.get(key);
    if (!calc) return;
    state.set(key, 1);
    for (const dep of calcDependencies(calc, keys)) {
      if (dep === key) { cyclic.add(key); continue; }
      visit(dep, [...stack, key]);
    }
    state.set(key, 2);
    if (!cyclic.has(key)) ordered.push(calc);
  };

  for (const c of calcs) visit(c.calc_key, []);
  return { ordered: ordered.filter((c) => !cyclic.has(c.calc_key)), cyclic: [...cyclic] };
}

/** Prüft, ob eine (neue) Formel einen Zyklus erzeugen würde. */
export function wouldCreateCycle(
  calcs: FormCalculation[],
  candidate: { calc_key: string; formula: string }
): boolean {
  const others = calcs.filter((c) => c.calc_key !== candidate.calc_key);
  const merged = [...others, { ...(candidate as any), id: "draft" } as FormCalculation];
  return orderCalculations(merged).cyclic.includes(candidate.calc_key);
}

export interface LocalCalcResult {
  value: number | null;
  error: string | null;
}

/**
 * Wertet alle lokalen Berechnungen gegen die aktuellen Formularwerte aus.
 * Ergebnisse stehen nachfolgenden Berechnungen als Variable (calc_key) zur Verfügung.
 */
export function evaluateLocalCalculations(
  calcs: FormCalculation[],
  values: Record<string, unknown>
): Record<string, LocalCalcResult> {
  const { ordered, cyclic } = orderCalculations(calcs);
  const out: Record<string, LocalCalcResult> = {};
  const ctx: Record<string, unknown> = { ...values };

  for (const key of cyclic) {
    out[key] = { value: null, error: "Zyklische Abhängigkeit" };
  }

  for (const c of ordered) {
    if (!c.formula?.trim()) {
      out[c.calc_key] = { value: null, error: null };
      continue;
    }
    const res = evaluateFormula(c.formula, ctx);
    const value = res.value == null || res.error
      ? null
      : applyRounding(res.value, c.decimals ?? 2, (c.rounding as CalcRounding) ?? "round");
    out[c.calc_key] = { value, error: res.error };
    if (value != null) ctx[c.calc_key] = value;
  }
  return out;
}

/** Formatiert ein Ergebnis für die Anzeige (de-AT, feste Nachkommastellen). */
export function formatCalcResult(value: number | null, decimals: number, unit?: string | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const txt = value.toLocaleString("de-AT", {
    minimumFractionDigits: Math.max(0, decimals),
    maximumFractionDigits: Math.max(0, decimals),
  });
  return unit ? `${txt} ${unit}` : txt;
}
