import { describe, it, expect } from "vitest";
import { buildM3SampleNames } from "../sampleNames";

describe("buildM3SampleNames", () => {
  it("9 Stellen Artikelnummer + Bindestrich + Elementnummer", () => {
    const r = buildM3SampleNames("0040-6129-125-0998", [{ element_number: "00340" }, { element_number: "00350" }]);
    expect(r.names).toEqual(["0040-6129-00340", "0040-6129-00350"]);
    expect(r.skippedRows).toBe(0);
  });
  it("überspringt Zeilen ohne Elementnummer", () => {
    const r = buildM3SampleNames("0040-6129-125", [{ element_number: null }, { element_number: "—" }, { element_number: "00340" }]);
    expect(r.names).toEqual(["0040-6129-00340"]);
    expect(r.skippedRows).toBe(2);
  });
  it("doppelte Namen nur einmal", () => {
    expect(buildM3SampleNames("0040-6129-1", [{ element_number: "00340" }, { element_number: "00340" }]).names).toHaveLength(1);
  });
  it("ohne Artikelnummer keine Namen", () => {
    const r = buildM3SampleNames(null, [{ element_number: "00340" }]);
    expect(r.names).toEqual([]);
    expect(r.missingArticle).toBe(true);
  });
});
