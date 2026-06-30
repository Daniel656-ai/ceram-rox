import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type RuleOperator =
  | "equals" | "not_equals"
  | "greater_than" | "less_than" | "gte" | "lte"
  | "contains" | "not_contains"
  | "is_empty" | "is_not_empty"
  | "in" | "not_in";

export type RuleConditionLogic = "and" | "or";

export interface RuleCondition {
  id: string;
  field_key: string;
  operator: RuleOperator;
  value?: string | number | boolean | null;
}

export type RuleActionType =
  | "show_field" | "hide_field"
  | "require_field" | "optional_field"
  | "set_value" | "calculate_value"
  | "create_task" | "send_notification";

export interface RuleAction {
  id: string;
  type: RuleActionType;
  target_field_key?: string;
  value?: string | number | boolean | null;
  formula?: string;
  task_title?: string;
  task_role?: string;
  notify_role?: string;
  notify_message?: string;
}

export interface ServiceRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  logic: RuleConditionLogic;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface ServiceRulesDefinition {
  rules: ServiceRule[];
}

export interface ServiceRulesRow {
  id: string;
  service_id: string;
  definition: ServiceRulesDefinition;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceRules = {
  getForService: async (serviceId: string): Promise<ServiceRulesRow | null> => {
    const { data, error } = await dbClient
      .from("service_rules" as any)
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as ServiceRulesRow) ?? null;
  },

  upsert: (serviceId: string, definition: ServiceRulesDefinition, updatedBy: string | null) =>
    run(
      dbClient
        .from("service_rules" as any)
        .upsert(
          { service_id: serviceId, definition, updated_by: updatedBy } as any,
          { onConflict: "service_id" }
        )
    ),
};
