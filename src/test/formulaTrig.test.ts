import { describe, it, expect } from "vitest";
import { evaluateFormula, FORMULA_FUNCTIONS, formulaFunctionLabel } from "@/lib/formulaEngine";

const val = (f: string, ctx: Record<string, unknown> = {}) => evaluateFormula(f, ctx);

describe("Formeleditor: Trigonometrie & griechische Variablen", () => {
  it("SIN/COS/TAN rechnen im Bogenmaß", () => {
    expect(val("SIN(0)").value).toBe(0);
    expect(val("COS(0)").value).toBe(1);
    expect(val("SIN(π/2)").value!).toBeCloseTo(1, 10);
    expect(val("TAN(π/4)").value!).toBeCloseTo(1, 10);
  });

  it("Umkehrfunktionen liefern Bogenmaß", () => {
    expect(val("ASIN(1)").value!).toBeCloseTo(Math.PI / 2, 10);
    expect(val("ACOS(1)").value).toBe(0);
    expect(val("ATAN(1)").value!).toBeCloseTo(Math.PI / 4, 10);
  });

  it("meldet ungültige Wertebereiche verständlich", () => {
    expect(val("ASIN(2)")).toEqual({
      value: null,
      error: "ASIN() ist nur für Werte zwischen -1 und 1 definiert.",
    });
    expect(val("ACOS(-2)").error).toBe("ACOS() ist nur für Werte zwischen -1 und 1 definiert.");
    expect(val("TAN(π/2)").error).toBe("TAN() ist für 90° (π/2) nicht definiert.");
  });

  it("griechische Feldreferenzen sind gültig", () => {
    expect(val("SIN(α)", { α: Math.PI / 2 }).value!).toBeCloseTo(1, 10);
    expect(val("SIN(α) * COS(β)", { α: Math.PI / 2, β: 0 }).value!).toBeCloseTo(1, 10);
    expect(val("α * π / 180", { α: 180 }).value!).toBeCloseTo(Math.PI, 10);
    expect(val("ΔT + σ_x", { ΔT: 5, σ_x: 2 }).value).toBe(7);
  });

  it("Grad-/Bogenmaß-Umrechnung", () => {
    expect(val("DEGREES(ATAN(y/x))", { y: 1, x: 1 }).value!).toBeCloseTo(45, 10);
    expect(val("180 * ATAN(y/x) / π", { y: 1, x: 1 }).value!).toBeCloseTo(45, 10);
    expect(val("SIN(RADIANS(90))").value!).toBeCloseTo(1, 10);
  });

  it("kombiniert mit LN und bestehenden Funktionen", () => {
    expect(val("LN(SIN(α))", { α: Math.PI / 2 }).value!).toBeCloseTo(0, 10);
    expect(val("LN(α)", { α: 10 }).value!).toBeCloseTo(2.302585, 6);
    expect(val("LN(0)").error).toBe("LN() ist nur für Werte > 0 definiert.");
    expect(val("SQRT(16)").value).toBe(4);
    expect(val("ABS(-3)").value).toBe(3);
  });

  it("erscheint in der Funktionsliste des Editors", () => {
    ["SIN", "COS", "TAN", "ASIN", "ACOS", "ATAN"].forEach((f) =>
      expect(FORMULA_FUNCTIONS).toContain(f)
    );
    expect(formulaFunctionLabel("ATAN")).toBe("ATAN(x) – Arkustangens (Ergebnis im Bogenmaß)");
  });

  it("fehlende Werte bleiben unvollständig statt NaN", () => {
    expect(evaluateFormula("SIN(α)", {}, { knownReferences: ["α"] })).toEqual({
      value: null,
      error: null,
    });
  });
});
