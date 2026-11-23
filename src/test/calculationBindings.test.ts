/**
 * Variablenzuordnung globaler Berechnungen (lib/calculationBindings.ts):
 * Eingangsquellen, Ausgabeziele, fehlende Quellen und Fehlerweitergabe.
 */
import { describe, it, expect } from "vitest";
import {
  applyCalculationOutputs,
  parseInputBindings,
  parseOutputBinding,
  resolveBinding,
  runCalculation,
  type CalcInputBinding,
} from "@/lib/calculationBindings";
import type { GlobalCalculation } from "@/lib/api/globalLibrary";

const calc = (over: Partial<GlobalCalculation> & { calc_key: string; formula: string }): GlobalCalculation => ({
  id: `gc-${over.calc_key}`,
  display_name: over.calc_key,
  description: null,
  category: null,
  unit: null,
  decimals: 2,
  inputs: [],
  input_bindings: [],
  output_binding: null,
  is_system: false,
  archived_at: null,
  created_by: null,
  created_at: "",
  updated_at: "",
  ...over,
});

const bind = (over: Partial<CalcInputBinding> & { variable: string }): CalcInputBinding => ({
  source: "form_field",
  ...over,
});

describe("Rechen-Bindings: Eingangsbindungen lesen", () => {
  it("übernimmt gültige Bindungen und setzt ohne Quelle „Formularfeld“", () => {
    expect(
      parseInputBindings([
        { variable: "m", ref: "masse" },
        { variable: "k", source: "constant", value: 2 },
      ]),
    ).toEqual([
      { variable: "m", ref: "masse", source: "form_field" },
      { variable: "k", source: "constant", value: 2 },
    ]);
  });

  it("verwirft Einträge ohne Variablennamen und Nicht-Listen", () => {
    expect(parseInputBindings([null, 5, { ref: "x" }, { variable: 3 }, { variable: "ok" }])).toEqual([
      { variable: "ok", source: "form_field" },
    ]);
    expect(parseInputBindings(null)).toEqual([]);
    expect(parseInputBindings({ variable: "a" })).toEqual([]);
  });
});

describe("Rechen-Bindings: Ausgabebindung lesen", () => {
  it("liest Ziel, Schlüssel und Bezeichnung; ohne Ziel gilt „Formularfeld“", () => {
    expect(parseOutputBinding({ target: "report", ref: "dichte", label: "Dichte" })).toEqual({
      target: "report",
      ref: "dichte",
      label: "Dichte",
    });
    expect(parseOutputBinding({ ref: 42 })).toEqual({ target: "form_field", ref: "42", label: null });
  });

  it("liefert null ohne Zielschlüssel oder ohne Objekt", () => {
    expect(parseOutputBinding({ target: "form_field" })).toBeNull();
    expect(parseOutputBinding({ target: "form_field", ref: "" })).toBeNull();
    expect(parseOutputBinding(null)).toBeNull();
    expect(parseOutputBinding("dichte")).toBeNull();
  });
});

describe("Rechen-Bindings: Eingangsvariable auflösen", () => {
  it("liefert konstante Werte unverändert, fehlender Wert wird null", () => {
    expect(resolveBinding(bind({ variable: "k", source: "constant", value: "1,5" }), {})).toBe("1,5");
    expect(resolveBinding(bind({ variable: "k", source: "constant" }), {})).toBeNull();
  });

  it("liest Formularfelder; mit Semikolon getrennte Texte werden zur Liste", () => {
    const env = { formValues: { masse: 12, temps: "550; 600 ;;650", liste: [1, 2] } };
    expect(resolveBinding(bind({ variable: "m", ref: "masse" }), env)).toBe(12);
    expect(resolveBinding(bind({ variable: "t", ref: "temps" }), env)).toEqual(["550", "600", "650"]);
    expect(resolveBinding(bind({ variable: "l", ref: "liste" }), env)).toEqual([1, 2]);
  });

  it("liefert für fehlende Formularfelder oder fehlende Formularwerte undefined", () => {
    expect(resolveBinding(bind({ variable: "m", ref: "fehlt" }), { formValues: {} })).toBeUndefined();
    expect(resolveBinding(bind({ variable: "m", ref: "masse" }), {})).toBeUndefined();
  });

  it("liest System- und Stammdatenvariablen, mit Rückfall auf Formularwerte", () => {
    const env = {
      systemVariables: { "probe.dichte": 2.5, gemeinsam: "system" },
      formValues: { "probe.nur_formular": 7, gemeinsam: "formular" },
    };
    expect(resolveBinding(bind({ variable: "d", source: "system", ref: "probe.dichte" }), env)).toBe(2.5);
    expect(resolveBinding(bind({ variable: "d", source: "master_data", ref: "probe.dichte" }), env)).toBe(2.5);
    expect(resolveBinding(bind({ variable: "d", source: "system", ref: "probe.nur_formular" }), env)).toBe(7);
    expect(resolveBinding(bind({ variable: "d", source: "system", ref: "gemeinsam" }), env)).toBe("system");
  });

  it("rechnet eine andere Berechnung aus und liefert deren Wert", () => {
    const flaeche = calc({
      calc_key: "flaeche",
      formula: "a * b",
      input_bindings: [
        { variable: "a", source: "form_field", ref: "laenge" },
        { variable: "b", source: "form_field", ref: "breite" },
      ],
    });
    const env = { formValues: { laenge: 3, breite: 4 }, calculations: [flaeche] };
    expect(resolveBinding(bind({ variable: "f", source: "calculation", ref: "flaeche" }), env)).toBe(12);
  });

  it("liefert null für unbekannte oder leere Berechnungsreferenzen und unbekannte Quellen", () => {
    const env = { calculations: [calc({ calc_key: "x", formula: "1" })] };
    expect(resolveBinding(bind({ variable: "f", source: "calculation", ref: "gibtsnicht" }), env)).toBeNull();
    expect(resolveBinding(bind({ variable: "f", source: "calculation", ref: "" }), env)).toBeNull();
    expect(resolveBinding(bind({ variable: "f", source: "calculation", ref: "x" }), {})).toBeNull();
    expect(resolveBinding({ variable: "f", source: "unbekannt" as never, ref: "x" }, env)).toBeNull();
  });

  it("bricht zyklische Verweise zwischen Berechnungen ab, ohne Wert und ohne Endlosschleife", () => {
    const a = calc({ calc_key: "a", formula: "vb + 1", input_bindings: [{ variable: "vb", source: "calculation", ref: "b" }] });
    const b = calc({ calc_key: "b", formula: "va + 1", input_bindings: [{ variable: "va", source: "calculation", ref: "a" }] });
    const env = { calculations: [a, b] };
    expect(resolveBinding(bind({ variable: "x", source: "calculation", ref: "a" }), env)).toBeNull();
    expect(runCalculation(a, env).value).toBeNull();
  });
});

describe("Rechen-Bindings: Berechnung ausführen", () => {
  it("rechnet mit den gebundenen Variablen und gibt die aufgelösten Eingänge und das Ziel zurück", () => {
    const c = calc({
      calc_key: "dichte",
      formula: "m / v",
      input_bindings: [
        { variable: "m", source: "form_field", ref: "masse" },
        { variable: "v", source: "constant", value: "4" },
      ],
      output_binding: { target: "form_field", ref: "dichte_feld" },
    });
    expect(runCalculation(c, { formValues: { masse: 10 } })).toEqual({
      value: 2.5,
      error: null,
      inputs: { m: 10, v: "4" },
      output: { target: "form_field", ref: "dichte_feld", label: null },
    });
  });

  it("gebundene Variablen haben Vorrang vor gleichnamigen Formular- und Systemwerten", () => {
    const c = calc({ calc_key: "x", formula: "a * 2", input_bindings: [{ variable: "a", source: "constant", value: 5 }] });
    expect(runCalculation(c, { formValues: { a: 100 }, systemVariables: { a: 1000 } }).value).toBe(10);
  });

  it("Formularwerte haben Vorrang vor Systemvariablen, wenn die Formel sie direkt nutzt", () => {
    const c = calc({ calc_key: "x", formula: "a + 0" });
    expect(runCalculation(c, { formValues: { a: 1 }, systemVariables: { a: 2 } }).value).toBe(1);
    expect(runCalculation(c, { systemVariables: { a: 2 } }).value).toBe(2);
  });

  it("Aggregatfunktionen arbeiten auf Listen aus Mehrfachauswahlen", () => {
    const c = calc({
      calc_key: "n",
      formula: "COUNT(t) * 10 + MAX(t)",
      input_bindings: [{ variable: "t", ref: "temps" }],
    });
    expect(runCalculation(c, { formValues: { temps: "550;600;650" } }).value).toBe(680);
  });

  it("bleibt ohne Fehler leer, wenn eine gebundene Quelle fehlt", () => {
    const c = calc({ calc_key: "x", formula: "m * 2", input_bindings: [{ variable: "m", ref: "masse" }] });
    expect(runCalculation(c, { formValues: {} })).toMatchObject({ value: null, error: null });
  });

  it("gibt Formelfehler weiter, z. B. bei nicht gebundener Variable", () => {
    const c = calc({ calc_key: "x", formula: "m * faktor", input_bindings: [{ variable: "m", source: "constant", value: 1 }] });
    expect(runCalculation(c, {})).toMatchObject({ value: null, error: "Unbekanntes Feld: faktor (Position 5)" });
  });

  it("liefert ohne Ausgabebindung output = null", () => {
    expect(runCalculation(calc({ calc_key: "x", formula: "1 + 1" }), {}).output).toBeNull();
  });
});

describe("Rechen-Bindings: Ausgaben auf Formularfelder anwenden", () => {
  it("liefert nur Ergebnisse mit Ziel „Formularfeld“, unter dem Zielschlüssel", () => {
    const calcs = [
      calc({ calc_key: "a", formula: "1 + 1", output_binding: { target: "form_field", ref: "feld_a" } }),
      calc({ calc_key: "b", formula: "2 + 2", output_binding: { target: "report", ref: "bericht_b" } }),
      calc({ calc_key: "c", formula: "3 + 3", output_binding: { ref: "feld_c" } }),
      calc({ calc_key: "d", formula: "4 + 4" }),
    ];
    expect(applyCalculationOutputs(calcs, {})).toEqual({ feld_a: 2, feld_c: 6 });
  });

  it("lässt Berechnungen mit Fehler oder ohne Wert aus", () => {
    const calcs = [
      calc({ calc_key: "fehler", formula: "1 +", output_binding: { ref: "f1" } }),
      calc({ calc_key: "leer", formula: "m * 2", input_bindings: [{ variable: "m", ref: "masse" }], output_binding: { ref: "f2" } }),
      calc({ calc_key: "null", formula: "5 / 0", output_binding: { ref: "f3" } }),
    ];
    expect(applyCalculationOutputs(calcs, { formValues: {} })).toEqual({});
  });

  it("übernimmt auch das Ergebnis 0", () => {
    const calcs = [calc({ calc_key: "z", formula: "1 - 1", output_binding: { ref: "feld_z" } })];
    expect(applyCalculationOutputs(calcs, {})).toEqual({ feld_z: 0 });
  });

  it("verkettet Berechnungen der Liste untereinander, unabhängig von der Reihenfolge", () => {
    const calcs = [
      calc({
        calc_key: "doppelt",
        formula: "basis * 2",
        input_bindings: [{ variable: "basis", source: "calculation", ref: "summe" }],
        output_binding: { ref: "feld_doppelt" },
      }),
      calc({
        calc_key: "summe",
        formula: "a + b",
        input_bindings: [{ variable: "a", ref: "x" }, { variable: "b", ref: "y" }],
        output_binding: { ref: "feld_summe" },
      }),
    ];
    expect(applyCalculationOutputs(calcs, { formValues: { x: 1, y: 2 } })).toEqual({ feld_doppelt: 6, feld_summe: 3 });
  });
});
