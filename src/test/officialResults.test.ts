import { describe, expect, it } from "vitest";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";

const formId = "form-1";

const field = (key: string, label: string): FormField => ({
  id: `field-${key}`,
  form_id: formId,
  field_key: key,
  display_name: label,
  description: null,
  field_type: "decimal",
  category: null,
  unit: null,
  is_required: false,
  default_value: null,
  validation: {},
  min_value: null,
  max_value: null,
  decimal_places: 2,
  readonly: false,
  formula: null,
  select_options: [],
  ref_target: null,
  parent_field_id: null,
  sort_order: 0,
  metadata: {},
  global_field_id: null,
  binding_path: null,
  is_result: false,
  result_label: null,
  created_at: "",
  updated_at: "",
});

const average: FormCalculation = {
  id: "calc-average",
  form_id: formId,
  calc_key: "porenvolumen_mittelwert",
  display_name: "Porenvolumen (Mittelwert)",
  description: null,
  formula: "AVERAGE(porenvolumen_1, porenvolumen_2, porenvolumen_3)",
  expression: [],
  inputs: ["porenvolumen_1", "porenvolumen_2", "porenvolumen_3"],
  unit: null,
  decimals: 2,
  rounding: "round",
  result_type: "number",
  is_result: true,
  result_label: null,
  sort_order: 0,
  created_at: "",
  updated_at: "",
};

describe("official result candidates", () => {
  it("evaluates an official average while keeping its inputs internal", () => {
    const fields = [
      field("porenvolumen_1", "Porenvolumen Messung 1"),
      field("porenvolumen_2", "Porenvolumen Messung 2"),
      field("porenvolumen_3", "Porenvolumen Messung 3"),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [average], {
      [`form:${formId}:porenvolumen_1`]: 0.35,
      [`form:${formId}:porenvolumen_2`]: 0.35,
      [`form:${formId}:porenvolumen_3`]: 0.39,
    });

    const official = candidates.filter((candidate) => candidate.official);
    expect(official).toHaveLength(1);
    expect(official[0]).toMatchObject({
      key: `form:${formId}:porenvolumen_mittelwert`,
      label: "Porenvolumen (Mittelwert)",
      value: 0.36,
      kind: "calculation",
      error: null,
    });
    expect(candidates.filter((candidate) => candidate.kind === "field").every((candidate) => !candidate.official)).toBe(true);
  });
});