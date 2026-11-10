import { describe, it, expect } from "vitest";
import {
  resultIdentityKey,
  isOfficialResult,
  groupRecordsBySample,
  groupResultsByInstance,
  countResultOccurrences,
  matchesSampleFilters,
  type SampleMeasurementRecord,
  type SampleResultValue,
} from "@/lib/results/sampleResultsAggregation";

function val(over: Partial<SampleResultValue>): SampleResultValue {
  return {
    id: over.id ?? crypto.randomUUID(),
    result_name: "form:f1:druckfestigkeit",
    value: 10,
    unit: "MPa",
    temperature_range_from: null,
    temperature_range_to: null,
    temperature_unit: null,
    remarks: null,
    measured_at: "2026-10-01T10:00:00Z",
    display_label: null,
    is_official: false,
    instance_key: null,
    instance_label: null,
    instance_context: null,
    ...over,
  };
}

function rec(over: Partial<SampleMeasurementRecord>): SampleMeasurementRecord {
  return {
    measurementId: over.measurementId ?? crypto.randomUUID(),
    measurementNumber: "M260001",
    orderId: "o1",
    orderNumber: "SW-260001",
    orderDisplayNumber: "SW-260001",
    orderType: "standard",
    projectNumber: "P1",
    projectName: "Projekt A",
    sampleId: "s1",
    sampleNumber: "P260001",
    sampleName: "Probe 1",
    originalSampleNumber: null,
    serviceId: "svc1",
    serviceName: "Druckfestigkeit",
    serviceCategory: "Mechanik",
    assignedToId: null,
    assignedToName: "",
    createdById: "u1",
    createdByName: "Max Muster",
    status: "completed",
    completedAt: "2026-10-02T10:00:00Z",
    createdAt: "2026-10-01T09:00:00Z",
    remarks: "",
    results: [],
    ...over,
  };
}

describe("resultIdentityKey", () => {
  it("kanonische Identität aus result_name + COALESCE(instance_key,'')", () => {
    expect(resultIdentityKey("a", null)).toBe("a::");
    expect(resultIdentityKey("a", "inst1")).toBe("a::inst1");
    expect(resultIdentityKey("a", undefined)).toBe("a::");
  });
});

describe("isOfficialResult", () => {
  it("nur echtes true ist offiziell – NULL/false nie", () => {
    expect(isOfficialResult({ is_official: true })).toBe(true);
    expect(isOfficialResult({ is_official: false })).toBe(false);
    expect(isOfficialResult({ is_official: null as any })).toBe(false);
    expect(isOfficialResult({ is_official: undefined as any })).toBe(false);
  });
});

describe("groupRecordsBySample", () => {
  it("gruppiert mehrere Messungen einer Probe verlustfrei", () => {
    const m1 = rec({ measurementId: "m1", results: [val({ id: "r1", is_official: true }), val({ id: "r2" })] });
    const m2 = rec({ measurementId: "m2", measurementNumber: "M260002", results: [val({ id: "r3" })] });
    const groups = groupRecordsBySample([m1, m2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].measurements).toHaveLength(2);
    expect(groups[0].officialCount).toBe(1);
    expect(groups[0].interimCount).toBe(2);
  });

  it("trennt Proben strikt und bildet Auftrags-Fallback ohne Probe", () => {
    const a = rec({ measurementId: "m1", sampleId: "s1", results: [val({ id: "r1" })] });
    const b = rec({ measurementId: "m2", sampleId: "s2", sampleNumber: "P260002", results: [val({ id: "r2" })] });
    const noSample = rec({ measurementId: "m3", sampleId: null, sampleNumber: "", orderId: "o9", results: [val({ id: "r3" })] });
    const groups = groupRecordsBySample([a, b, noSample]);
    expect(groups).toHaveLength(3);
    const fallback = groups.find((g) => g.sampleKey === "order:o9");
    expect(fallback).toBeDefined();
    expect(fallback!.measurements).toHaveLength(1);
  });

  it("jeder Ergebnisdatensatz erscheint genau einmal (keine Deduplizierung, kein Verlust)", () => {
    const results = [
      val({ id: "r1", instance_key: "i1", instance_label: "Kalibriert" }),
      val({ id: "r2", instance_key: "i1", instance_label: "Kalibriert" }),
      val({ id: "r3", instance_key: "i2", instance_label: "Messung 2" }),
      val({ id: "r4" }),
    ];
    const groups = groupRecordsBySample([rec({ results })]);
    const counts = countResultOccurrences(groups);
    for (const r of results) expect(counts.get(r.id)).toBe(1);
    expect(groups[0].measurements[0].results).toHaveLength(4);
  });
});

describe("groupResultsByInstance", () => {
  it("fächert wiederholte Messblöcke als eigenständige Durchläufe auf", () => {
    const instances = groupResultsByInstance([
      val({ id: "r1", instance_key: "i1", instance_label: "Kalibriert" }),
      val({ id: "r2", instance_key: "i2", instance_label: "Messung 2" }),
      val({ id: "r3" }),
    ]);
    expect(instances).toHaveLength(3);
    expect(instances.find((i) => i.instanceKey === "i1")!.instanceLabel).toBe("Kalibriert");
    expect(instances.find((i) => i.instanceKey === "")!.results).toHaveLength(1);
  });
});

describe("matchesSampleFilters", () => {
  const base = {
    serviceFilter: "all", projectFilter: "all", creatorFilter: "all", technicianFilter: "all",
    sampleFilter: "", dateFrom: "", dateTo: "", searchText: "",
  };

  it("Messart-, Projekt- und Personenfilter wirken wie in der Matrix", () => {
    const r = rec({});
    expect(matchesSampleFilters(r, { ...base, serviceFilter: "Druckfestigkeit" })).toBe(true);
    expect(matchesSampleFilters(r, { ...base, serviceFilter: "Schwindung" })).toBe(false);
    expect(matchesSampleFilters(r, { ...base, projectFilter: "Projekt A" })).toBe(true);
    expect(matchesSampleFilters(r, { ...base, creatorFilter: "Max Muster" })).toBe(true);
    expect(matchesSampleFilters(r, { ...base, creatorFilter: "Andere" })).toBe(false);
  });

  it("Proben- und Volltextsuche sowie Zeitraum greifen", () => {
    const r = rec({});
    expect(matchesSampleFilters(r, { ...base, sampleFilter: "p2600" })).toBe(true);
    expect(matchesSampleFilters(r, { ...base, sampleFilter: "xyz" })).toBe(false);
    expect(matchesSampleFilters(r, { ...base, searchText: "sw-260001" })).toBe(true);
    expect(matchesSampleFilters(r, { ...base, searchText: "nichtsvorhanden" })).toBe(false);
    expect(matchesSampleFilters(r, { ...base, dateFrom: "2026-10-01", dateTo: "2026-10-03" })).toBe(true);
    expect(matchesSampleFilters(r, { ...base, dateFrom: "2026-11-01" })).toBe(false);
  });
});
