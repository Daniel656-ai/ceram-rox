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
import { isLinkedField } from "@/lib/fieldLinks";

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
  values: Record<string, unknown>,
  /** Feldschlüssel des Formulars – auch ohne Wert gültige Eingangsgrößen. */
  knownFieldKeys: Iterable<string> = []
): Record<string, LocalCalcResult> {
  const { ordered, cyclic } = orderCalculations(calcs);
  const out: Record<string, LocalCalcResult> = {};
  const ctx: Record<string, unknown> = { ...values };
  const known = new Set<string>([
    ...Object.keys(values ?? {}),
    ...knownFieldKeys,
    ...calcs.map((c) => c.calc_key),
  ]);

  for (const key of cyclic) {
    out[key] = { value: null, error: "Zyklische Abhängigkeit" };
  }

  for (const c of ordered) {
    if (!c.formula?.trim()) {
      out[c.calc_key] = { value: null, error: null };
      continue;
    }
    const res = evaluateFormula(c.formula, ctx, { knownReferences: known });
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

/**
 * Kann ein Feld als Eingangsgröße einer Berechnung dienen?
 * Zusätzlich zu den numerischen Feldtypen gelten auch verknüpfte Felder
 * (Wertquelle aus demselben Formular oder aus einer vorangegangenen
 * Dienstleistung) als rechenbar – ihr Wert wird zur Laufzeit aufgelöst.
 */
export function isCalcInputFieldDef(
  field: { field_type: string; data_source?: unknown },
): boolean {
  return isCalcInputField(field.field_type) || isLinkedField(field);
}

/* -------------------------------------------------------------
 * Messreihen: Berechnungen je Eintrag (Messpunkt)
 * -----------------------------------------------------------
 * Es gibt bewusst KEINE zweite Berechnungsstruktur. Dieselben lokalen
 * Berechnungen (`form_calculations`) werden lediglich in einem anderen
 * Scope ausgewertet: Werte des aktuellen Eintrags überlagern die
 * Formularwerte. Dadurch bedeutet `Temperatur` innerhalb eines
 * Messpunktes automatisch `current.Temperatur` — ohne Vermischung
 * zwischen den Messpunkten.
 */

/** Metaschlüssel eines Eintrags (z. B. `__instance_id`) sind keine Rechengrößen. */
const isEntryMetaKey = (k: string) => k.startsWith("__");

/** Scope eines Messpunktes: Formularwerte, überlagert von Eintragswerten. */
export function mergeEntryScope(
  rootValues: Record<string, unknown> | undefined,
  entry: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(rootValues ?? {}) };
  for (const [k, v] of Object.entries(entry ?? {})) {
    if (isEntryMetaKey(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Wertet die Berechnungen für genau einen Messpunkt aus. Fehlt eine
 * Eingangsgröße, bleibt das Ergebnis `null` („nicht berechenbar“) – es wird
 * niemals 0 angenommen.
 */
export function evaluateEntryCalculations(
  calcs: FormCalculation[],
  rootValues: Record<string, unknown> | undefined,
  entry: Record<string, unknown> | undefined,
  knownFieldKeys: Iterable<string> = [],
): Record<string, LocalCalcResult> {
  return evaluateLocalCalculations(calcs, mergeEntryScope(rootValues, entry), knownFieldKeys);
}

/**
 * Ermittelt die Berechnungen, die sich fachlich auf einen Messpunkt beziehen:
 * alle Berechnungen, die (direkt oder über andere Berechnungen) mindestens ein
 * Unterfeld der Messreihe verwenden. Nur diese Ergebnisse werden je Messpunkt
 * gespeichert – formularweite Berechnungen bleiben unverändert.
 */
export function seriesCalculations(
  calcs: FormCalculation[],
  childKeys: string[],
): FormCalculation[] {
  const child = new Set(childKeys);
  const selected = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of calcs) {
      if (selected.has(c.calc_key)) continue;
      const refs = extractReferences(c.formula || "");
      if (refs.some((r) => child.has(r) || selected.has(r))) {
        selected.add(c.calc_key);
        changed = true;
      }
    }
  }
  return calcs.filter((c) => selected.has(c.calc_key));
}
