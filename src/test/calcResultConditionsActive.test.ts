import { describe, expect, it } from "vitest";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";

const formId = "f";
const p = `form:${formId}:`;

const field = (key: string): FormField => ({
  id: `id-${key}`, form_id: formId, field_key: key, display_name: key, description: null,
  field_type: "decimal", category: null, unit: null, is_required: false, default_value: null,
  validation: {}, min_value: null, max_value: null, decimal_places: 2, readonly: false,
  formula: null, select_options: [], ref_target: null, parent_field_id: null, sort_order: 0,
  metadata: {}, global_field_id: null, binding_path: null, is_result: false, result_label: null,
  created_at: "", updated_at: "",
});

const calc = (key: string, isResult: boolean, conditions?: string[]): FormCalculation => ({
  id: `c-${key}`, form_id: formId, calc_key: key, display_name: key, description: null,
  formula: "x * 2", expression: [], inputs: ["x"], unit: null, decimals: 2, rounding: "round",
  result_type: "number", is_result: isResult, result_label: null, sort_order: 0,
  created_at: "", updated_at: "",
  ...(conditions ? { metadata: { result_conditions: conditions } } : {}),
} as any);

const fields = ["x", "t1", "t2", "druck1"].map(field);
const official = (c: FormCalculation, values: Record<string, unknown>) =>
  buildLinkedFormResultCandidates(formId, fields, [c], values)
    .find((r) => r.kind === "calculation")!.official;

describe("result_conditions activate official calculations", () => {
  it("1: is_result without conditions stays official", () => {
    expect(official(calc("r", true), { [`${p}x`]: 1 })).toBe(true);
  });
  it("2: not is_result is not official", () => {
    expect(official(calc("r", false), { [`${p}x`]: 1 })).toBe(false);
  });
  it("3: filled condition → official", () => {
    expect(official(calc("r", true, ["t1"]), { [`${p}x`]: 1, [`${p}t1`]: 300 })).toBe(true);
  });
  it("4: empty condition → inactive", () => {
    expect(official(calc("r", true, ["t1"]), { [`${p}x`]: 1, [`${p}t1`]: "" })).toBe(false);
    expect(official(calc("r", true, ["t1"]), { [`${p}x`]: 1 })).toBe(false);
  });
  it("5: all conditions filled → official", () => {
    expect(official(calc("r", true, ["t1", "druck1"]), { [`${p}t1`]: 300, [`${p}druck1`]: 2 })).toBe(true);
  });
  it("6: one condition missing → inactive", () => {
    expect(official(calc("r", true, ["t1", "druck1"]), { [`${p}t1`]: 300 })).toBe(false);
  });
  it("7: 0 is a valid value", () => {
    expect(official(calc("r", true, ["t1"]), { [`${p}t1`]: 0 })).toBe(true);
  });
  it("8: value handed over into the form counts as filled", () => {
    // Übergabelogik legt Werte unter dem Formularschlüssel ab.
    expect(official(calc("r", true, ["t2"]), { [`${p}t2`]: "450" })).toBe(true);
  });
  it("NOx: only T1 active when only t1 is filled", () => {
    const calcs = ["t1", "t2", "t3"].map((t) => calc(`eta_${t}`, true, [t]));
    const res = buildLinkedFormResultCandidates(formId, fields, calcs, { [`${p}t1`]: 300, [`${p}x`]: 1 });
    expect(res.filter((r) => r.kind === "calculation" && r.official).map((r) => r.key)).toEqual([`${p}eta_t1`]);
  });
});
