import { describe, expect, it } from "vitest";
import {
  parseNumericValue,
  buildChartSources,
  collectNumericParameters,
  buildChartPoints,
} from "@/lib/resultsChartData";
import type { ResultRecord } from "@/hooks/useResultsDatabase";

const rec = (sample: string, results: Array<Partial<ResultRecord["outputResults"][number]>>): ResultRecord => ({
  measurementId: `m-${sample}-${results.map(r => r.result_name).join("-")}`,
  measurementNumber: "M2600001",
  orderId: "o1",
  orderNumber: "A2600001",
  orderType: "customer",
  projectNumber: "P1",
  projectName: "Projekt",
  sampleId: `s-${sample}`,
  sampleNumber: sample,
  sampleName: "",
  originalSampleNumber: null,
  serviceName: "Dienst",
  serviceCategory: "labor",
  assignedToId: null,
  assignedToName: "",
  createdById: "u1",
  createdByName: "U",
  status: "completed",
  completedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  actualDurationHours: null,
  standardDurationHours: 1,
  inputParameters: {},
  outputResults: results.map((r, i) => ({
    id: `r${i}`,
    result_name: r.result_name ?? "x",
    value: r.value ?? null,
    unit: r.unit ?? null,
    temperature_range_from: null,
    temperature_range_to: null,
    temperature_unit: null,
    remarks: r.remarks ?? null,
    measured_at: null,
    display_label: r.display_label ?? null,
    is_official: r.is_official ?? true,
  })),
  remarks: "",
});

describe("parseNumericValue", () => {
  it("erkennt deutsche und englische Formate", () => {
    expect(parseNumericValue("42,7")).toBe(42.7);
    expect(parseNumericValue("42.7")).toBe(42.7);
    expect(parseNumericValue("42,7 %")).toBe(42.7);
    expect(parseNumericValue("1.250,5")).toBe(1250.5);
    expect(parseNumericValue(1.82)).toBe(1.82);
    expect(parseNumericValue("kein Wert")).toBeNull();
    expect(parseNumericValue(null)).toBeNull();
  });
});

describe("Diagramm-Datenbasis", () => {
  const records = [
    rec("SN-1001", [{ display_label: "Dichte", value: 1.82, unit: "g/cm³" }]),
    rec("SN-1001", [{ display_label: "Druckfestigkeit", value: 24.5 }]),
    rec("SN-1002", [{ display_label: "Dichte", value: 1.79 }, { display_label: "Druckfestigkeit", value: 22.8 }]),
    rec("SN-1003", [{ display_label: "Dichte", remarks: "1,85" , value: null }, { display_label: "Druckfestigkeit", value: 26.1 }]),
    rec("SN-1004", [{ display_label: "Bemerkung", remarks: "alles ok", value: null }, { display_label: "Dichte", value: 2, is_official: false }]),
  ];

  it("listet nur numerische offizielle Ergebnisse mit Einheit", () => {
    const params = collectNumericParameters(records);
    expect(params.map(p => p.key)).toEqual(["Dichte", "Druckfestigkeit"]);
    expect(params[0].label).toBe("Dichte – g/cm³");
  });

  it("führt Werte über die Probe zusammen, ohne Kreuzkombination", () => {
    const sources = buildChartSources(records);
    const points = buildChartPoints(sources, "Dichte", "Druckfestigkeit", "none");
    expect(points).toHaveLength(3);
    expect(points.map(p => p.x).sort()).toEqual([1.79, 1.82, 1.85]);
  });

  it("unterstützt Kategorie-Achsen für Balken/Linie", () => {
    const sources = buildChartSources(records);
    const points = buildChartPoints(sources, "__sample__", "Druckfestigkeit", "none");
    expect(points.map(p => p.x)).toEqual(["SN-1001", "SN-1002", "SN-1003"]);
  });
});
