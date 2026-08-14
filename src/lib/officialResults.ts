import type { FormCalculation } from "@/lib/api/formCalculations";
import type { FormField } from "@/lib/api/formFields";
import { evaluateLocalCalculations } from "@/lib/localCalculations";

export interface OfficialResultCandidate {
  key: string;
  label: string;
  value: unknown;
  official: boolean;
  kind: "field" | "calculation";
  error?: string | null;
}

/**
 * Builds the complete, namespaced result snapshot for one linked form.
 * Calculation results are evaluated here instead of relying on a React render
 * effect, so task completion always persists the value currently shown.
 */
export function buildLinkedFormResultCandidates(
  formId: string,
  fields: FormField[],
  calculations: FormCalculation[],
  taskValues: Record<string, unknown>,
): OfficialResultCandidate[] {
  const prefix = `form:${formId}:`;
  const localValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(taskValues)) {
    if (key.startsWith(prefix)) localValues[key.slice(prefix.length)] = value;
  }

  const calculated = evaluateLocalCalculations(
    calculations,
    localValues,
    fields.map((field) => field.field_key),
  );

  return [
    ...fields.map((field) => ({
      key: `${prefix}${field.field_key}`,
      label: field.result_label || field.display_name || field.field_key,
      value: localValues[field.field_key],
      official: field.is_result === true,
      kind: "field" as const,
    })),
    ...calculations.map((calculation) => ({
      key: `${prefix}${calculation.calc_key}`,
      label: calculation.result_label || calculation.display_name || calculation.calc_key,
      value: calculated[calculation.calc_key]?.value ?? null,
      official: calculation.is_result === true,
      kind: "calculation" as const,
      error: calculated[calculation.calc_key]?.error ?? null,
    })),
  ];
}
