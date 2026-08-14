import type { FormCalculation } from "@/lib/api/formCalculations";
import type { FormField } from "@/lib/api/formFields";
import type { ServiceDataField } from "@/lib/api/serviceDesigner";
import { evaluateLocalCalculations } from "@/lib/localCalculations";
import { evaluateFormula } from "@/lib/formulaEngine";

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

/**
 * Builds the snapshot for the classic service form. Computed fields can depend
 * on other computed fields, so evaluation is repeated until no value changes.
 */
export function buildServiceResultCandidates(
  fields: ServiceDataField[],
  taskValues: Record<string, unknown>,
): OfficialResultCandidate[] {
  const resolved: Record<string, unknown> = { ...taskValues };
  const computed = fields.filter((field) => field.field_type === "computed" && !field.archived);
  const errors = new Map<string, string | null>();

  for (let pass = 0; pass < Math.max(1, computed.length); pass += 1) {
    let changed = false;
    for (const field of computed) {
      const formula = typeof field.validation?.formula === "string"
        ? field.validation.formula
        : "";
      if (!formula.trim()) continue;
      const result = evaluateFormula(formula, resolved, {
        knownReferences: fields.map((candidate) => candidate.field_key),
      });
      errors.set(field.field_key, result.error);
      if (result.value == null || result.error) continue;
      const value = typeof field.decimal_places === "number" && field.decimal_places >= 0
        ? Number(result.value.toFixed(field.decimal_places))
        : result.value;
      if (resolved[field.field_key] !== value) {
        resolved[field.field_key] = value;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return fields
    .filter((field) => !field.archived)
    .map((field) => ({
      key: field.field_key,
      label: field.result_label || field.display_name || field.field_key,
      value: resolved[field.field_key],
      official: field.is_result === true,
      kind: field.field_type === "computed" ? "calculation" as const : "field" as const,
      error: field.field_type === "computed" ? errors.get(field.field_key) ?? null : null,
    }));
}
