import { describe, it, expect } from "vitest";
import { evaluateFormula } from "@/lib/formulaEngine";

const val = (f: string, ctx: Record<string, unknown> = {}) =>
  evaluateFormula(f, ctx).value;

describe("Vergleichsoperatoren in IF()", () => {
  it("wertet <= inklusive der Gleichheit aus", () => {
    expect(val("IF(Alpha <= 1, 100, 200)", { Alpha: 0.8 })).toBe(100);
    expect(val("IF(Alpha <= 1, 100, 200)", { Alpha: 1 })).toBe(100);
    expect(val("IF(Alpha <= 1, 100, 200)", { Alpha: 1.2 })).toBe(200);
  });

  it("unterstützt alle Vergleichsoperatoren", () => {
    expect(val("IF(Alpha < 1, 100, 200)", { Alpha: 1 })).toBe(200);
    expect(val("IF(Alpha >= 1, 100, 200)", { Alpha: 1 })).toBe(100);
    expect(val("IF(Alpha > 1, 100, 200)", { Alpha: 1 })).toBe(200);
    expect(val("IF(Alpha = 1, 100, 200)", { Alpha: 1 })).toBe(100);
    expect(val("IF(Alpha == 1, 100, 200)", { Alpha: 1 })).toBe(100);
    expect(val("IF(Alpha != 1, 100, 200)", { Alpha: 1 })).toBe(200);
    expect(val("IF(Alpha != 1, 100, 200)", { Alpha: 2 })).toBe(100);
  });

  it("vergleicht auch Feld gegen Feld und Ausdrücke", () => {
    expect(val("IF(Temperatur > Grenze, 1, 0)", { Temperatur: 600, Grenze: 500 })).toBe(1);
    expect(val("IF(a + b >= 10, 1, 0)", { a: 4, b: 6 })).toBe(1);
    expect(val("IF((a - b) < 0, 1, 0)", { a: 1, b: 2 })).toBe(1);
  });

  it("wertet nur den zutreffenden Zweig aus (verschachtelt)", () => {
    const f = "IF(Alpha <= 1, AV * 0.5 * LN(Alpha), IF(Alpha > 2, 3, 4))";
    expect(val(f, { Alpha: 1, AV: 2 })).toBe(0);
    expect(val(f, { Alpha: 3, AV: 2 })).toBe(3);
    // Ungültiger LN-Zweig stört nicht, wenn er nicht gewählt wird
    expect(val("IF(x > 0, 1, LN(-1))", { x: 5 })).toBe(1);
  });

  it("bleibt ohne Wert leer statt falsch", () => {
    const r = evaluateFormula("IF(Alpha <= 1, 100, 200)", {}, { knownReferences: ["Alpha"] });
    expect(r.value).toBeNull();
    expect(r.error).toBeNull();
  });

  it("verändert bestehende Formeln nicht", () => {
    expect(val("(a - b) / b * 100", { a: 12, b: 10 })).toBe(20);
    expect(val("ROUND(AVERAGE(a, b), 1)", { a: 1, b: 2 })).toBe(1.5);
  });
});
