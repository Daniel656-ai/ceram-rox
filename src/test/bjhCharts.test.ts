import { describe, it, expect } from "vitest";
import { buildBjhCharts } from "@/lib/curves/bjhCharts";
import type { MeasurementDataset } from "@/lib/curves/dataset";

const ds: MeasurementDataset = {
  channels: [
    { key: "pore_size_diameter", label: "Pore Size Diameter", unit: "nm" },
    { key: "incremental_pore_volume", label: "Incremental Pore Volume", unit: "cm³/g" },
    { key: "incremental_pore_area", label: "Incremental Pore Area", unit: "m²/g" },
    { key: "differential_pore_volume", label: "Differential Pore Volume", unit: "cm³/g·nm" },
    { key: "differential_pore_area", label: "Differential Pore Area", unit: "m²/g·nm" },
  ],
  rows: [
    [100, 0.01, 0.4, 0.002, 0.05],
    [10, 0.05, 1.2, 0.01, 0.3],
    [2.5, 0.02, 0.9, 0.004, 0.2],
  ],
};

describe("BJH-Diagramme", () => {
  it("erzeugt genau vier Diagramme in fester Zuordnung", () => {
    const charts = buildBjhCharts(ds);
    expect(charts.map((c) => c.definition.id)).toEqual([
      "incremental_pore_volume",
      "incremental_pore_area",
      "differential_pore_volume",
      "differential_pore_area",
    ]);
    expect(charts.every((c) => c.xLabel === "Pore Size Diameter" && c.xUnit === "nm")).toBe(true);
  });

  it("verwendet alle importierten Messpunkte ohne Aggregation", () => {
    const [vol] = buildBjhCharts(ds);
    expect(vol.series[0].points).toEqual([
      { x: 2.5, y: 0.02 },
      { x: 10, y: 0.05 },
      { x: 100, y: 0.01 },
    ]);
  });

  it("trennt Incremental und Differential strikt", () => {
    const charts = buildBjhCharts(ds);
    for (const c of charts) {
      expect(c.series).toHaveLength(1);
      expect(c.series[0].label).toBe(c.definition.yLabel);
    }
  });

  it("liefert ohne Porengrößenkanal keine Diagramme", () => {
    expect(buildBjhCharts({ channels: [{ key: "t", label: "Time", unit: "s" }], rows: [[1]] })).toEqual([]);
  });
});
