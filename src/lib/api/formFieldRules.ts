import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Phase 4: Feldregeln ("Wenn … dann …").
 * Rein ergänzend – Formulare ohne Regeln verhalten sich unverändert.
 */

export type RuleOperator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "empty" | "not_empty" | "truthy" | "falsy" | "in";

export type RuleSource = "field" | "status" | "role";

export interface RuleCondition {
  source: RuleSource;
  /** field_key bei source="field", sonst z.B. "order_status" */
  field_key: string;
  op: RuleOperator;
  value?: string | number | boolean | null;
}

export interface RuleConditionGroup {
  logic: "and" | "or";
  conditions: RuleCondition[];
}

export type RuleAction = "show" | "hide" | "require" | "optional" | "readonly" | "editable";

export const RULE_ACTIONS: { value: RuleAction; label: string }[] = [
  { value: "show", label: "Feld anzeigen" },
  { value: "hide", label: "Feld ausblenden" },
  { value: "require", label: "Feld zum Pflichtfeld machen" },
  { value: "optional", label: "Pflicht aufheben" },
  { value: "readonly", label: "Nur lesbar setzen" },
  { value: "editable", label: "Bearbeitbar freigeben" },
];

export const RULE_OPERATORS: { value: RuleOperator; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "ist gleich", needsValue: true },
  { value: "neq", label: "ist ungleich", needsValue: true },
  { value: "gt", label: "größer als", needsValue: true },
  { value: "gte", label: "größer oder gleich", needsValue: true },
  { value: "lt", label: "kleiner als", needsValue: true },
  { value: "lte", label: "kleiner oder gleich", needsValue: true },
  { value: "contains", label: "enthält", needsValue: true },
  { value: "in", label: "ist eine von (Komma-Liste)", needsValue: true },
  { value: "empty", label: "ist leer", needsValue: false },
  { value: "not_empty", label: "ist ausgefüllt", needsValue: false },
  { value: "truthy", label: "ist aktiviert", needsValue: false },
  { value: "falsy", label: "ist deaktiviert", needsValue: false },
];

export interface FormFieldRule {
  id: string;
  form_definition_id: string;
  name: string;
  is_active: boolean;
  condition: RuleConditionGroup;
  action: RuleAction;
  target_field_ids: string[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const emptyRuleCondition = (): RuleConditionGroup => ({ logic: "and", conditions: [] });

export const formFieldRules = {
  listForForm: (formId: string) =>
    unwrap(
      dbClient
        .from("form_field_rules" as any)
        .select("*")
        .eq("form_definition_id", formId)
        .order("sort_order")
        .order("created_at")
    ) as unknown as Promise<FormFieldRule[]>,

  create: (input: Partial<FormFieldRule> & { form_definition_id: string }) =>
    unwrap(
      dbClient.from("form_field_rules" as any).insert(input as any).select().single()
    ) as unknown as Promise<FormFieldRule>,

  update: (id: string, updates: Partial<FormFieldRule>) =>
    run(dbClient.from("form_field_rules" as any).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("form_field_rules" as any).delete().eq("id", id)),
};
