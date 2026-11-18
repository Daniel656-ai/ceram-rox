import { describe, it, expect } from "vitest";
import {
  classifyInternalResult,
  parseImportProtocol,
  splitInternalResults,
} from "@/lib/results/internalResults";
import { groupRecordsBySample, type SampleResultValue, type SampleMeasurementRecord } from "@/lib/results/sampleResultsAggregation";

const protocol = JSON.stringify({
  imported_at: "2026-11-10T09:30:00.000Z",
  profile: "Gasadsorption",
  sample: "P1",
  count: 12,
  source: "0000-9325.XLS",
  keys: ["a", "b"],
  units: {},
  unassigned: [{ label: "x" }],
  metadata: [{ label: "Parser", value: "2.0.0-gasadsorption" }],
  raw_dataset_id: "ds1",
  has_curves: true,
});

function val(over: Partial<SampleResultValue>): SampleResultValue {
  return {
    id: over.id ?? crypto.randomUUID(),
    result_name: "form:f1:x",
    value: null,
    unit: null,
    temperature_range_from: null,
    temperature_range_to: null,
    temperature_unit: null,
    remarks: null,
    measured_at: null,
    display_label: null,
    is_official: false,
    ...over,
  };
}

describe("interne Ergebniseinträge", () => {
  it("erkennt das Importprotokoll", () => {
    expect(classifyInternalResult(val({ remarks: protocol }))).toBe("import");
  });

  it("erkennt reine __-Konfigurationsobjekte", () => {
    expect(classifyInternalResult(val({ remarks: JSON.stringify({ __curve_config: {} }) }))).toBe("config");
  });

  it("lässt echte Werte und gewöhnliche Texte/JSON unberührt", () => {
    expect(classifyInternalResult(val({ value: 3.2 }))).toBeNull();
    expect(classifyInternalResult(val({ remarks: "Bemerkung" }))).toBeNull();
    expect(classifyInternalResult(val({ remarks: JSON.stringify([{ a: 1 }]) }))).toBeNull();
    expect(classifyInternalResult(val({ remarks: "{kaputt" }))).toBeNull();
    // Wert vorhanden -> nie intern, selbst wenn Bemerkung wie Protokoll aussieht
    expect(classifyInternalResult(val({ value: 1, remarks: protocol }))).toBeNull();
  });

  it("liest das Protokoll in eine kompakte Struktur", () => {
    const p = parseImportProtocol(protocol)!;
    expect(p.source).toBe("0000-9325.XLS");
    expect(p.profile).toBe("Gasadsorption");
    expect(p.count).toBe(12);
    expect(p.unassignedCount).toBe(1);
    expect(p.hasCurves).toBe(true);
    expect(p.metadata[0]).toEqual({ label: "Parser", value: "2.0.0-gasadsorption" });
    expect(parseImportProtocol("kein json")).toBeNull();
  });

  it("splitInternalResults verliert keine Datensätze", () => {
    const a = val({ id: "a", value: 1 });
    const b = val({ id: "b", remarks: protocol });
    const c = val({ id: "c", remarks: JSON.stringify({ __x: 1 }) });
    const { visible, protocols, hiddenOther } = splitInternalResults([a, b, c]);
    expect(visible.map((r) => r.id)).toEqual(["a"]);
    expect(protocols).toHaveLength(1);
    expect(hiddenOther.map((r) => r.id)).toEqual(["c"]);
  });

  it("zählt interne Einträge nicht als vorläufige Messwerte", () => {
    const rec = {
      measurementId: "m1", orderId: "o1", orderNumber: "A", orderDisplayNumber: "A",
      sampleId: "s1", sampleNumber: "P1", sampleName: "", originalSampleNumber: null,
      projectName: "", createdAt: "2026-11-01T00:00:00Z", completedAt: null,
      results: [val({ value: 1, is_official: true }), val({ value: 2 }), val({ remarks: protocol })],
    } as unknown as SampleMeasurementRecord;
    const [g] = groupRecordsBySample([rec]);
    expect(g.officialCount).toBe(1);
    expect(g.interimCount).toBe(1);
  });
});
