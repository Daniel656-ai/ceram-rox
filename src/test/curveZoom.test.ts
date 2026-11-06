import { describe, expect, it } from "vitest";
import { sliceRangeExact, overviewMinMax, xExtent, type MeasurementDataset } from "@/lib/curves/dataset";
import { rawDataCsv } from "@/lib/curves/export";
import {
  clampRange, initHistory, panBy, pixelToX, pushView, redoView, resetView, undoView, wheelFactor, zoomAt,
} from "@/lib/curves/zoom";

const ch = (key: string) => ({ key, label: key, unit: null });

function bigDataset(n: number): MeasurementDataset {
  return {
    channels: [ch("t"), ch("a"), ch("b")],
    rows: Array.from({ length: n }, (_, i) => [i * 0.5, Math.sin(i / 10), i % 7 === 0 ? NaN : i]),
  };
}

describe("sliceRangeExact", () => {
  it("liefert alle Originalpunkte im Bereich – auch über 4000 Punkte, ohne Reduktion", () => {
    const ds = bigDataset(7208);
    const all = sliceRangeExact(ds, "t", ["a", "b"], -Infinity, Infinity);
    expect(all).toHaveLength(7208);
    const part = sliceRangeExact(ds, "t", ["a"], 100, 2500);
    expect(part).toHaveLength(4801); // x=100..2500 in 0.5er-Schritten
    expect(part[0].a).toBe(ds.rows[200][1]);
    expect(part[0].rowIndex).toBe(200);
  });

  it("erhält doppelte X-Werte als eigene Zeilen", () => {
    const ds: MeasurementDataset = { channels: [ch("t"), ch("a")], rows: [[1, 10], [2, 20], [2, 21], [3, 30]] };
    const r = sliceRangeExact(ds, "t", ["a"], 0, 5);
    expect(r.map((p) => [p.x, p.a])).toEqual([[1, 10], [2, 20], [2, 21], [3, 30]]);
  });

  it("erhält unterschiedliche Kanalwerte je Originalzeile ohne Vermischung", () => {
    const ds: MeasurementDataset = { channels: [ch("t"), ch("a"), ch("b")], rows: [[1, 1, NaN], [1, NaN, 2]] };
    const r = sliceRangeExact(ds, "t", ["a", "b"], 0, 5);
    expect(r).toEqual([
      { rowIndex: 0, x: 1, a: 1, b: null },
      { rowIndex: 1, x: 1, a: null, b: 2 },
    ]);
  });

  it("fehlende Werte bleiben null und werden nie 0", () => {
    const ds: MeasurementDataset = { channels: [ch("t"), ch("a")], rows: [[0, NaN], [1, 0], [2, Infinity]] };
    const r = sliceRangeExact(ds, "t", ["a"], 0, 2);
    expect(r.map((p) => p.a)).toEqual([null, 0, null]);
  });

  it("erhält die ursprüngliche Reihenfolge (auch nicht monotone X-Werte)", () => {
    const ds: MeasurementDataset = { channels: [ch("T"), ch("a")], rows: [[20, 1], [500, 2], [300, 3], [50, 4]] };
    const r = sliceRangeExact(ds, "T", ["a"], 0, 1000);
    expect(r.map((p) => p.rowIndex)).toEqual([0, 1, 2, 3]);
  });

  it("verändert dataset.rows nicht", () => {
    const ds = bigDataset(50);
    const copy = JSON.stringify(ds.rows);
    sliceRangeExact(ds, "t", ["a", "b"], 3, 9);
    overviewMinMax(ds, "t", "a", 5);
    expect(JSON.stringify(ds.rows)).toBe(copy);
  });
});

describe("Gesamtübersicht", () => {
  it("Min-Max-Bucketing behält Extremwerte und reduziert nur die Übersicht", () => {
    const ds = bigDataset(7208);
    const ov = overviewMinMax(ds, "t", "a", 100);
    expect(ov.points.length).toBeLessThanOrEqual(200);
    expect(Math.max(...ov.points.map((p) => p.y))).toBe(ov.yMax);
    expect(Math.min(...ov.points.map((p) => p.y))).toBe(ov.yMin);
  });
  it("xExtent ohne Spread für große Reihen", () => {
    expect(xExtent(bigDataset(7208), "t")).toEqual({ min: 0, max: 3603.5 });
  });
});

describe("Zoom-Domain", () => {
  const full = { from: 0, to: 100 };
  it("zoomt um den Anker und bleibt im Gesamtbereich", () => {
    expect(zoomAt(full, full, 50, 0.5)).toEqual({ from: 25, to: 75 });
    expect(zoomAt(full, full, 0, 0.5)).toEqual({ from: 0, to: 50 });
    expect(zoomAt({ from: 10, to: 20 }, full, 15, 100)).toEqual(full);
  });
  it("Mausradfaktor ist stufenlos und richtungsabhängig", () => {
    expect(wheelFactor(-100)).toBeLessThan(1);
    expect(wheelFactor(100)).toBeGreaterThan(1);
    expect(wheelFactor(-1, 1)).toBeCloseTo(wheelFactor(-16, 0));
  });
  it("Verschieben behält die Breite und stoppt am Rand", () => {
    expect(panBy({ from: 10, to: 30 }, full, 5)).toEqual({ from: 15, to: 35 });
    expect(panBy({ from: 10, to: 30 }, full, 500)).toEqual({ from: 80, to: 100 });
    expect(clampRange({ from: -5, to: 10 }, full)).toEqual({ from: 0, to: 15 });
  });
  it("Pixel → X anhand der tatsächlichen Zeichenflächenbreite", () => {
    expect(pixelToX(250, 1000, { from: 0, to: 40 })).toBe(10);
    expect(pixelToX(125, 500, { from: 0, to: 40 })).toBe(10);
  });
});

describe("Zoom-Historie", () => {
  it("undo/redo/reset", () => {
    const full = { from: 0, to: 100 };
    let h = initHistory(full);
    h = pushView(h, { from: 10, to: 50 });
    h = pushView(h, { from: 20, to: 30 });
    h = undoView(h);
    expect(h.current).toEqual({ from: 10, to: 50 });
    h = redoView(h);
    expect(h.current).toEqual({ from: 20, to: 30 });
    h = undoView(undoView(h));
    expect(h.current).toEqual(full);
    expect(undoView(h)).toBe(h);
    h = resetView(full);
    expect(h).toEqual({ past: [], current: full, future: [] });
  });
});

describe("Rohdaten-CSV", () => {
  it("bleibt vollständig, unabhängig vom Zoom", () => {
    const ds = bigDataset(7208);
    const csv = rawDataCsv(ds);
    expect(csv.split("\n")).toHaveLength(7209);
  });
});
