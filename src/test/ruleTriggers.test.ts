import { describe, it, expect } from "vitest";
import { planRuleTriggers, isRuleSatisfied, evaluateCondition } from "@/lib/ruleEvaluation";
import type { ServiceRule } from "@/lib/api/serviceRules";

const rule = (id: string, target = "EINL", op: any = "greater_than", value: any = "0"): ServiceRule => ({
  id, name: id, enabled: true, logic: "and",
  conditions: [{ id: "c", field_key: "rueckstellmuster", operator: op, value }],
  actions: [{ id: "a", type: "trigger_service", target_service_id: target }],
});
const rules = { EXTR: [rule("r1")] };
const src = (v: any) => [{ key: "x", service_id: "EXTR", values: v === undefined ? {} : { rueckstellmuster: v } }];
const extr = { key: "x", service_id: "EXTR", from_rule: false, edited: true };

describe("Regel-Aktion Dienstleistung auslösen", () => {
  it("1 leer → nichts", () => expect(planRuleTriggers({ sources: src(""), rulesByService: rules, existing: [extr] }).add).toHaveLength(0));
  it("2 Wert 0 → nichts", () => expect(planRuleTriggers({ sources: src(0), rulesByService: rules, existing: [extr] }).add).toHaveLength(0));
  it("3 Wert 1 → einmal", () => {
    const p = planRuleTriggers({ sources: src(1), rulesByService: rules, existing: [extr] });
    expect(p.add).toEqual([{ source_key: "x", rule_id: "r1", target_service_id: "EINL", sample_id: null }]);
  });
  const withEinl = (edited: boolean) => [extr, { key: "e", service_id: "EINL", from_rule: true, edited }];
  it("4/5/7 Wert 3 bzw. erneutes Speichern → keine zweite Position", () => {
    for (const v of [3, "3", 1]) {
      const p = planRuleTriggers({ sources: src(v), rulesByService: rules, existing: withEinl(false) });
      expect(p.add).toHaveLength(0);
      expect(p.remove).toHaveLength(0);
    }
  });
  it("6 Wechsel 0 → 1 erzeugt Position", () => {
    expect(planRuleTriggers({ sources: src(0), rulesByService: rules, existing: [extr] }).add).toHaveLength(0);
    expect(planRuleTriggers({ sources: src(1), rulesByService: rules, existing: [extr] }).add).toHaveLength(1);
  });
  it("8 Wechsel 1 → 0 unbearbeitet → entfernbar", () => {
    expect(planRuleTriggers({ sources: src(0), rulesByService: rules, existing: withEinl(false) }).remove).toEqual(["e"]);
  });
  it("9 Wechsel 1 → 0 bearbeitet → nichts löschen", () => {
    const p = planRuleTriggers({ sources: src(0), rulesByService: rules, existing: withEinl(true) });
    expect(p.remove).toHaveLength(0);
    expect(p.keep).toEqual(["e"]);
  });
  it("10 mehrere Regeln/Quellen auf dieselbe Dienstleistung → einmal", () => {
    const p = planRuleTriggers({
      sources: [...src(2), { key: "y", service_id: "EXTR", values: { rueckstellmuster: 5 } }],
      rulesByService: { EXTR: [rule("r1"), rule("r2", "EINL", "gte", "1")] },
      existing: [extr],
    });
    expect(p.add).toHaveLength(1);
  });
  it("vorhandene manuelle/abhängige Position gilt als vorhanden, wird nie entfernt", () => {
    const existing = [extr, { key: "m", service_id: "EINL", from_rule: false, edited: false }];
    expect(planRuleTriggers({ sources: src(1), rulesByService: rules, existing }).add).toHaveLength(0);
    expect(planRuleTriggers({ sources: src(0), rulesByService: rules, existing }).remove).toHaveLength(0);
  });
  it("liest Formularwert form:<Formular>:<Feld> und Komma-Zahl", () => {
    const p = planRuleTriggers({ sources: src(undefined).map((s) => ({ ...s, values: { "form:f1:rueckstellmuster": "0,5" } })), rulesByService: rules, existing: [extr] });
    expect(p.add).toHaveLength(1);
  });
  it("deaktivierte Regel löst nichts aus", () => {
    const r = { ...rule("r1"), enabled: false };
    expect(planRuleTriggers({ sources: src(3), rulesByService: { EXTR: [r] }, existing: [extr] }).add).toHaveLength(0);
  });
  it("12 bestehende Bedingungsauswertung unverändert", () => {
    expect(evaluateCondition({ id: "c", field_key: "a", operator: "equals", value: "x" }, "x")).toBe(true);
    expect(evaluateCondition({ id: "c", field_key: "a", operator: "is_empty" }, "")).toBe(true);
    expect(evaluateCondition({ id: "c", field_key: "a", operator: "in", value: "x" }, "x")).toBe(false);
    const r: ServiceRule = { ...rule("r"), logic: "or", conditions: [
      { id: "1", field_key: "a", operator: "equals", value: "1" },
      { id: "2", field_key: "b", operator: "equals", value: "2" },
    ] };
    expect(isRuleSatisfied(r, (k) => (k === "b" ? "2" : ""))).toBe(true);
  });
});
