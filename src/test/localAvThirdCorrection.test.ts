import { describe, it, expect } from "vitest";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import { evaluateScopedEntry, legacyEntryKValueInputs, flatKValueInputs, isLocalAvPrefillField, isKValueCalc } from "@/lib/scopedMeasurementValues";
import { evaluateLocalCalculations, evaluateEntryCalculations } from "@/lib/localCalculations";
import { linkedMirrorDecision } from "@/lib/formMirrorGuard";

const field = (id: string, key: string, extra: Partial<FormField> & Record<string, unknown> = {}, form = "f") =>
  ({ id, form_id: form, field_key: key, display_name: key, field_type: "number", readonly: false, parent_field_id: null, metadata: {}, ...extra }) as unknown as FormField;
const calc = (id: string, key: string, formula: string, name = key) =>
  ({ id, form_id: "f", calc_key: key, display_name: name, formula, decimals: 2, rounding: "round" }) as unknown as FormCalculation;
const prefill = { data_source: { mode: "copy", source: { kind: "linked_form", form_id: "ag", field_key: "av_1" } } };

describe("AV third correction", () => {
  it("prefill field is editable local input; display link is not", () => {
    expect(isLocalAvPrefillField(field("a", "av_29d9", prefill) as any)).toBe(true);
    expect(isLocalAvPrefillField(field("a", "av_29d9", { data_source: { mode: "display", source: { kind: "linked_form", field_key: "av_1" } } }) as any)).toBe(false);
    expect(isLocalAvPrefillField(field("a", "av_29d9", { ...prefill, readonly: true }) as any)).toBe(false);
  });
  it("mirror never overwrites an entered local AV, but prefills an empty one", () => {
    expect(linkedMirrorDecision({ interactive: true, sameForm: false, sourcesReady: true, srcRaw: 25, ownRaw: 40, keepOwn: true }).write).toBe(false);
    expect(linkedMirrorDecision({ interactive: true, sameForm: false, sourcesReady: true, srcRaw: 25, ownRaw: null, keepOwn: true })).toEqual({ write: true, value: 25 });
    expect(linkedMirrorDecision({ interactive: true, sameForm: false, sourcesReady: true, srcRaw: 25, ownRaw: 40 }).write).toBe(true);
  });
  it("K-value identity accepts generated keys and units in names", () => {
    expect(isKValueCalc({ calc_key: "k_wert_3f2a", display_name: "K-Wert [m/h]" })).toBe(true);
    expect(isKValueCalc({ calc_key: "eta_nox", display_name: "η NOx" })).toBe(false);
  });

  const temp = field("t", "temperatur", { parent_field_id: "rep" });
  const av = field("av", "av_29d9", { parent_field_id: "rep" });
  const owner = field("rep", "punkte", { field_type: "repeater" } as any);
  const k = calc("k", "k_wert", "temperatur * av_1", "K-Wert");
  const eta = calc("e", "eta_nox", "av_1 + 1", "η NOx");
  const zz = calc("z", "zellenzahl", "av_1 * 2");

  it("legacy repeater: K uses local AV, η-NOx and zellenzahl keep requester AV1", () => {
    const entry = { temperatur: 200, av_29d9: 40 };
    const r = evaluateEntryCalculations([k, eta, zz], { av_1: 25 }, entry, ["temperatur", "av_29d9"], legacyEntryKValueInputs(owner, [temp, av], [k, eta, zz], entry));
    expect(r.k_wert.value).toBe(8000);
    expect(r.eta_nox.value).toBe(26);
    expect(r.zellenzahl.value).toBe(50);
  });
  it("legacy repeater: each row uses its own AV", () => {
    const rows = [{ temperatur: 200, av_29d9: 40 }, { temperatur: 300, av_29d9: 50 }];
    expect(rows.map((e) => evaluateEntryCalculations([k], { av_1: 25 }, e, [], legacyEntryKValueInputs(owner, [temp, av], [k], e)).k_wert.value)).toEqual([8000, 15000]);
  });
  it("legacy repeater: requester instance av_2 is never taken as local AV", () => {
    const e = { temperatur: 200, av_2: 40 };
    expect(legacyEntryKValueInputs(owner, [temp, field("x", "av_2")], [k], e)).toEqual({});
  });
  it("flat form: k_wert_n uses av_n, k_wert_1 and η-NOx use av_1", () => {
    const fields = [field("1", "av_1"), field("2", "av_2"), field("3", "temperatur_1"), field("4", "temperatur_2")];
    const calcs = [calc("k1", "k_wert_1", "temperatur_1 * av_1"), calc("k2", "k_wert_2", "temperatur_2 * av_1"), eta];
    const vals = { av_1: 25, av_2: 40, temperatur_1: 200, temperatur_2: 200 };
    const r = evaluateLocalCalculations(calcs, vals, Object.keys(vals), flatKValueInputs(fields, calcs, vals));
    expect([r.k_wert_1.value, r.k_wert_2.value, r.eta_nox.value]).toEqual([5000, 8000, 26]);
    expect(vals.av_1).toBe(25);
  });
  it("managed repeater: requester-only evaluation available for historical integrity check", () => {
    const layout = { version: 1, gap: "md", items: [
      { id: "p1", type: "field", field_id: "t", key: "temperatur", width: 6 },
      { id: "p2", type: "field", field_id: "av", key: "av_29d9", width: 6 },
      { id: "p3", type: "calculation", calc_id: "k", calc_key: "k_wert", width: 6 }] };
    const o = field("rep", "punkte", { field_type: "repeater", metadata: { repeater: { layout } } } as any);
    const all = [o, temp, av];
    const e = { temperatur: 200, av_29d9: 40 };
    expect(evaluateScopedEntry(o, all, [k], { av_1: 25 }, e).k_wert.value).toBe(8000);
    expect(evaluateScopedEntry(o, all, [k], { av_1: 25 }, e, {}, false).k_wert.value).toBe(5000);
  });
});
