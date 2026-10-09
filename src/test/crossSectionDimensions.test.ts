import { describe, it, expect } from "vitest";
import {
  analyzeDimensionText, symmetrizeTolerance, crossSectionFromRelease, formatCrossSection,
} from "@/lib/productionRelease/dimensions";
import { coerceFieldValue, needsNumericReview } from "@/lib/productionRelease/fields";
import { numericReviewChanges } from "@/lib/productionRelease/importPipeline";
import { deriveM3Values } from "@/lib/m3List/derive";
import { buildNoxHandover } from "@/lib/m3List/noxHandover";

describe("Querschnitt – Erkennung", () => {
  it("152 x 152 mm → 152 × 152, nie 152152", () => {
    expect(analyzeDimensionText("152 x 152 mm")).toEqual({ kind: "cross_section", width: 152, height: 152 });
    expect(coerceFieldValue("cross_section_mm", "152 x 152 mm")).toBe(152);
    expect(needsNumericReview("cross_section_mm", "152 x 152 mm")).toBe(false);
  });
  it("152 × 203 mm bleibt als zwei Maße erhalten und wird zur Prüfung vorgelegt", () => {
    expect(analyzeDimensionText("152 mm × 203 mm")).toEqual({ kind: "cross_section", width: 152, height: 203 });
    expect(coerceFieldValue("cross_section_mm", "152 × 203 mm")).toBeNull();
    const c = numericReviewChanges({ cross_section_mm: "152 × 203 mm" });
    expect(c).toHaveLength(1);
    expect(c[0].auto).toBe(false);
    expect(c[0].new_value).toBe("152 × 203 mm");
  });
  it("Einzelwert 150 bleibt 150", () => {
    expect(coerceFieldValue("cross_section_mm", "150")).toBe(150);
    expect(coerceFieldValue("length_mm", "520 mm")).toBe(520);
  });
  it("deutsches Zahlenformat", () => {
    expect(coerceFieldValue("inner_wall_thickness_mm", "0,62 mm")).toBe(0.62);
    expect(coerceFieldValue("length_mm", "1.234,5")).toBe(1234.5);
    expect(analyzeDimensionText("152,5 x 152,5")).toEqual({ kind: "cross_section", width: 152.5, height: 152.5 });
  });
  it("mehrdeutige Eingabe → keine stille Umwandlung", () => {
    expect(coerceFieldValue("length_mm", "520 / 530")).toBeNull();
    expect(needsNumericReview("length_mm", "520 / 530")).toBe(true);
    expect(coerceFieldValue("length_mm", "152 x 152")).toBeNull(); // Mehrfachmaß nur beim Querschnitt
  });
});

describe("Toleranzen – Original vs. Rechenwert", () => {
  it("150 mm +1/−3 mm: Original bleibt, Rechenwert 149 ±2", () => {
    const a = analyzeDimensionText("150 mm +1/−3 mm");
    expect(a).toEqual({ kind: "tolerance", nominal: 150, upper: 1, lower: 3 });
    expect(coerceFieldValue("length_mm", "150 mm +1/−3 mm")).toBe(150);
    expect(symmetrizeTolerance(150, 1, 3)).toEqual({ nominal: 149, tolerance: 2, max: 151, min: 147 });
  });
  it("symmetrische Toleranz verschiebt das Nennmaß nicht", () => {
    const a = analyzeDimensionText("150 ± 2 mm");
    expect(a).toEqual({ kind: "tolerance", nominal: 150, upper: 2, lower: 2 });
    expect(symmetrizeTolerance(150, 2, 2).nominal).toBe(150);
  });
});

describe("m³-Liste und NOx-Übergabe", () => {
  const base = { release_number: "FF", revision_number: 1, length_mm: 520 };
  it("zeigt 152 mm × 152 mm aus dem gesicherten Originaltext", () => {
    const rel = { ...base, cross_section_mm: 152, field_sources: { cross_section_mm: { source: "pdf", raw: "152 x 152 mm" } } };
    const r = deriveM3Values({ release: rel, orderNumber: null, stored: {}, constants: null });
    expect(r.values.cross_section_mm).toBe(formatCrossSection(152, 152));
    expect(r.values.cross_section_mm).toBe("152 mm × 152 mm");
    expect(r.values.cross_section_width_mm).toBe(152);
    expect(r.values.cross_section_height_mm).toBe(152);
    expect(buildNoxHandover(r.values).find((h) => h.key === "cross_section_mm")?.value).toBe("152 mm × 152 mm");
  });
  it("zeigt 152 mm × 203 mm, obwohl kein Einzelwert gespeichert ist", () => {
    const rel = { ...base, cross_section_mm: null, field_sources: { cross_section_mm: { raw: "152 × 203 mm" } } };
    const r = deriveM3Values({ release: rel, orderNumber: null, stored: {}, constants: null });
    expect(r.values.cross_section_mm).toBe("152 mm × 203 mm");
    expect(r.values.cross_section_height_mm).toBe(203);
  });
  it("Altwert 152152 wird nicht still korrigiert, sondern gemeldet", () => {
    const r = deriveM3Values({ release: { ...base, cross_section_mm: 152152 }, orderNumber: null, stored: {}, constants: null });
    expect(r.values.cross_section_width_mm).toBe(152152);
    expect(r.notices.some((n) => n.includes("Querschnitt") && n.includes("unplausibel"))).toBe(true);
  });
  it("Einzelwert wird nicht zum Quadrat ergänzt", () => {
    expect(crossSectionFromRelease({ cross_section_mm: 150 })).toMatchObject({ width: 150, height: null, display: "150 mm" });
  });
});
