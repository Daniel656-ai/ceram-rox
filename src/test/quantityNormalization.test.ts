import { describe, it, expect } from "vitest";
import { normalizeQuantity, parseQuantity, formatQuantity } from "@/lib/formatQuantity";

describe("Liefermenge – Interpretation (Dezimalpunkt/-komma)", () => {
  it("liest Komma- und Punktdezimalen korrekt", () => {
    expect(parseQuantity("125,1234")).toBe(125.1234);
    expect(parseQuantity("125.1234")).toBe(125.1234);
    expect(parseQuantity(125.1234)).toBe(125.1234);
  });
  it("erkennt Tausendertrenner", () => {
    expect(parseQuantity("1.234,5")).toBe(1234.5);
    expect(parseQuantity("1,234.5")).toBe(1234.5);
    expect(parseQuantity("1.234.567")).toBe(1234567);
  });
  it("ignoriert Einheiten und leere Werte", () => {
    expect(parseQuantity("50,5 kg")).toBe(50.5);
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });
});

describe("Liefermenge – Normalisierung auf 3 Nachkommastellen", () => {
  it("Test C/E: 125,123456 → 125,123", () => {
    expect(normalizeQuantity("125,123456")).toBe(125.123);
    expect(normalizeQuantity(125.123456)).toBe(125.123);
  });
  it("Test D: 125,1235 → 125,124 (kaufmännisch gerundet)", () => {
    expect(normalizeQuantity(125.1235)).toBe(125.124);
  });
  it("rundet mathematisch korrekt, schneidet nicht ab", () => {
    expect(normalizeQuantity(12.3454)).toBe(12.345);
    expect(normalizeQuantity(12.3455)).toBe(12.346);
    expect(normalizeQuantity(12.9999)).toBe(13);
    expect(normalizeQuantity(50.12345)).toBe(50.123);
    expect(normalizeQuantity(10.123456)).toBe(10.123);
  });
  it("lässt Werte mit ≤ 3 Nachkommastellen unverändert", () => {
    expect(normalizeQuantity(25)).toBe(25);
    expect(normalizeQuantity(21.795)).toBe(21.795);
  });
  it("bereinigt Gleitkomma-Artefakte aus früheren Importen", () => {
    expect(normalizeQuantity(219.39999999999992)).toBe(219.4);
    expect(normalizeQuantity(-5.329070518200751e-15)).toBe(0);
  });
  it("Test F: Anzeige entspricht dem gespeicherten Wert", () => {
    expect(formatQuantity(normalizeQuantity(125.123456))).toBe("125,123");
    expect(formatQuantity(normalizeQuantity(25))).toBe("25,000");
  });
});
