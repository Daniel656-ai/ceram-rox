import { describe, it, expect } from "vitest";
import { evaluateCondition, makeValueGetter, planRuleTriggers } from "@/lib/ruleEvaluation";

const c = (op: any) => ({ id: "c", field_key: "rohstoffe.rm_roh", operator: op, value: "" }) as any;
const vals = (rows: any[]) => ({ "form:F1:rohstoffe": rows });

describe("Regeln auf Repeater-Unterfeldern", () => {
  it.each(["1", "2", "1+1", "2+1+1"])("%s → nicht leer", (v) => {
    expect(evaluateCondition(c("is_not_empty"), makeValueGetter(vals([{ rm_roh: v }]))("rohstoffe.rm_roh"))).toBe(true);
  });
  it("leer → false", () => {
    expect(evaluateCondition(c("is_not_empty"), makeValueGetter(vals([{ rm_roh: "" }]))("rohstoffe.rm_roh"))).toBe(false);
  });
  it("eine von mehreren Zeilen gefüllt → true", () => {
    const g = makeValueGetter(vals([{ rm_roh: "" }, { rm_roh: "1+1" }, {}]));
    expect(evaluateCondition(c("is_not_empty"), g("rohstoffe.rm_roh"))).toBe(true);
    expect(evaluateCondition(c("is_empty"), g("rohstoffe.rm_roh"))).toBe(false);
  });
  it("alle leer → false / ist leer → true", () => {
    const g = makeValueGetter(vals([{ rm_roh: "" }, {}]));
    expect(evaluateCondition(c("is_not_empty"), g("rohstoffe.rm_roh"))).toBe(false);
    expect(evaluateCondition(c("is_empty"), g("rohstoffe.rm_roh"))).toBe(true);
  });
  it("1+1 bleibt unverändert", () => {
    const col: any = makeValueGetter(vals([{ rm_roh: "1+1" }]))("rohstoffe.rm_roh");
    expect(col.items).toEqual(["1+1"]);
  });
  it("Auslöser nutzt bestehende Duplikatlogik", () => {
    const rule: any = { id: "r", name: "", enabled: true, logic: "and", conditions: [c("is_not_empty")],
      actions: [{ id: "a", type: "trigger_service", target_service_id: "EIN" }] };
    const src = [{ key: "p1", service_id: "EXT", values: vals([{ rm_roh: "1+1" }]) }];
    const p1 = planRuleTriggers({ sources: src, rulesByService: { EXT: [rule] }, existing: [] });
    expect(p1.add).toHaveLength(1);
    const p2 = planRuleTriggers({ sources: src, rulesByService: { EXT: [rule] },
      existing: [{ key: "x", service_id: "EIN", from_rule: true, edited: false }] });
    expect(p2.add).toHaveLength(0);
  });
});
