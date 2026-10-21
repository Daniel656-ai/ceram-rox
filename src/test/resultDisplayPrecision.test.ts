import { describe, expect, it } from "vitest";
import { formatResultDisplayValue, resolveResultPrecision, type PrecisionDefinitions, type PrecisionField } from "@/lib/resultDisplayPrecision";
import { exportCell, resultCell, resultForColumn } from "@/lib/resultSchema";
import type { ResultRecord } from "@/hooks/useResultsDatabase";

const field = (overrides: Partial<PrecisionField> = {}): PrecisionField => ({
  id: "bet-field", form_id: "bet-form", field_key: "bet", decimal_places: 1,
  parent_field_id: null, field_type: "decimal", ...overrides,
});
const definitions = (overrides: Partial<PrecisionDefinitions> = {}): PrecisionDefinitions => ({
  fields: [field()], calculations: [], serviceFields: [], ...overrides,
});

describe("result display precision (read-only)", () => {
  it.each([[0, "13"], [1, "12,6"], [2, "12,60"], [4, "12,6000"]])("uses %i fixed decimal places", (precision, expected) => {
    expect(formatResultDisplayValue(12.6, null, true, precision as number)).toBe(expected);
  });
  it("keeps zero, blanks and text distinct", () => {
    expect(formatResultDisplayValue(0, null, true, 4)).toBe("0,0000");
    expect(formatResultDisplayValue(null, null, false, 1)).toBe("");
    expect(formatResultDisplayValue(null, "< 0,1", true, 1)).toBe("< 0,1");
  });
  it("uses the owning form and key, not a same-named field in another form", () => {
    const defs = definitions({ fields: [field(), field({ id: "other", form_id: "other", decimal_places: 4 })] });
    expect(resolveResultPrecision({ result_name: "form:bet-form:bet" }, "service", defs)).toBe(1);
    expect(resolveResultPrecision({ result_name: "form:other:bet" }, "service", defs)).toBe(4);
  });
  it("scopes classic fields including computed fields to their service", () => {
    const defs = definitions({ serviceFields: [
      { service_id: "one", field_key: "bet", decimal_places: 2 },
      { service_id: "two", field_key: "bet", decimal_places: 0 },
    ] });
    expect(resolveResultPrecision({ result_name: "bet" }, "one", defs)).toBe(2);
    expect(resolveResultPrecision({ result_name: "bet" }, "two", defs)).toBe(0);
    expect(resolveResultPrecision({ result_name: "bet" }, null, defs)).toBeUndefined();
  });
  it("uses decimals only for the exact calculation in the owning form", () => {
    const defs = definitions({ calculations: [{ form_id: "bet-form", calc_key: "specific", decimals: 4 }] });
    expect(resolveResultPrecision({ result_name: "form:bet-form:specific" }, "one", defs)).toBe(4);
    expect(resolveResultPrecision({ result_name: "form:other:specific" }, "one", defs)).toBeUndefined();
  });
  it("rejects colliding field and calculation identities", () => {
    const defs = definitions({ calculations: [{ form_id: "bet-form", calc_key: "bet", decimals: 1 }] });
    expect(resolveResultPrecision({ result_name: "form:bet-form:bet" }, "one", defs)).toBeUndefined();
  });
  it("resolves block children by storage key and parent, keeping instances separate", () => {
    const defs = definitions({ fields: [
      field({ id: "parent", field_type: "measurement_block", field_key: "block", metadata: { measurement_block: { storage_key: "runs" } } }),
      field({ id: "child", parent_field_id: "parent", decimal_places: 2 }),
      field({ id: "unrelated", parent_field_id: "different", decimal_places: 4 }),
    ] });
    expect(resolveResultPrecision({ result_name: "form:bet-form:runs[first].bet", instance_key: "first" }, "one", defs)).toBe(2);
    expect(resolveResultPrecision({ result_name: "form:bet-form:runs[second].bet", instance_key: "second" }, "one", defs)).toBe(2);
    expect(resolveResultPrecision({ result_name: "form:bet-form:runs[first].bet", instance_key: "second" }, "one", defs)).toBeUndefined();
    expect(resolveResultPrecision({ result_name: "form:bet-form:runs[first].element:SiO2" }, "one", defs)).toBeUndefined();
  });
  it("retains the six-place fallback for historical or missing metadata", () => {
    expect(resolveResultPrecision({ result_name: "historical" }, "one", definitions())).toBeUndefined();
    expect(resolveResultPrecision({ result_name: "form:missing:bet" }, "one", definitions())).toBeUndefined();
    expect(formatResultDisplayValue(12.12345678, null, true)).toBe("12,123457");
    expect(formatResultDisplayValue(12.6, null, true)).toBe("12,6");
  });
  it.each([null, -1, 1.5, 100, Number.NaN])("safely ignores invalid precision %s", (precision) => {
    expect(resolveResultPrecision({ result_name: "form:bet-form:bet" }, "one", definitions({ fields: [field({ decimal_places: precision })] }))).toBeUndefined();
  });
  it("leaves raw values, exports and cell lookup intact after formatting", () => {
    const result: ResultRecord["outputResults"][number] = {
      id: "result", result_name: "form:bet-form:bet", display_label: "BET", value: 12.654321,
      unit: "m²/g", temperature_range_from: null, temperature_range_to: null, temperature_unit: null,
      remarks: null, measured_at: null, is_official: true,
    };
    const record = { serviceId: "one", outputResults: [result] } as ResultRecord;
    const snapshot = JSON.stringify(record);
    const hit = resultForColumn(record, "bet");
    const cell = resultCell(record, "bet");
    expect(hit).toBe(result);
    expect(formatResultDisplayValue(cell.value, cell.text, cell.present, resolveResultPrecision(result, record.serviceId, definitions()))).toBe("12,7");
    expect(exportCell(record, "bet")).toBe(12.654321);
    expect(JSON.stringify(record)).toBe(snapshot);
  });
});