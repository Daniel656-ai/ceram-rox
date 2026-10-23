import { describe, expect, it } from "vitest";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import { containerLayout, eligibleLocalReferences, evaluateScopedEntry, updateScopedContainer, newTemperatureEntry, duplicateScopedEntry } from "@/lib/scopedMeasurementValues";
import { normalizeRepeaterLayout } from "@/lib/repeaterLayout";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";

const field = (id: string, key: string, type = "decimal", metadata = {}): FormField => ({
  id, form_id: "f", field_key: key, field_type: type, metadata,
  parent_field_id: null, sort_order: 0, is_result: false,
} as FormField);
const calc = (id: string, key: string, formula: string): FormCalculation => ({
  id, form_id: "f", calc_key: key, formula, expression: [], decimals: 2, rounding: "none", is_result: false,
} as FormCalculation);
const layout = (items: unknown[]) => ({ version: 1, gap: "md", items });
const ref = (id: string, key: string) => ({ id: `p-${id}`, type: "field", field_id: id, key, value_key: key, width: 6 });
const result = { id: "p-c", type: "calculation", calc_id: "c", calc_key: "answer", value_key: "answer", width: 6 };
const block = field("b", "runs", "measurement_block", { measurement_block: { layout: layout([ref("o", "o2"), ref("t", "points")]) } });
const points = field("t", "points", "repeater", { repeater: { layout: layout([ref("temp", "temperature"), result]) } });
const fields = [block, points, field("o", "o2"), field("temp", "temperature")];
const calcs = [calc("c", "answer", "temperature * o2")];

describe("scoped local definitions", () => {
  it("retains multiple placements without copying or moving a definition", () => {
    const before = JSON.stringify(fields);
    const raw = layout([ref("o", "o2"), { ...ref("o", "o2"), id: "second" }]);
    const out = normalizeRepeaterLayout(raw, [], [], { fields, calculations: [] });
    expect(out.items).toHaveLength(2);
    expect(JSON.stringify(fields)).toBe(before);
    expect(fields[2].parent_field_id).toBeNull();
  });
  it("resolves renames by definition ID while retaining the value key", () => {
    const renamed = fields.map((f) => f.id === "temp" ? { ...f, field_key: "temperature_new" } : f);
    const newCalcs = [{ ...calcs[0], expression: [
      { type: "operand", source: "field", ref: "temperature", ref_id: "temp" },
      { type: "op", op: "*" }, { type: "operand", source: "field", ref: "o2", ref_id: "o" },
    ] } as FormCalculation];
    expect(evaluateScopedEntry(points, renamed, newCalcs, {}, { temperature: 200 }, { o2: 2 }).answer.value).toBe(400);
    expect(containerLayout(points, renamed, newCalcs).items[0]).toMatchObject({ key: "temperature_new", value_key: "temperature" });
  });
  it("drops missing IDs, without binding an unrelated same-key definition", () => {
    const out = containerLayout(points, fields.filter((f) => f.id !== "temp"), calcs);
    expect(out.items.filter((i) => i.type === "field")).toHaveLength(0);
  });
  it("preserves legacy key-only layout and duplicate calculation placements", () => {
    expect(normalizeRepeaterLayout(layout([{ id: "a", type: "field", key: "old", width: 6 }]), ["old"]).items[0]).toMatchObject({ key: "old" });
    const out = normalizeRepeaterLayout(layout([result, { ...result, id: "c2" }]), [], ["answer"], { fields, calculations: calcs });
    expect(out.items).toHaveLength(2);
  });
  it("allows only block to repeater, refusing self/cyclic/container references", () => {
    expect(eligibleLocalReferences(block, fields).map((f) => f.id)).toContain("t");
    expect(eligibleLocalReferences(points, fields).some((f) => ["b", "t"].includes(f.id))).toBe(false);
    expect(containerLayout(points, [...fields, field("other", "other", "measurement_block")], calcs).items.some((i) => i.type === "field" && i.field_id === "b")).toBe(false);
  });
});

describe("run and temperature isolation", () => {
  const a = { __instance_id: "A", o2: 2, points: [{ __instance_id: "A1", temperature: 200 }, { __instance_id: "A2", temperature: 280 }] };
  const b = { __instance_id: "B", o2: 5, points: [{ __instance_id: "B1", temperature: 200 }, { __instance_id: "B2", temperature: 350 }] };
  it("uses own temperature and own run O2 despite conflicting root values", () => {
    const out = updateScopedContainer(block, fields, calcs, { o2: 99, temperature: 99 }, [a, b]);
    expect(out[0].points).toEqual([{ __instance_id: "A1", temperature: 200, answer: 400 }, { __instance_id: "A2", temperature: 280, answer: 560 }]);
    expect(out[1].points).toEqual([{ __instance_id: "B1", temperature: 200, answer: 1000 }, { __instance_id: "B2", temperature: 350, answer: 1750 }]);
  });
  it("editing A leaves B and its historical computed values unchanged", () => {
    const out = updateScopedContainer(block, fields, calcs, {}, [{ ...a, o2: 3 }, b], [a, b]);
    expect(out[1]).toBe(b);
    expect((out[0].points as Array<Record<string, unknown>>)[0].answer).toBe(600);
  });
  it("round-trips inputs, IDs and computed values through the existing JSON format", () => {
    const out = updateScopedContainer(block, fields, calcs, {}, [a, b]);
    const restored = JSON.parse(JSON.stringify(out));
    expect(restored).toEqual(out);
    expect(restored[1].points[1]).toMatchObject({ __instance_id: "B2", temperature: 350, answer: 1750 });
  });
  it("new and duplicated points have independent stable IDs", () => {
    const p = newTemperatureEntry();
    const duplicate = duplicateScopedEntry({ ...a });
    expect(duplicate.__instance_id).not.toBe("A");
    expect((duplicate.points as Array<Record<string, unknown>>)[0].__instance_id).not.toBe("A1");
    expect(newTemperatureEntry().__instance_id).not.toBe(p.__instance_id);
  });
  it("does not redistribute a historical root temperature array", () => {
    const root = { points: [{ temperature: 200 }] };
    const out = updateScopedContainer(block, fields, calcs, root, [{ __instance_id: "A", o2: 2 }]);
    expect(out[0]).not.toHaveProperty("points");
    expect(root.points).toEqual([{ temperature: 200 }]);
  });
  it("does not add official temperature-point results", () => {
    const values = { "form:f:runs": updateScopedContainer(block, fields, calcs, {}, [a, b]) };
    const candidates = buildLinkedFormResultCandidates("f", fields, calcs, values);
    expect(candidates.filter((c) => c.official)).toHaveLength(0);
    expect(candidates.some((c) => c.key.includes("A1") || c.key.includes("B2"))).toBe(false);
  });
});

describe("scoped dependency failures", () => {
  it("parent rename aliases override conflicting historical properties", () => {
    const renamed = fields.map((f) => f.id === "o" ? { ...f, field_key: "oxygen" } : f);
    const defs = [calc("c", "answer", "temperature * oxygen")];
    const out = updateScopedContainer(block, renamed, defs, {}, [{ __instance_id: "A", o2: 2, oxygen: 99, points: [{ temperature: 200 }] }]);
    expect((out[0].points as Array<Record<string, unknown>>)[0].answer).toBe(400);
  });
  it("editing one point preserves untouched historical point results", () => {
    const old = { __instance_id: "A", o2: 2, points: [{ __instance_id: "A1", temperature: 200, answer: 400 }, { __instance_id: "A2", temperature: 280, answer: 123 }] };
    const changed = { ...old, points: [{ ...old.points[0], temperature: 250 }, old.points[1]] };
    const out = updateScopedContainer(block, fields, calcs, {}, [changed], [old]);
    expect((out[0].points as Array<Record<string, unknown>>)[0].answer).toBe(500);
    expect((out[0].points as Array<Record<string, unknown>>)[1].answer).toBe(123);
  });
  it("missing current input masks an unrelated root value; zero remains valid", () => {
    expect(evaluateScopedEntry(points, fields, calcs, { temperature: 999 }, {}, { o2: 2 }).answer.value).toBeNull();
    expect(evaluateScopedEntry(points, fields, calcs, {}, { temperature: 0 }, { o2: 2 }).answer.value).toBe(0);
  });
  it("failed upstream cannot reuse stored upstream/ downstream results", () => {
    const defs = [calc("c", "answer", "temperature / o2"), calc("d", "next", "answer * 2")];
    const out = evaluateScopedEntry(points, fields, defs, { answer: 88, next: 176 }, { temperature: 200, answer: 88 }, { o2: 0 });
    expect(out.answer.value).toBeNull();
    expect(out.next.value).toBeNull();
  });
  it("formula cycles keep their error and cannot provide stale values", () => {
    const defs = [calc("c", "answer", "next"), calc("d", "next", "answer")];
    const out = evaluateScopedEntry(points, fields, defs, { answer: 88 }, { temperature: 200 }, {});
    expect(out.answer.error).toBe("Zyklische Abhängigkeit");
    expect(out.next.value).toBeNull();
  });
});