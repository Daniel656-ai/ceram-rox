import { describe, it, expect } from "vitest";
import { buildM3SampleNumber, planM3Samples } from "@/lib/m3List/sampleNumber";

const none = { rowIndices: [], status: "none" as const };
const rows = [{ element_number: "00010" }, { element_number: "00020" }, { element_number: "00030" }];

describe("m³-Beprobung: Probennummern", () => {
  it("0020-6047-125-0998 + 00042 → 0020-6047-00042", () => {
    expect(buildM3SampleNumber("0020-6047-125-0998", "00042")).toBe("0020-6047-00042");
  });
  it("führende Nullen bleiben erhalten", () => {
    expect(buildM3SampleNumber("0020-6047-125-0998", "00005")).toMatch(/-00005$/);
  });
  it("eine Zeile ohne TEST → eine Probe", () => {
    expect(planM3Samples("0020-6047-125-0998", [rows[0]], none)).toHaveLength(1);
  });
  it("drei Zeilen ohne TEST → drei Proben", () => {
    expect(planM3Samples("0020-6047-125-0998", rows, none).map((p) => p.sampleNumber)).toEqual([
      "0020-6047-00010", "0020-6047-00020", "0020-6047-00030",
    ]);
  });
  it("nur Zeile 2 als TEST → nur eine Probe für Zeile 2", () => {
    const plan = planM3Samples("0020-6047-125-0998", rows, { rowIndices: [1], status: "ok" });
    expect(plan.map((p) => p.sampleNumber)).toEqual(["0020-6047-00020"]);
  });
  it("Doppelte Elementnummer im Vorgang wird abgelehnt", () => {
    expect(() => planM3Samples("0020-6047-125-0998", [rows[0], rows[0]], none)).toThrow(/doppelt/);
  });
  it("mehrdeutige TEST-Markierung fällt nicht auf alle Zeilen zurück", () => {
    expect(() => planM3Samples("0020-6047-125-0998", rows, { rowIndices: [], status: "ambiguous" })).toThrow();
  });
  it("fehlende Artikelnummer wird abgelehnt", () => {
    expect(() => buildM3SampleNumber("", "00001")).toThrow();
  });
});
