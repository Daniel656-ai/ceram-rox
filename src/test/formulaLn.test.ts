import { describe, it, expect } from "vitest";
import { evaluateFormula, FORMULA_FUNCTIONS, formulaFunctionLabel } from "@/lib/formulaEngine";

const val = (f: string, ctx: Record<string, unknown> = {}) => evaluateFormula(f, ctx);

describe("Formeleditor: LN() – natürlicher Logarithmus", () => {
  it("LN(1) = 0", () => {
    expect(val("LN(1)")).toEqual({ value: 0, error: null });
  });

  it("LN(10) ≈ 2,302585", () => {
    const r = val("LN(10)");
    expect(r.error).toBeNull();
    expect(r.value!).toBeCloseTo(2.302585, 6);
  });

  it("LN(100) ≈ 4,605170", () => {
    expect(val("LN(100)").value!).toBeCloseTo(4.60517, 5);
  });

  it("LN(0) meldet einen verständlichen Fehler statt -Infinity", () => {
    const r = val("LN(0)");
    expect(r.value).toBeNull();
    expect(r.error).toBe("LN() ist nur für Werte > 0 definiert.");
  });

  it("LN(-10) meldet einen Fehler statt NaN", () => {
    const r = val("LN(-10)");
    expect(r.value).toBeNull();
    expect(r.error).toBe("LN() ist nur für Werte > 0 definiert.");
  });

  it("arbeitet mit Feldreferenzen der bestehenden Syntax", () => {
    const r = val("LN(messwert_a)", { messwert_a: 10 });
    expect(r.value!).toBeCloseTo(2.302585, 6);
  });

  it("verarbeitet deutsche Zahlenformate aus Feldwerten", () => {
    const r = val("LN(messwert_a)", { messwert_a: "7,389056" });
    expect(r.value!).toBeCloseTo(2, 5);
  });

  it("funktioniert in zusammengesetzten Formeln: 100 * LN(a/b)", () => {
    const r = val("100 * LN(a / b)", { a: 20, b: 2 });
    expect(r.value!).toBeCloseTo(230.2585, 4);
  });

  it("funktioniert verschachtelt: LN(a) / LN(b)", () => {
    const r = val("LN(a) / LN(b)", { a: 100, b: 10 });
    expect(r.value!).toBeCloseTo(2, 10);
  });

  it("kombiniert mit bestehenden Funktionen: ROUND(LN(10), 3)", () => {
    expect(val("ROUND(LN(10), 3)").value).toBe(2.303);
  });

  it("fehlender Feldwert bleibt unvollständig (kein Fehler)", () => {
    const r = evaluateFormula("LN(messwert_a)", {}, { knownReferences: ["messwert_a"] });
    expect(r).toEqual({ value: null, error: null });
  });

  it("ist in der Funktionsliste des Editors verfügbar", () => {
    expect(FORMULA_FUNCTIONS).toContain("LN");
    expect(formulaFunctionLabel("LN")).toBe("LN(x) – Natürlicher Logarithmus");
  });

  it("bestehende Formeln bleiben unverändert gültig", () => {
    expect(val("AVERAGE(a, b)", { a: 2, b: 4 }).value).toBe(3);
    expect(val("SQRT(16)").value).toBe(4);
    expect(val("CEIL((COUNT(t)+1)/2)", { t: [550, 600, 650] }).value).toBe(2);
  });
});
