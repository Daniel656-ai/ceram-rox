import { describe, expect, it } from "vitest";
import {
  channelKey,
  curveOf,
  downsample,
  interpolateAt,
  overviewMinMax,
  sliceRange,
  sliceRangeExact,
  splitChannelHeader,
  trapezoidArea,
  xExtent,
  type CurvePoint,
  type MeasurementDataset,
} from "@/lib/curves/dataset";

/**
 * Ergänzt netzschImport.test.ts (Standard-Überschriften) und curveZoom.test.ts
 * (sliceRangeExact, Übersicht großer Reihen) um Grenz- und Fehlerfälle.
 */

const ch = (key: string) => ({ key, label: key, unit: null });
const pts = (...xy: Array<[number, number]>): CurvePoint[] => xy.map(([x, y]) => ({ x, y }));

describe("Kanalüberschrift in Name und Einheit trennen", () => {
  it("liefert für eine leere Überschrift einen leeren Namen ohne Einheit", () => {
    expect(splitChannelHeader("   ")).toEqual({ name: "", unit: null });
  });

  it("wertet eine leere Klammer-Einheit als keine Einheit", () => {
    expect(splitChannelHeader("DSC/()")).toEqual({ name: "DSC", unit: null });
  });

  it("erkennt dL/L0 und dL/L₀ als dimensionslosen Kanalnamen", () => {
    expect(splitChannelHeader("dL/L0")).toEqual({ name: "dL/L0", unit: null });
    expect(splitChannelHeader("dL/L₀")).toEqual({ name: "dL/L₀", unit: null });
  });

  it("nimmt einen Text mit Leerzeichen hinter dem Schrägstrich nicht als Einheit", () => {
    expect(splitChannelHeader("Masse/Probe gesamt")).toEqual({ name: "Masse/Probe gesamt", unit: null });
  });

  it("trennt erst am letzten Schrägstrich und schneidet Leerzeichen ab", () => {
    expect(splitChannelHeader(" Gas Flow/Sens / s ")).toEqual({ name: "Gas Flow/Sens", unit: "s" });
  });

  it("behandelt einen führenden Schrägstrich als Teil des Namens", () => {
    expect(splitChannelHeader("/s")).toEqual({ name: "/s", unit: null });
  });
});

describe("Technischer Kanalschlüssel", () => {
  it("normalisiert Groß-/Kleinschreibung, Umlaute, Hochzahlen und Sonderzeichen", () => {
    expect(channelKey("  Temp./°C ")).toBe("temp_c");
    expect(channelKey("Fläche m²")).toBe("flache_m2");
    expect(channelKey("--DSC--")).toBe("dsc");
  });
});

describe("Kurve aus zwei Kanälen", () => {
  const ds: MeasurementDataset = {
    channels: [ch("t"), ch("a")],
    rows: [[0, 1], [1, NaN], [NaN, 3], [3, 4]],
  };

  it("verwirft Punkte mit ungültigem X- oder Y-Wert", () => {
    expect(curveOf(ds, "t", "a")).toEqual(pts([0, 1], [3, 4]));
  });

  it("liefert eine leere Kurve, wenn ein Kanal fehlt", () => {
    expect(curveOf(ds, "t", "fehlt")).toEqual([]);
    expect(curveOf(ds, "fehlt", "a")).toEqual([]);
  });
});

describe("Kurvenausschnitt nach X-Bereich", () => {
  const curve = pts([1, 10], [2, 20], [3, 30], [4, 40]);

  it("schließt beide Grenzen ein", () => {
    expect(sliceRange(curve, 2, 3).map((p) => p.x)).toEqual([2, 3]);
  });

  it("liefert dasselbe Ergebnis bei vertauschten Grenzen", () => {
    expect(sliceRange(curve, 3, 2)).toEqual(sliceRange(curve, 2, 3));
  });

  it("liefert bei vertauschten Grenzen auch im exakten Ausschnitt die Originalzeilen", () => {
    const ds: MeasurementDataset = { channels: [ch("t"), ch("a")], rows: [[1, 10], [2, 20], [3, 30]] };
    expect(sliceRangeExact(ds, "t", ["a"], 3, 2).map((r) => r.rowIndex)).toEqual([1, 2]);
  });

  it("liefert im exakten Ausschnitt nichts, wenn der X-Kanal fehlt, und null für einen unbekannten Y-Kanal", () => {
    const ds: MeasurementDataset = { channels: [ch("t"), ch("a")], rows: [[1, 10]] };
    expect(sliceRangeExact(ds, "fehlt", ["a"], 0, 5)).toEqual([]);
    expect(sliceRangeExact(ds, "t", ["fehlt"], 0, 5)).toEqual([{ rowIndex: 0, x: 1, fehlt: null }]);
  });
});

describe("Lineare Interpolation an einer X-Stelle", () => {
  it("liefert für eine leere Kurve null", () => {
    expect(interpolateAt([], 1)).toBeNull();
  });

  it("interpoliert linear zwischen zwei Punkten", () => {
    expect(interpolateAt(pts([0, 0], [10, 100]), 2.5)).toBe(25);
  });

  it("liefert außerhalb des Messbereichs null statt eines extrapolierten Werts", () => {
    const curve = pts([0, 0], [10, 100]);
    expect(interpolateAt(curve, -0.1)).toBeNull();
    expect(interpolateAt(curve, 10.1)).toBeNull();
  });

  it("liefert an den Bereichsgrenzen genau die Messwerte", () => {
    const curve = pts([0, 5], [10, 100]);
    expect(interpolateAt(curve, 0)).toBe(5);
    expect(interpolateAt(curve, 10)).toBe(100);
  });

  it("interpoliert auch bei absteigend sortierten X-Werten (z. B. Abkühlkurve)", () => {
    expect(interpolateAt(pts([10, 100], [0, 0]), 7.5)).toBe(75);
  });

  it("nimmt bei doppeltem X-Wert den ersten Messwert statt durch null zu teilen", () => {
    expect(interpolateAt(pts([5, 7], [5, 9], [10, 10]), 5)).toBe(7);
  });
});

describe("Reduktion großer Messreihen für die Darstellung", () => {
  const curve = Array.from({ length: 101 }, (_, i) => ({ x: i, y: i * 2 }));

  it("lässt kleine Reihen unverändert", () => {
    expect(downsample(curve, 200)).toBe(curve);
    expect(downsample(curve, 101)).toBe(curve);
  });

  it("lässt die Reihe bei einer unsinnigen Höchstzahl unter 2 unverändert", () => {
    expect(downsample(curve, 1)).toBe(curve);
  });

  it("reduziert gleichmäßig auf die Höchstzahl und behält ersten und letzten Punkt", () => {
    const out = downsample(curve, 11);
    expect(out).toHaveLength(11);
    expect(out.map((p) => p.x)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });
});

describe("Fläche unter der Kurve (Trapezregel)", () => {
  it("berechnet die Fläche eines unsymmetrischen Dreiecks exakt", () => {
    expect(trapezoidArea(pts([0, 0], [1, 2], [3, 0]))).toBe(3);
  });

  it("zieht eine Basislinie ab", () => {
    expect(trapezoidArea(pts([0, 3], [2, 3]), () => 1)).toBe(4);
  });

  it("liefert für weniger als zwei Punkte die Fläche 0", () => {
    expect(trapezoidArea([])).toBe(0);
    expect(trapezoidArea(pts([1, 5]))).toBe(0);
  });
});

describe("X-Wertebereich eines Kanals", () => {
  it("ignoriert ungültige X-Werte und findet Minimum und Maximum unabhängig von der Reihenfolge", () => {
    const ds: MeasurementDataset = { channels: [ch("t")], rows: [[5], [NaN], [-2], [Infinity], [3]] };
    expect(xExtent(ds, "t")).toEqual({ min: -2, max: 5 });
  });

  it("liefert null ohne gültige Werte oder für einen unbekannten Kanal", () => {
    const ds: MeasurementDataset = { channels: [ch("t")], rows: [[NaN]] };
    expect(xExtent(ds, "t")).toBeNull();
    expect(xExtent(ds, "fehlt")).toBeNull();
  });
});

describe("Gesamtübersicht (Min-Max-Bucketing)", () => {
  it("gibt kleine Reihen vollständig zurück und meldet Y-Minimum und -Maximum", () => {
    const ds: MeasurementDataset = { channels: [ch("t"), ch("a")], rows: [[0, 3], [1, -1], [2, 7]] };
    expect(overviewMinMax(ds, "t", "a", 10)).toEqual({ key: "a", points: pts([0, 3], [1, -1], [2, 7]), yMin: -1, yMax: 7 });
  });

  it("behält je Bucket Minimum und Maximum als Originalpunkte in X-Reihenfolge", () => {
    // 8 Punkte, 2 Buckets → reduziert (8 > 2 * 2)
    const rows = [[0, 5], [1, 9], [2, 1], [3, 4], [4, 2], [5, 8], [6, 0], [7, 3]];
    const ds: MeasurementDataset = { channels: [ch("t"), ch("a")], rows };
    const ov = overviewMinMax(ds, "t", "a", 2);
    expect(ov.points).toEqual(pts([1, 9], [2, 1], [5, 8], [6, 0]));
  });
});
