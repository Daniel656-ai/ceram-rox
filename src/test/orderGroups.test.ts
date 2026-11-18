import { describe, it, expect } from "vitest";
import { groupRecordsByOrder, buildOrderComparison } from "@/lib/results/orderGroups";
import type { SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";

const res = (o: Partial<SampleResultValue>): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: "form:f:x", value: 1, unit: "%", temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: "SiO2",
  is_official: true, ...o,
});
const rec = (o: Partial<SampleMeasurementRecord>): SampleMeasurementRecord =>
  ({
    measurementId: crypto.randomUUID(), measurementNumber: "M1", orderId: "o1", orderNumber: "FG-260014",
    orderDisplayNumber: "FG-260014", projectName: "Proj", sampleId: "s1", sampleNumber: "P260039", sampleName: "",
    originalSampleNumber: null, serviceName: "RFA", createdAt: "2026-11-01T00:00:00Z", completedAt: null, results: [],
    ...o,
  }) as SampleMeasurementRecord;

describe("Gruppierung nach Auftrag", () => {
  const records = [
    rec({ sampleId: "s1", sampleNumber: "P260039", results: [res({ value: 5 }), res({ value: 9, is_official: false })] }),
    rec({ sampleId: "s2", sampleNumber: "P260042", results: [res({ value: 6 })] }),
    rec({ sampleId: "s3", sampleNumber: "P260052", results: [res({ value: 7 })] }),
    rec({ orderId: "o2", orderNumber: "FG-1", orderDisplayNumber: "FG-1", sampleId: "s1", sampleNumber: "P260039", results: [res({ value: 1 })] }),
  ];

  it("fasst mehrere Proben unter einem Auftrag zusammen, jede Messung genau einmal", () => {
    const groups = groupRecordsByOrder(records);
    expect(groups).toHaveLength(2);
    const o1 = groups.find((g) => g.orderId === "o1")!;
    expect(o1.samples.map((s) => s.sampleNumber).sort()).toEqual(["P260039", "P260042", "P260052"]);
    expect(o1.measurementCount).toBe(3);
    expect(o1.officialCount).toBe(3);
    expect(o1.interimCount).toBe(1);
    expect(groups.reduce((n, g) => n + g.measurementCount, 0)).toBe(records.length);
  });

  it("dieselbe Probe in zwei Aufträgen zeigt je Auftrag nur dessen Messungen", () => {
    const o2 = groupRecordsByOrder(records).find((g) => g.orderId === "o2")!;
    expect(o2.samples).toHaveLength(1);
    expect(o2.samples[0].measurements).toHaveLength(1);
  });

  it("baut den Probenvergleich nur aus offiziellen Werten", () => {
    const o1 = groupRecordsByOrder(records).find((g) => g.orderId === "o1")!;
    const [sec] = buildOrderComparison(o1);
    expect(sec.serviceName).toBe("RFA");
    expect(sec.columns).toHaveLength(1);
    expect(sec.rows).toHaveLength(3);
    const key = sec.columns[0].key;
    const byNum = Object.fromEntries(sec.rows.map((r) => [r.sample.sampleNumber, r.cells[key]]));
    expect(byNum.P260039).toEqual([5]);
    expect(byNum.P260042).toEqual([6]);
  });
});
