import { describe, it, expect } from "vitest";
import {
  evaluateEntryCalculations,
  mergeEntryScope,
  seriesCalculations,
} from "@/lib/localCalculations";
import type { FormCalculation } from "@/lib/api/formCalculations";

const calc = (over: Partial<FormCalculation>): FormCalculation =>
  ({
    id: over.calc_key ?? "c",
    form_id: "f",
    calc_key: "k",
    display_name: "K-Wert",
    description: null,
    formula: "",
    expression: [],
    inputs: [],
    unit: null,
    decimals: 2,
    rounding: "round",
    result_type: "number",
    is_result: false,
    result_label: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...over,
  }) as FormCalculation;

const kWert = calc({ calc_key: "k_wert", formula: "temperatur * av / o2", decimals: 3 });
const childKeys = ["temperatur", "av", "o2"];

describe("Messreihe – Berechnungen je Messpunkt", () => {
  it("erkennt Berechnungen der Messreihe (und Folgeberechnungen)", () => {
    const folge = calc({ calc_key: "k_norm", formula: "k_wert * 2" });
    const global = calc({ calc_key: "dauer", formula: "ende - start" });
    const keys = seriesCalculations([kWert, folge, global], childKeys).map((c) => c.calc_key);
    expect(keys).toEqual(["k_wert", "k_norm"]);
  });

  it("verwendet ausschließlich Werte des aktuellen Messpunktes", () => {
    const entries = [
      { temperatur: 600, av: 0.8, o2: 5 },
      { temperatur: 700, av: 0.8, o2: 5 },
      { temperatur: 800, av: 0.9, o2: 6 },
    ];
    const values = entries.map(
      (e) => evaluateEntryCalculations([kWert], {}, e, childKeys).k_wert.value
    );
    expect(values).toEqual([96, 112, 120]);
  });

  it("liefert kein Ergebnis (nicht 0), wenn ein Wert fehlt", () => {
    const r = evaluateEntryCalculations([kWert], {}, { temperatur: 600, av: 0.8 }, childKeys);
    expect(r.k_wert.value).toBeNull();
  });

  it("rechnet nach Änderung eines Wertes neu", () => {
    const before = evaluateEntryCalculations([kWert], {}, { temperatur: 600, av: 0.8, o2: 5 }, childKeys);
    const after = evaluateEntryCalculations([kWert], {}, { temperatur: 900, av: 0.8, o2: 5 }, childKeys);
    expect(before.k_wert.value).not.toEqual(after.k_wert.value);
    expect(after.k_wert.value).toBe(144);
  });

  it("nutzt verknüpfte Werte des Messpunktes vor Formularwerten", () => {
    // Verknüpftes Feld spiegelt seinen Wert in den eigenen Feldschlüssel im
    // Eintrags-Scope – dieser überlagert den Formularwert.
    const scope = mergeEntryScope({ temperatur: 100, av: 0.8, o2: 5 }, { temperatur: 700, __instance_id: "x" });
    expect(scope.temperatur).toBe(700);
    expect(scope.__instance_id).toBeUndefined();
    const r = evaluateEntryCalculations([kWert], { temperatur: 100, av: 0.8, o2: 5 }, { temperatur: 700 }, childKeys);
    expect(r.k_wert.value).toBe(112);
  });
});
