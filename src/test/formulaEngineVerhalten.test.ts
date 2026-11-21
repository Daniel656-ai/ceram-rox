/**
 * Systematische Tests der Formel-Engine (lib/formulaEngine.ts).
 *
 * Ergänzt die bestehenden Tests formulaComparison (Vergleiche in IF),
 * formulaLn (LN) und formulaTrig (Trigonometrie, griechische Variablen).
 * Diese werden hier nicht wiederholt.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateFormula,
  extractReferences,
  FORMULA_FUNCTIONS,
  FORMULA_FUNCTION_INFO,
  FORMULA_CONSTANTS,
  formulaFunctionLabel,
} from "@/lib/formulaEngine";

const val = (f: string, ctx: Record<string, unknown> = {}) => evaluateFormula(f, ctx).value;
const err = (f: string, ctx: Record<string, unknown> = {}) => evaluateFormula(f, ctx).error;

describe("Formel-Engine: Grundrechenarten und Vorrang", () => {
  it("rechnet Addition, Subtraktion, Multiplikation und Division", () => {
    expect(val("2 + 3")).toBe(5);
    expect(val("2 - 3")).toBe(-1);
    expect(val("2 * 3")).toBe(6);
    expect(val("7 / 2")).toBe(3.5);
  });

  it("rechnet Punkt vor Strich", () => {
    expect(val("2 + 3 * 4")).toBe(14);
    expect(val("20 - 8 / 2")).toBe(16);
  });

  it("wertet gleichrangige Operatoren von links nach rechts aus", () => {
    expect(val("10 - 4 - 3")).toBe(3);
    expect(val("8 / 2 / 2")).toBe(2);
  });

  it("beachtet Klammern, auch verschachtelt", () => {
    expect(val("(2 + 3) * 4")).toBe(20);
    expect(val("((1 + 1) * (2 + 3)) / 5")).toBe(2);
  });

  it("rechnet % als Prozentanteil: a % b = a * b / 100", () => {
    expect(val("50 % 20")).toBe(10);
    expect(val("200 % 5 + 1")).toBe(11);
  });

  it("ignoriert Leerzeichen und Zeilenumbrüche", () => {
    expect(val("  2+\n3 *\t4 ")).toBe(14);
  });
});

describe("Formel-Engine: Vorzeichen", () => {
  it("unterstützt unäres Minus vor Zahl, Klammer und Feld", () => {
    expect(val("-3 + 5")).toBe(2);
    expect(val("-(2 + 3)")).toBe(-5);
    expect(val("-a", { a: 4 })).toBe(-4);
  });

  it("unterstützt Vorzeichen nach einem Operator und mehrfache Vorzeichen", () => {
    expect(val("2 * -3")).toBe(-6);
    expect(val("--3")).toBe(3);
    expect(val("+3 - +1")).toBe(2);
  });
});

describe("Formel-Engine: Zahlen", () => {
  it("liest Dezimalzahlen mit Punkt in der Formel", () => {
    expect(val("1.5 * 2")).toBe(3);
    expect(val(".5 + 1")).toBe(1.5);
  });

  it("erlaubt Unterstriche als Tausendertrenner in Zahlen der Formel", () => {
    expect(val("1_000 + 1")).toBe(1001);
  });

  it("liest deutsche Zahlenformate aus Feldwerten (Komma, Tausenderpunkt)", () => {
    expect(val("a * 2", { a: "1,25" })).toBe(2.5);
    expect(val("a + 0", { a: "1.234,56" })).toBe(1234.56);
    expect(val("a + 0", { a: " 12 " })).toBe(12);
  });

  it("nimmt bei Feldwerten mit Einheit die führende Zahl", () => {
    expect(val("a + 0", { a: "550 °C" })).toBe(550);
    expect(val("a + 0", { a: "-3,5 mm" })).toBe(-3.5);
  });

  // Bekannter Fehler: tasks/Fehler.md#F-7
  it.fails("meldet einen Feldwert im englischen Format (1,234.5) als Fehler statt still mit 1 zu rechnen", () => {
    expect(evaluateFormula("a + 0", { a: "1,234.5" }).error).toEqual(expect.any(String));
  });

  // Bekannter Fehler: tasks/Fehler.md#F-8
  it.fails("meldet eine Zahl mit zwei Dezimalpunkten in der Formel (1.2.3) als Fehler", () => {
    expect(evaluateFormula("1.2.3 + 1", {}).error).toEqual(expect.any(String));
  });

  it("wertet Wahrheitswerte aus Feldern als 1 und 0", () => {
    expect(val("a * 10 + b", { a: true, b: false })).toBe(10);
  });
});

describe("Formel-Engine: Felder und Konstanten", () => {
  it("setzt Feldwerte aus dem Kontext ein, auch mit Punkt-Notation", () => {
    expect(val("masse / volumen", { masse: 10, volumen: 4 })).toBe(2.5);
    expect(val("probe.dichte * 2", { "probe.dichte": 1.5 })).toBe(3);
  });

  it("kennt die Konstanten PI, π und E, auch kleingeschrieben", () => {
    expect(val("PI")).toBeCloseTo(Math.PI, 12);
    expect(val("π")).toBeCloseTo(Math.PI, 12);
    expect(val("pi")).toBeCloseTo(Math.PI, 12);
    expect(val("E")).toBeCloseTo(Math.E, 12);
    expect(FORMULA_CONSTANTS).toEqual(expect.arrayContaining(["PI", "π", "E"]));
  });

  it("lässt ein gleichnamiges Feld Vorrang vor der Konstanten haben", () => {
    expect(val("E * 2", { E: 5 })).toBe(10);
  });

  it("meldet ein unbekanntes Feld mit Name und Position", () => {
    expect(evaluateFormula("1 + xyz", {})).toEqual({
      value: null,
      error: "Unbekanntes Feld: xyz (Position 5)",
    });
  });

  it("bleibt ohne Fehler leer, wenn ein bekanntes Feld noch keinen Wert hat", () => {
    expect(evaluateFormula("a + 1", {}, { knownReferences: ["a"] })).toEqual({ value: null, error: null });
    // Andere unbekannte Referenzen bleiben ein Fehler.
    expect(evaluateFormula("b + 1", {}, { knownReferences: ["a"] }).error).toBe("Unbekanntes Feld: b (Position 1)");
  });

  it("bleibt ohne Fehler leer bei leerem, fehlendem oder Text-Feldwert", () => {
    for (const leer of [null, undefined, "", "abc"]) {
      expect(evaluateFormula("a + 1", { a: leer })).toEqual({ value: null, error: null });
    }
  });

  // Bekannter Fehler: tasks/Fehler.md#F-4
  it.fails("behandelt einen Feldwert nur aus Leerzeichen wie einen leeren Wert statt als 0", () => {
    expect(evaluateFormula("a + 1", { a: "   " })).toEqual({ value: null, error: null });
  });
});

describe("Formel-Engine: Funktionen", () => {
  it("SUM, AVERAGE/AVG, MIN, MAX über einzelne Werte", () => {
    expect(val("SUM(1, 2, 3)")).toBe(6);
    expect(val("AVERAGE(1, 2, 6)")).toBe(3);
    expect(val("AVG(2, 4)")).toBe(3);
    expect(val("MIN(3, -1, 2)")).toBe(-1);
    expect(val("MAX(3, -1, 2)")).toBe(3);
  });

  it("Aggregatfunktionen arbeiten direkt auf Listenwerten (Mehrfachauswahl)", () => {
    const ctx = { T: [550, 600, 650, 700] };
    expect(val("SUM(T)", ctx)).toBe(2500);
    expect(val("AVERAGE(T)", ctx)).toBe(625);
    expect(val("MIN(T)", ctx)).toBe(550);
    expect(val("MAX(T)", ctx)).toBe(700);
    expect(val("COUNT(T)", ctx)).toBe(4);
    expect(val("SUM(T, 50)", ctx)).toBe(2550);
  });

  it("überspringt nicht-numerische Listeneinträge, COUNT zählt sie aber mit", () => {
    const ctx = { L: ["1", "x", "3"] };
    expect(val("SUM(L)", ctx)).toBe(4);
    expect(val("AVERAGE(L)", ctx)).toBe(2);
    expect(val("COUNT(L)", ctx)).toBe(3);
  });

  it("SUM, MIN und MAX übergehen ein leeres Feld wie Excel und rechnen mit den übrigen Werten", () => {
    const ctx = { a: "", b: null };
    expect(val("SUM(a, 5)", ctx)).toBe(5);
    expect(val("MIN(a, 5)", ctx)).toBe(5);
    expect(val("MAX(a, b, -5)", ctx)).toBe(-5);
  });

  it("COUNT zählt einzelne leere Werte nicht", () => {
    expect(val("COUNT(a, b, c)", { a: 1, b: "", c: 3 })).toBe(2);
  });

  it("liefert SUM einer leeren Liste 0, AVERAGE/MIN/MAX/MEDIAN dagegen keinen Wert", () => {
    const ctx = { L: [] };
    expect(val("SUM(L)", ctx)).toBe(0);
    expect(evaluateFormula("AVERAGE(L)", ctx)).toEqual({ value: null, error: null });
    expect(val("MIN(L)", ctx)).toBeNull();
    expect(val("MAX(L)", ctx)).toBeNull();
    expect(val("MEDIAN(L)", ctx)).toBeNull();
  });

  it("MEDIAN bei ungerader und gerader Anzahl, unsortiert", () => {
    expect(val("MEDIAN(5, 1, 3)")).toBe(3);
    expect(val("MEDIAN(4, 1, 3, 2)")).toBe(2.5);
  });

  it("ROUND rundet auf n Nachkommastellen, ohne n auf ganze Zahlen, mit negativem n auf Zehner", () => {
    expect(val("ROUND(3.14159, 2)")).toBe(3.14);
    expect(val("ROUND(2.5)")).toBe(3);
    expect(val("ROUND(1234.5678, -2)")).toBe(1200);
  });

  // Bekannter Fehler: tasks/Fehler.md#F-3
  it.fails("ROUND eines leeren Feldes bleibt leer, statt die Nachkommastellen als Wert zu liefern", () => {
    expect(evaluateFormula("ROUND(a, 2)", { a: "" })).toEqual({ value: null, error: null });
  });

  // Bekannter Fehler: tasks/Fehler.md#F-5
  it.fails("ROUND mit leerer Stellenzahl meldet einen Fehler statt still auf eine ganze Zahl zu runden", () => {
    expect(evaluateFormula("ROUND(a, n)", { a: 2.567, n: "" }).error).toEqual(expect.any(String));
  });

  // Bekannter Fehler: tasks/Fehler.md#F-6
  it.fails("ROUND rundet negative Hälften wie Excel von der Null weg: ROUND(-2.5) = -3", () => {
    expect(val("ROUND(-2.5)")).toBe(-3);
  });

  // Bekannter Fehler: tasks/Fehler.md#F-6
  it.fails("ROUND rundet wie Excel ohne Gleitkomma-Abweichung: ROUND(1.005; 2) = 1,01", () => {
    expect(val("ROUND(1.005; 2)")).toBe(1.01);
  });

  it("ROUND eines bekannten Feldes ohne Kontexteintrag bleibt leer", () => {
    expect(evaluateFormula("ROUND(a, 2)", {}, { knownReferences: ["a"] })).toEqual({ value: null, error: null });
  });

  it("CEIL/ROUNDUP/AUFRUNDEN runden auf, FLOOR/ROUNDDOWN/ABRUNDEN runden ab", () => {
    for (const f of ["CEIL", "ROUNDUP", "AUFRUNDEN"]) {
      expect(val(`${f}(2.1)`)).toBe(3);
      expect(val(`${f}(-2.1)`)).toBe(-2);
    }
    for (const f of ["FLOOR", "ROUNDDOWN", "ABRUNDEN"]) {
      expect(val(`${f}(2.9)`)).toBe(2);
      expect(val(`${f}(-2.1)`)).toBe(-3);
    }
  });

  it("ABS, SQRT und POW", () => {
    expect(val("ABS(-4.5)")).toBe(4.5);
    expect(val("SQRT(16)")).toBe(4);
    expect(val("POW(2, 10)")).toBe(1024);
    expect(val("POW(9, 0.5)")).toBe(3);
  });

  it("SQRT einer negativen Zahl liefert keinen Wert", () => {
    expect(evaluateFormula("SQRT(-1)", {})).toEqual({ value: null, error: null });
  });

  it("Funktionsnamen sind unabhängig von Groß-/Kleinschreibung", () => {
    expect(val("sum(1, 2)")).toBe(3);
    expect(val("Max(1, 2)")).toBe(2);
  });

  it("akzeptiert Semikolon als Parametertrenner", () => {
    expect(val("SUM(1; 2; 3)")).toBe(6);
    expect(val("ROUND(2.567; 1)")).toBe(2.6);
  });

  it("verschachtelt Funktionen und Ausdrücke als Parameter", () => {
    expect(val("ROUND(AVERAGE(a, b) * 2, 1)", { a: 1.04, b: 2 })).toBe(3);
    expect(val("MAX(a + 1, b * 2)", { a: 5, b: 2 })).toBe(6);
  });

  it("IF wählt den Dann- oder Sonst-Zweig, ohne Sonst-Zweig ist das Ergebnis 0", () => {
    expect(val("IF(a > 0, 10, 20)", { a: 1 })).toBe(10);
    expect(val("IF(a > 0, 10, 20)", { a: -1 })).toBe(20);
    expect(val("IF(a > 0, 10)", { a: -1 })).toBe(0);
  });

  it("IF mit nur einem Parameter meldet die erwartete Schreibweise", () => {
    expect(err("IF(1)")).toBe("IF() erwartet: IF(Bedingung, Dann, Sonst)");
  });

  it("jede Funktion hat eine Beschreibung und erscheint im Editor-Label", () => {
    expect(FORMULA_FUNCTIONS.length).toBeGreaterThan(0);
    for (const name of FORMULA_FUNCTIONS) {
      expect(FORMULA_FUNCTION_INFO[name], name).toBeTruthy();
    }
    expect(formulaFunctionLabel("ROUND")).toBe("ROUND(x, n) – Runden (Wert, Nachkommastellen)");
    expect(formulaFunctionLabel("ABS")).toBe("ABS(x) – Absolutwert");
    expect(formulaFunctionLabel("UNBEKANNT")).toBe("UNBEKANNT(x)");
  });
});

describe("Formel-Engine: Vergleiche außerhalb von IF", () => {
  it("liefert 1 für wahr und 0 für falsch, auch mit <>", () => {
    expect(val("3 > 2")).toBe(1);
    expect(val("3 < 2")).toBe(0);
    expect(val("2 <> 3")).toBe(1);
    expect(val("2 <> 2")).toBe(0);
  });

  it("vergleicht mit niedrigster Priorität (a + b > c)", () => {
    expect(val("1 + 2 > 2")).toBe(1);
    expect(val("1 + 2 = 3")).toBe(1);
  });

  it("lässt geklammerte Vergleiche in Rechnungen zu", () => {
    expect(val("(a > 1) * 10 + 1", { a: 2 })).toBe(11);
    expect(val("(a > 1) * 10 + 1", { a: 0 })).toBe(1);
  });

  it("meldet verkettete Vergleiche ohne Klammern als Fehler", () => {
    expect(err("1 < 2 < 3")).toBe(
      "Unerwartete Eingabe nach dem Ausdruck (Position 7) – fehlt hier ein Operator (+, -, *, /) oder ein Komma?",
    );
  });
});

describe("Formel-Engine: Fehlerfälle", () => {
  it("leere Formel liefert weder Wert noch Fehler", () => {
    expect(evaluateFormula("", {})).toEqual({ value: null, error: null });
    expect(evaluateFormula("   ", {})).toEqual({ value: null, error: null });
    expect(evaluateFormula(null as unknown as string, {})).toEqual({ value: null, error: null });
  });

  it("Division durch 0 liefert keinen Wert und keinen Fehler", () => {
    expect(evaluateFormula("5 / 0", {})).toEqual({ value: null, error: null });
    expect(evaluateFormula("a / b", { a: 1, b: "0" })).toEqual({ value: null, error: null });
  });

  it("meldet eine unbekannte Funktion mit Liste der verfügbaren", () => {
    const e = err("FOO(1)");
    expect(e).toMatch(/^Unbekannte Funktion: FOO \(Position 1\) – verfügbar: /);
    expect(e).toContain("SUM");
    expect(e).toContain("IF");
  });

  it("meldet fehlende schließende Klammer im Ausdruck und in Funktionen", () => {
    expect(err("(1 + 2")).toBe("Schließende Klammer ')' fehlt (Position 1)");
    expect(err("SUM(1, 2")).toBe("Schließende Klammer ')' für SUM( fehlt.");
    expect(err("IF(1, 2")).toBe("Schließende Klammer ')' für IF( fehlt.");
  });

  it("meldet einen unvollständigen Ausdruck", () => {
    expect(err("1 +")).toBe("Unerwartetes Ende der Formel – der Ausdruck ist unvollständig.");
    expect(err("2 * (")).toBe("Unerwartetes Ende der Formel – der Ausdruck ist unvollständig.");
  });

  it("meldet zwei Werte ohne Operator dazwischen", () => {
    expect(err("1 2")).toBe(
      "Unerwartete Eingabe nach dem Ausdruck (Position 3) – fehlt hier ein Operator (+, -, *, /) oder ein Komma?",
    );
  });

  it("meldet Dezimalkomma in der Formel selbst als Fehler statt falsch zu rechnen", () => {
    expect(val("1,5 * 2")).toBeNull();
    expect(err("1,5 * 2")).toMatch(/^Unerwartete Eingabe nach dem Ausdruck \(Position 2\)/);
  });

  it("meldet fehlendes Komma zwischen Funktionsparametern", () => {
    expect(err("SUM(a b)", { a: 1, b: 2 })).toBe(
      "Zwischen den Parametern von SUM() fehlt ein Komma (Position 7) – Schreibweise: SUM(Feld1, Feld2, Feld3)",
    );
    // In IF() wird jeder Parameter als eigener Ausdruck gelesen; der Fehler nennt die Stelle.
    expect(evaluateFormula("IF(1 2, 3)", {}).value).toBeNull();
    expect(err("IF(1 2, 3)")).toMatch(/Position 6/);
  });

  it("meldet überzählige Klammern und Kommas", () => {
    expect(err(")")).toBe("Unerwartete schließende Klammer ')' (Position 1)");
    expect(err(", 1")).toBe("Unerwartetes Komma (Position 1) – Kommas trennen nur Funktionsparameter.");
  });

  it("meldet unbekannte Zeichen und ein einzelnes Ausrufezeichen", () => {
    expect(err("2 # 3")).toBe("Unerwartetes Zeichen: '#' (Position 3)");
    expect(err("!a", { a: 1 })).toBe("Unerwartetes Zeichen: '!' (Position 1) – für „ungleich“ bitte != verwenden.");
  });

  it("eine Liste mit mehreren Werten ergibt in einer Rechnung keinen Wert, eine einelementige Liste schon", () => {
    expect(evaluateFormula("L + 1", { L: [1, 2] })).toEqual({ value: null, error: null });
    expect(val("L + 1", { L: [5] })).toBe(6);
  });
});

describe("Formel-Engine: extractReferences", () => {
  it("liefert Feldreferenzen in Reihenfolge des ersten Auftretens ohne Dubletten", () => {
    expect(extractReferences("b * a + b / c")).toEqual(["b", "a", "c"]);
  });

  it("lässt Funktionsnamen weg, behält aber deren Argumente", () => {
    expect(extractReferences("ROUND(AVERAGE(x, y), 2) + sum(z)")).toEqual(["x", "y", "z"]);
  });

  it("behält Punkt-Notation und griechische Namen als einen Bezeichner", () => {
    expect(extractReferences("probe.dichte * Δm")).toEqual(["probe.dichte", "Δm"]);
  });

  it("liefert für Formeln ohne Referenzen, leere Formeln und unlesbare Formeln eine leere Liste", () => {
    expect(extractReferences("1 + 2")).toEqual([]);
    expect(extractReferences("")).toEqual([]);
    expect(extractReferences(null as unknown as string)).toEqual([]);
    expect(extractReferences("a # b")).toEqual([]);
  });
});
