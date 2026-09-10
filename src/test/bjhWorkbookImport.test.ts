import { describe, it, expect } from "vitest";
import { distributionDataset } from "@/lib/instrumentImport/gasSorption/bjhWorkbook";
import type { ImportedSeries } from "@/lib/instrumentImport/types";

const series = (name: string, points: { x: number; y: number }[]): ImportedSeries => ({
  name,
  xLabel: "Pore Size Diameter",
  xUnit: "nm",
  yLabel: name,
  yUnit: "cm³/g",
  points,
});

describe("BJH-Verteilungsdaten", () => {
  it("führt mehrere Kurven über die Porengröße zu einem Datensatz zusammen", () => {
    const ds = distributionDataset([
      series("Incremental Pore Volume (BJH)", [
        { x: 10, y: 0.2 },
        { x: 5, y: 0.1 },
      ]),
      series("Incremental Pore Volume (DFT)", [{ x: 10, y: 0.3 }]),
    ]);
    expect(ds).not.toBeNull();
    expect(ds!.channels.map((c) => c.label)).toEqual([
      "Pore Size Diameter",
      "Incremental Pore Volume (BJH)",
      "Incremental Pore Volume (DFT)",
    ]);
    expect(ds!.rows[0][0]).toBe(10);
    expect(ds!.rows[0][2]).toBe(0.3);
    // Fehlender Punkt bleibt leer und wird nicht erfunden.
    expect(Number.isNaN(ds!.rows[1][2])).toBe(true);
  });

  it("liefert ohne Verteilungsdaten keinen Datensatz", () => {
    expect(distributionDataset([])).toBeNull();
  });
});
