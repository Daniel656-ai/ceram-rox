import { describe, it, expect } from "vitest";
import { buildServiceSchemas, flattenSchemas, exportCell, resultCell } from "@/lib/resultSchema";
import { buildOrderResultStructure, buildComparison } from "@/lib/orderResultsStructure";

const rec = (over: any) =>
  ({
    measurementId: "m1", measurementNumber: "M2601", orderId: "o", orderNumber: "A1",
    orderType: "", projectNumber: "", projectName: "", sampleId: "s1", sampleNumber: "P-001",
    sampleName: "", originalSampleNumber: null, serviceId: "svc", serviceName: "RFA",
    serviceCategory: "labor", assignedToId: null, assignedToName: "", createdById: "",
    createdByName: "", status: "completed", completedAt: null, createdAt: "",
    actualDurationHours: null, standardDurationHours: 0, inputParameters: {},
    outputResults: [], remarks: "", ...over,
  }) as any;

const res = (name: string, value: number | null) => ({
  id: name, result_name: name, display_label: name, value, unit: "%",
  temperature_range_from: null, temperature_range_to: null, temperature_unit: null,
  remarks: null, measured_at: "2026-08-18", is_official: true,
});

describe("resultSchema", () => {
  const defs = [
    { service_id: "svc", parameter_name: "SiO2", unit: "%", sort_order: 1, parameter_category: "output", description: "Gruppe: Hauptoxide" },
    { service_id: "svc", parameter_name: "Al2O3", unit: "%", sort_order: 2, parameter_category: "output", description: "Gruppe: Hauptoxide" },
    { service_id: "svc", parameter_name: "Pb", unit: "ppm", sort_order: 3, parameter_category: "output", description: "Gruppe: Spurenelemente" },
  ];

  it("hält die definierte Spaltenreihenfolge, auch wenn Werte fehlen", () => {
    const cols = flattenSchemas(
      buildServiceSchemas([rec({ outputResults: [res("Pb", 12)] })], defs as any)
    );
    expect(cols.map((c) => c.key)).toEqual(["SiO2", "Al2O3", "Pb"]);
    expect(cols[0].group).toBe("Hauptoxide");
  });

  it("hängt undefinierte, aber vorhandene Ergebnisse stabil an", () => {
    const cols = flattenSchemas(
      buildServiceSchemas([rec({ outputResults: [res("WO3", 0)] })], defs as any)
    );
    expect(cols.map((c) => c.key)).toEqual(["SiO2", "Al2O3", "Pb", "WO3"]);
  });

  it("leere Zelle bleibt leer, 0 bleibt 0", () => {
    const r = rec({ outputResults: [res("SiO2", 0)] });
    expect(exportCell(r, "SiO2")).toBe(0);
    expect(exportCell(r, "Pb")).toBe("");
    expect(resultCell(r, "Pb").present).toBe(false);
  });
});

describe("orderResultsStructure", () => {
  const row = (id: string, sample: string, results: any[]) => ({
    id, sample_id: sample, original_sample_id: null, service_id: "svc", status: "completed",
    measurement_number: id, measurement_services: { id: "svc", service_name: "RFA" },
    samples: { id: sample, sample_number: sample, sample_name: "" },
    measurement_results: results,
  });

  it("gruppiert Probe → Dienstleistung → Analysen", () => {
    const groups = buildOrderResultStructure([
      row("m1", "P-001", [res("SiO2", 56.2)]),
      row("m2", "P-001", [res("SiO2", 56.4)]),
      row("m3", "P-002", [res("SiO2", 54.1)]),
    ] as any);
    expect(groups.map((g) => g.sampleNumber)).toEqual(["P-001", "P-002"]);
    expect(groups[0].services[0].analyses.map((a) => a.index)).toEqual([1, 2]);
  });

  it("berechnet Vergleichskennwerte", () => {
    const groups = buildOrderResultStructure([
      row("m1", "P-001", [res("SiO2", 56)]),
      row("m2", "P-001", [res("SiO2", 58)]),
    ] as any);
    const cmp = buildComparison(groups[0].services[0].analyses);
    expect(cmp[0].mean).toBe(57);
    expect(cmp[0].min).toBe(56);
    expect(cmp[0].max).toBe(58);
  });
});
