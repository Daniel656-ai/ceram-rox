import { describe, it, expect } from "vitest";
import { compareStock, convertQuantity, defaultRecipeUnit } from "@/lib/recipeUnits";

describe("convertQuantity", () => {
  it("rechnet g und kg in beide Richtungen um", () => {
    expect(convertQuantity(500, "g", "kg")).toBe(0.5);
    expect(convertQuantity(25, "kg", "g")).toBe(25000);
    expect(convertQuantity(1.5, "kg", "g")).toBe(1500);
  });

  it("rechnet ml und l um", () => {
    expect(convertQuantity(2, "l", "ml")).toBe(2000);
    expect(convertQuantity(250, "ml", "l")).toBe(0.25);
  });

  it("lässt gleiche Einheiten unverändert (Groß-/Kleinschreibung egal)", () => {
    expect(convertQuantity(7, "kg", "KG")).toBe(7);
    expect(convertQuantity(3, "Stk", "Stk")).toBe(3);
  });

  it("gibt null bei inkompatiblen oder unbekannten Einheiten zurück", () => {
    expect(convertQuantity(1, "kg", "l")).toBeNull();
    expect(convertQuantity(1, "kg", "Stk")).toBeNull();
    expect(convertQuantity(1, "", "kg")).toBeNull();
  });

  it("gibt null bei ungültigen Zahlen zurück", () => {
    expect(convertQuantity("abc", "g", "kg")).toBeNull();
  });
});

describe("defaultRecipeUnit", () => {
  it("stellt Feststoffe (kg) auf g um", () => {
    expect(defaultRecipeUnit("kg")).toBe("g");
    expect(defaultRecipeUnit("KG")).toBe("g");
  });

  it("behält flüssige und sonstige Stammdateneinheiten", () => {
    expect(defaultRecipeUnit("l")).toBe("l");
    expect(defaultRecipeUnit("ml")).toBe("ml");
    expect(defaultRecipeUnit("Stk")).toBe("Stk");
  });

  it("liefert leere Einheit bei fehlender Stammdateneinheit", () => {
    expect(defaultRecipeUnit(null)).toBe("");
    expect(defaultRecipeUnit(undefined)).toBe("");
  });
});

describe("compareStock", () => {
  it("500 g Bedarf bei 25 kg Bestand: kein Fehlmengenalarm", () => {
    const c = compareStock(500, "g", 25, "kg");
    expect(c).not.toBeNull();
    expect(c!.short).toBe(false);
    expect(c!.required).toBe(0.5);
    expect(c!.available).toBe(25);
    expect(c!.unit).toBe("kg");
  });

  it("30 kg Bedarf bei 25 kg Bestand: Fehlmenge", () => {
    const c = compareStock(30, "kg", 25, "kg");
    expect(c!.short).toBe(true);
  });

  it("26.000 g Bedarf bei 25 kg Bestand: Fehlmenge (einheitenbereinigt)", () => {
    const c = compareStock(26000, "g", 25, "kg");
    expect(c!.short).toBe(true);
    expect(c!.required).toBe(26);
  });

  it("inkompatible Einheiten lösen keinen Alarm aus (null statt Raten)", () => {
    expect(compareStock(5, "Stk", 25, "kg")).toBeNull();
  });

  it("ungültige Zahlen liefern null", () => {
    expect(compareStock("x", "g", 25, "kg")).toBeNull();
    expect(compareStock(5, "g", "x", "kg")).toBeNull();
  });
});
