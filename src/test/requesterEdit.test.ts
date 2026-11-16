import { describe, it, expect } from "vitest";
import { buildRequesterParameterRows, diffRequesterParameters, planServiceChanges, AmbiguousParameterError } from "@/lib/orders/requesterEdit";

const parse = (k: string) => (k.startsWith("form:") ? { formId: k.split(":")[1], fieldKey: k.split(":")[2] } : null);

describe("requester order edit", () => {
  it("keeps unchanged services, removes deselected ones, adds new ones", () => {
    const r = planServiceChanges({ a: ["m1", "m2"], b: ["m3"] }, ["a", "c"]);
    expect(r.kept).toEqual(["a"]);
    expect(r.removedMeasurementIds).toEqual(["m3"]);
    expect(r.addedUids).toEqual(["c"]);
  });

  it("changes only edited specs and leaves unchanged ones untouched", () => {
    const existing = [{ id: "p1", parameter_name: "Temp", parameter_value: "20" }, { id: "p2", parameter_name: "Dauer", parameter_value: "5" }];
    const base = [{ name: "Temp", value: "20", unit: null }, { name: "Dauer", value: "5", unit: null }];
    const next = [{ name: "Temp", value: "25", unit: null }, { name: "Dauer", value: "5", unit: null }];
    expect(diffRequesterParameters(existing, base, next)).toEqual({ amend: [{ id: "p1", name: "Temp", value: "25" }], insert: [] });
  });

  it("inserts new specs and clears removed ones", () => {
    const existing = [{ id: "p1", parameter_name: "Temp", parameter_value: "20" }];
    const r = diffRequesterParameters(existing, [{ name: "Temp", value: "20", unit: null }], [{ name: "Neu", value: "x", unit: "mm" }]);
    expect(r.insert).toEqual([{ name: "Neu", value: "x", unit: "mm" }]);
    expect(r.amend).toEqual([{ id: "p1", name: "Temp", value: "" }]);
  });

  it("never touches specs that did not come from the form", () => {
    const existing = [{ id: "p9", parameter_name: "Fremd", parameter_value: "1" }];
    expect(diffRequesterParameters(existing, [], [])).toEqual({ amend: [], insert: [] });
  });

  it("refuses to change ambiguous duplicate specs", () => {
    const existing = [{ id: "a", parameter_name: "T", parameter_value: "1" }, { id: "b", parameter_name: "T", parameter_value: "2" }];
    expect(() => diffRequesterParameters(existing, [], [{ name: "T", value: "3", unit: null }])).toThrow(AmbiguousParameterError);
  });

  it("builds spec rows like order creation (labels, booleans, linked forms, no uploads)", () => {
    const rows = buildRequesterParameterRows({
      formValues: { temp: 20, ok: true, leer: "", "form:F1:x": "7", datei: [{ __id: "1", storagePath: "a" }] },
      params: { d1: "abc" },
      fields: [{ field_key: "temp", display_name: "Temperatur", unit: "°C" }, { field_key: "datei", field_type: "file" }],
      legacyDefs: [{ id: "d1", parameter_name: "Alt" }],
      linkedFields: { F1: [{ field_key: "x", display_name: "X-Wert" }] },
      parseLinkedKey: parse,
    });
    expect(rows).toEqual([
      { name: "Alt", value: "abc", unit: null },
      { name: "Temperatur", value: "20", unit: "°C" },
      { name: "ok", value: "true", unit: null },
      { name: "X-Wert", value: "7", unit: null },
    ]);
  });
});
