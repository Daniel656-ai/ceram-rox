import { describe, expect, it } from "vitest";
import { computeStats, isOutlier, linearRegression, buildInsights } from "@/lib/resultsStatistics";

describe("computeStats", () => {
  it("berechnet Kennzahlen inkl. Quartile", () => {
    const s = computeStats([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(s.n).toBe(8);
    expect(s.mean).toBe(5);
    expect(s.median).toBe(4.5);
    expect(s.sd).toBeCloseTo(2.138, 3);
    expect(s.q1).toBeCloseTo(4, 6);
    expect(s.q3).toBeCloseTo(5.5, 6);
  });

  it("liefert null ohne Werte", () => {
    expect(computeStats([])).toBeNull();
  });
});

describe("Ausreißer", () => {
  it("erkennt Werte außerhalb von 1,5 × IQR", () => {
    const s = computeStats([10, 11, 12, 11, 10, 12, 40])!;
    expect(isOutlier(40, s)).toBe(true);
    expect(isOutlier(11, s)).toBe(false);
  });
});

describe("linearRegression", () => {
  it("erkennt perfekten linearen Zusammenhang", () => {
    const r = linearRegression([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }])!;
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(0, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it("liefert null bei konstanter X-Achse", () => {
    expect(linearRegression([{ x: 1, y: 2 }, { x: 1, y: 5 }])).toBeNull();
  });
});

describe("buildInsights", () => {
  it("beschreibt Streuung, Trend und Ausreißer", () => {
    const stats = computeStats([10, 11, 12, 40])!;
    const text = buildInsights({
      yLabel: "Dichte",
      xLabel: "Temperatur",
      stats,
      regression: linearRegression([{ x: 1, y: 10 }, { x: 2, y: 11 }, { x: 3, y: 12 }]),
      outlierLabels: ["SN-1004"],
      totalPoints: 4,
      visiblePoints: 4,
    });
    expect(text.join(" ")).toContain("SN-1004");
    expect(text.join(" ")).toContain("Dichte");
  });
});
