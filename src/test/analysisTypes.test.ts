import { describe, expect, it } from "vitest";
import {
  ANALYSIS_ORDER, analysisCharts, detectAnalysisKind, sortByAnalysisOrder,
} from "@/lib/curves/analysisTypes";
import type { MeasurementDataset } from "@/lib/curves/dataset";

const bjh = {
  importer_id: "gas-sorption",
  measurement_type: null,
  channels: [
    { key: "pore_size", label: "Pore Size Diameter", unit: "nm" },
    { key: "inc_vol", label: "Incremental Pore Volume", unit: "cm³/g" },
  ],
};
const sta = { importer_id: "netzsch5", measurement_type: "DSC", channels: [{ key: "dsc", label: "DSC", unit: "mW/mg" }] };
const dil = { importer_id: "netzsch5", measurement_type: "DIL", channels: [{ key: "dl_lo", label: "dL/Lo", unit: null }] };

describe("Auswertungstypen der Ergebnisdarstellung", () => {
  it("erkennt BJH, STA und DIL", () => {
    expect(detectAnalysisKind(bjh as any)).toBe("BJH");
    expect(detectAnalysisKind(sta as any)).toBe("STA");
    expect(detectAnalysisKind(dil as any)).toBe("DIL");
    expect(detectAnalysisKind({ importer_id: "x", measurement_type: null, channels: [] } as any)).toBe("OTHER");
  });

  it("sortiert fest nach BJH → STA → DIL", () => {
    expect(ANALYSIS_ORDER.slice(0, 3)).toEqual(["BJH", "STA", "DIL"]);
    const sorted = sortByAnalysisOrder([dil, sta, bjh] as any).map((d) => detectAnalysisKind(d as any));
    expect(sorted).toEqual(["BJH", "STA", "DIL"]);
  });

  it("zeigt nur vorhandene Auswertungen an", () => {
    const only = sortByAnalysisOrder([bjh] as any).map((d) => detectAnalysisKind(d as any));
    expect(only).toEqual(["BJH"]);
  });

  it("verwendet für BJH die Diagramme des Importprofils", () => {
    const dataset: MeasurementDataset = {
      channels: [
        { key: "pore_size", label: "Pore Size Diameter", unit: "nm" },
        { key: "inc_vol", label: "Incremental Pore Volume", unit: "cm³/g" },
        { key: "inc_area", label: "Incremental Pore Area", unit: "m²/g" },
        { key: "dv", label: "dV/dlog(D) Pore Volume", unit: "cm³/g" },
        { key: "da", label: "dA/dlog(D) Pore Area", unit: "m²/g" },
      ],
      rows: [[2, 0.1, 1, 0.5, 5], [4, 0.2, 2, 0.7, 7]],
    };
    expect(analysisCharts("BJH", dataset)).toHaveLength(4);
    expect(analysisCharts("STA", dataset)).toHaveLength(0);
  });
});
