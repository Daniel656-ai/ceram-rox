import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Lokale Berechnungen: gehören zu genau einem Formular (form_definitions.id)
 * und greifen ausschließlich auf Felder dieses Formulars zu.
 *
 * Ergänzung zu den globalen Berechnungen (`global_calculations`), die
 * formularübergreifend bleiben und unverändert weiterverwendet werden.
 */

export type CalcOperator = "+" | "-" | "*" | "/";
export type CalcRounding = "round" | "floor" | "ceil" | "none";

/** Ein Operand im visuellen Berechnungs-Builder. */
export interface CalcOperand {
  type: "operand";
  /** field = Formularfeld dieses Formulars, calc = andere lokale Berechnung, const = fester Wert */
  source: "field" | "calc" | "const";
  /** field_key bzw. calc_key (Anzeige-/Formelreferenz) */
  ref?: string | null;
  /**
   * Stabile Referenz auf das Formularfeld (form_fields.id) bzw. die Berechnung
   * (form_calculations.id). Damit bleiben Berechnungen gültig, wenn sich der
   * technische Feldschlüssel oder die Bezeichnung ändert.
   */
  ref_id?: string | null;
  value?: number | null;
}

export interface CalcOperatorToken {
  type: "op";
  op: CalcOperator;
}

export type CalcToken = CalcOperand | CalcOperatorToken;

export interface FormCalculation {
  id: string;
  form_id: string;
  calc_key: string;
  display_name: string;
  description: string | null;
  /** Auswertbare Formel (Variablennamen = field_key / calc_key). */
  formula: string;
  /** Zustand des visuellen Builders; leer = manuell erstellte Formel. */
  expression: CalcToken[];
  /** Dokumentation der verwendeten Eingangsgrößen. */
  inputs: string[];
  unit: string | null;
  decimals: number;
  rounding: CalcRounding;
  result_type: string;
  /** Als offizielles Ergebnis der Messung in die Ergebnisdatenbank übernehmen. */
  is_result: boolean;
  /** Optionaler Anzeigename in der Ergebnisdatenbank. */
  result_label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const table = () => dbClient.from("form_calculations" as any);

export const formCalculations = {
  listForForm: (formId: string) =>
    unwrap(
      table().select("*").eq("form_id", formId).order("sort_order").order("created_at")
    ) as unknown as Promise<FormCalculation[]>,

  create: (
    input: Partial<FormCalculation> & { form_id: string; calc_key: string; display_name: string }
  ) => unwrap(table().insert(input as any).select().single()) as unknown as Promise<FormCalculation>,

  update: (id: string, updates: Partial<FormCalculation>) =>
    run(table().update(updates as any).eq("id", id)),

  remove: (id: string) => run(table().delete().eq("id", id)),
};
