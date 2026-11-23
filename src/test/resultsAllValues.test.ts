import { describe, it, expect } from "vitest";
import { buildChartSources, collectNumericParameters } from "@/lib/resultsChartData";
import { resultForColumn } from "@/lib/resultSchema";
import type { ResultRecord } from "@/hooks/useResultsDatabase";

const out = (label: string, value: number, official: boolean) => ({
  id: `${label}-${official}`, result_name: `form:x:${label}`, value, unit: null, temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: label, is_official: official,
});
const record = (outputResults: ResultRecord["outputResults"]): ResultRecord =>
  ({
    measurementId: "m1", measurementNumber: "M1", orderId: "o1", orderNumber: "A1", orderType: "x", projectNumber: "", projectName: "",
    sampleId: "s1", sampleNumber: "P1", sampleName: "", originalSampleNumber: null, serviceName: "DIL", serviceCategory: "",
    assignedToId: null, assignedToName: "", createdById: "", createdByName: "", status: "completed", completedAt: null, createdAt: "",
    actualDurationHours: null, standardDurationHours: 0, inputParameters: {}, outputResults, remarks: "",
  }) as unknown as ResultRecord;

describe("Ergebnisdatenbank zeigt offizielle und vorläufige Werte", () => {
  it("Diagrammquellen und Parameterliste enthalten vorläufige Werte", () => {
    const r = record([out("Dehnung", 1.5, false)]);
    expect(buildChartSources([r])[0].values["Dehnung"]).toBe(1.5);
    expect(collectNumericParameters([r]).map((p) => p.key)).toContain("Dehnung");
  });
  it("offizieller Wert hat Vorrang vor vorläufigem mit gleicher Bezeichnung", () => {
    const r = record([out("Dehnung", 9, false), out("Dehnung", 2, true), out("Dehnung", 7, false)]);
    expect(buildChartSources([r])[0].values["Dehnung"]).toBe(2);
    expect(resultForColumn(r, "Dehnung")?.value).toBe(2);
  });
});
