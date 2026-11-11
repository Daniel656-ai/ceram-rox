import { describe, expect, it, vi } from "vitest";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import { evaluateScopedEntry, updateScopedContainer, resolveLocalAvField, storedMatchesLive, parseControlledNumber, DEFAULT_RESULT_DECIMALS } from "@/lib/scopedMeasurementValues";

const field = (id: string, key: string, extra: Partial<FormField> & { data_source?: unknown } = {}, form = "mdl"): FormField =>
  ({ id, form_id: form, field_key: key, field_type: "decimal", metadata: {}, parent_field_id: null, sort_order: 0, is_result: false, ...extra } as FormField);
const calc = (id: string, key: string, formula: string, display = key): FormCalculation =>
  ({ id, form_id: "mdl", calc_key: key, display_name: display, formula, expression: [], decimals: 2, rounding: "none", is_result: false } as FormCalculation);
const layout = (items: unknown[]) => ({ version: 1, gap: "md", items });
const ref = (id: string, key: string, value_key = key) => ({ id: `p-${id}`, type: "field", field_id: id, key, value_key, width: 6 });
const cref = (id: string, key: string, value_key = key) => ({ id: `p-${id}`, type: "calculation", calc_id: id, calc_key: key, value_key, width: 6 });
const prefill = { data_source: { mode: "copy", source: { kind: "linked_form", form_id: "ag", field_key: "av_1" } } };

// Requester AV1 lives in a DIFFERENT form than the repeater.
const requesterAv = field("ag-av1", "av_1", {}, "ag");
const temp = field("temp", "temperatur");
const localAv = field("loc", "av_29d9", prefill);
const kCalcs = [calc("k1", "k_wert_1", "temperatur * av_1", "K-Wert 1"), calc("k2", "k_wert_2", "temperatur * av1 / 2", "K-Wert 2")];
const other = calc("o", "eta_nox", "av_1 + 1", "η NOx");
const repeater = (items: unknown[]) => field("rep", "punkte", { field_type: "repeater", metadata: { repeater: { layout: layout(items) } } } as Partial<FormField>);
const owner = repeater([ref("temp", "temperatur"), ref("loc", "av_29d9", "av_ist"), cref("k1", "k_wert_1"), cref("k2", "k_wert_2"), cref("o", "eta_nox")]);
const all = [requesterAv, owner, temp, localAv];
const defs = [...kCalcs, other];
const root = { av_1: 25, av1: 25 };
const rows = [
  { __instance_id: "T1", temperatur: 200, av_ist: 40 },
  { __instance_id: "T2", temperatur: 280, av_ist: 50 },
  { __instance_id: "T3", temperatur: 360, av_ist: 60 },
];

describe("AV identity", () => {
  it("1. new form: requester AV1=25 in other form, local prefilled AV=40 is used", () => {
    const r = evaluateScopedEntry(owner, all, defs, root, rows[0]);
    expect(r.k_wert_1.value).toBe(8000);
    expect(r.k_wert_2.value).toBe(4000);
    expect(root.av_1).toBe(25);
  });
  it("2./9-legacy: existing order with exact unlinked key 'av' keeps working", () => {
    const legacyAv = field("lav", "av");
    const o = repeater([ref("temp", "temperatur"), ref("lav", "av"), cref("k1", "k_wert_1")]);
    expect(evaluateScopedEntry(o, [requesterAv, o, temp, legacyAv], kCalcs, root, { temperatur: 200, av: 40 }).k_wert_1.value).toBe(8000);
  });
  it("3. linked but editable (copy) field resolves via data_source", () => {
    expect(resolveLocalAvField(owner, all, defs)).toMatchObject({ status: "ok", via: "data_source" });
  });
  it("4. readonly or display-linked AV is never overridden", () => {
    const ro = all.map((f) => f.id === "loc" ? { ...f, readonly: true } : f);
    expect(evaluateScopedEntry(owner, ro, defs, root, rows[0]).k_wert_1.value).toBe(5000);
    const disp = all.map((f) => f.id === "loc" ? { ...f, data_source: { mode: "display", source: { kind: "form_field", field_key: "av_1" } } } : f);
    expect(evaluateScopedEntry(owner, disp, defs, root, rows[0]).k_wert_1.value).toBe(5000);
  });
  it("display name 'AV' or prefix 'av*' alone never qualifies", () => {
    const named = field("n", "av_ist", { display_name: "AV" } as Partial<FormField>);
    const o = repeater([ref("temp", "temperatur"), ref("n", "av_ist"), cref("k1", "k_wert_1")]);
    expect(resolveLocalAvField(o, [requesterAv, o, temp, named], kCalcs).status).toBe("none");
    expect(evaluateScopedEntry(o, [requesterAv, o, temp, named], kCalcs, root, { temperatur: 200, av_ist: 40 }).k_wert_1.value).toBe(5000);
  });
  it("ambiguous: two prefilled AV fields -> no override, diagnosable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = field("loc2", "av_b", prefill);
    const o = repeater([ref("temp", "temperatur"), ref("loc", "av_29d9", "av_ist"), ref("loc2", "av_b"), cref("k1", "k_wert_1")]);
    const fs = [requesterAv, o, temp, localAv, second];
    expect(resolveLocalAvField(o, fs, kCalcs)).toEqual({ status: "ambiguous", candidates: ["loc", "loc2"] });
    expect(evaluateScopedEntry(o, fs, kCalcs, root, rows[0]).k_wert_1.value).toBe(5000);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("rows and other calculations", () => {
  it("5. three rows 40/50/60 compute each K with their own AV (k_wert_1 and k_wert_2)", () => {
    const out = updateScopedContainer(owner, all, defs, root, rows);
    expect(out.map((r) => r.k_wert_1)).toEqual([8000, 14000, 21600]);
    expect(out.map((r) => r.k_wert_2)).toEqual([4000, 7000, 10800]);
  });
  it("6. changing only row 2 recalculates only row 2", () => {
    const saved = updateScopedContainer(owner, all, defs, root, rows);
    const out = updateScopedContainer(owner, all, defs, root, [saved[0], { ...saved[1], av_ist: 55 }, saved[2]], saved);
    expect(out[0]).toBe(saved[0]);
    expect(out[2]).toBe(saved[2]);
    expect(out[1].k_wert_1).toBe(15400);
  });
  it("10. other calculations keep requester AV1; calcs outside the container unchanged", () => {
    expect(evaluateScopedEntry(owner, all, defs, root, rows[0]).eta_nox.value).toBe(26);
    const outside = repeater([ref("temp", "temperatur"), ref("loc", "av_29d9", "av_ist")]);
    expect(evaluateScopedEntry(outside, all, defs, root, rows[0]).k_wert_1.value).toBe(5000);
  });
  it("invalid/empty/ambiguous local AV never becomes 0", () => {
    for (const v of ["", "  ", "1.234,5", "40 m/h", null, undefined]) {
      expect(evaluateScopedEntry(owner, all, defs, root, { temperatur: 200, av_ist: v }).k_wert_1.value).toBeNull();
    }
    expect(evaluateScopedEntry(owner, all, defs, root, { temperatur: 200, av_ist: "40,5" }).k_wert_1.value).toBe(8100);
  });
});

describe("integrity comparison", () => {
  it("7. historical numeric strings (dot/comma) match without being rewritten", () => {
    const entry = { k: "8000,00" };
    expect(storedMatchesLive(entry.k, 8000, 2)).toBe(true);
    expect(storedMatchesLive("8000.004", 8000, 2)).toBe(true);
    expect(entry.k).toBe("8000,00");
    expect(parseControlledNumber("")).toBeNull();
  });
  it("8. rounding differences within half the last decimal pass, larger deviations fail", () => {
    expect(storedMatchesLive(0.1 + 0.2, 0.3, 2)).toBe(true);
    expect(storedMatchesLive(12.344, 12.3449, 3)).toBe(true);
    expect(storedMatchesLive(12.34, 12.36, 2)).toBe(false);
    expect(storedMatchesLive(5000, 8000, 2)).toBe(false); // K based on AV1 vs local AV stays flagged
  });
  it("missing decimals uses the documented default", () => {
    expect(DEFAULT_RESULT_DECIMALS).toBe(2);
    expect(storedMatchesLive(1.004, 1, null)).toBe(true);
    expect(storedMatchesLive(1.006, 1, undefined)).toBe(false);
  });
  it("unparsable stored values or missing live values stay flagged", () => {
    expect(storedMatchesLive("abc", 1, 2)).toBe(false);
    expect(storedMatchesLive(1, null, 2)).toBe(false);
    expect(storedMatchesLive(undefined, null, 2)).toBe(true);
  });
});
