import { describe, it, expect } from "vitest";
import { evaluateCondition, makeValueGetter } from "@/lib/ruleEvaluation";

const c = { id: "c", field_key: "rm_roh", operator: "is_not_empty" as const, value: "" };
describe("Bedingung „ist nicht leer“ mit Formularwerten", () => {
  it.each(["1", "2", "1+1", "2+1+1"])("%s löst aus und bleibt unverändert", (v) => {
    const get = makeValueGetter({ "form:F1:rm_roh": v });
    expect(get("rm_roh")).toBe(v);
    expect(evaluateCondition(c as any, get("rm_roh"))).toBe(true);
  });
  it("leer löst nicht aus", () => {
    const get = makeValueGetter({ "form:F1:rm_roh": "" });
    expect(evaluateCondition(c as any, get("rm_roh"))).toBe(false);
    expect(evaluateCondition(c as any, makeValueGetter({})("rm_roh"))).toBe(false);
  });
});
