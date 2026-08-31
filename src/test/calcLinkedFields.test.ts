import { describe, it, expect } from "vitest";
import { readValueSource, isPreviousServiceLink, resolveLinkedValue, linkOriginLabel, isLinkedField } from "@/lib/fieldLinks";
import { isCalcInputFieldDef, evaluateLocalCalculations } from "@/lib/localCalculations";
import type { FormCalculation } from "@/lib/api/formCalculations";

const calc = (p: Partial<FormCalculation>): FormCalculation => ({
  id: "c", form_id: "f", calc_key: "k", display_name: "K", description: null,
  formula: "", expression: [], inputs: [], unit: null, decimals: 2,
  rounding: "round", result_type: "number", is_result: false, result_label: null,
  sort_order: 0, created_at: "", updated_at: "", ...(p as any),
});

const linkedField = {
  id: "1", field_key: "temperatur", field_type: "text", unit: "°C",
  data_source: { mode: "calc", source: { kind: "workflow_step", step_key: "s1", field_key: "temp", label: "Vorheizen → Temperatur" } },
};

describe("Verknüpfte Felder als Berechnungseingang", () => {
  it("erkennt die Verknüpfung einer vorangegangenen Dienstleistung", () => {
    const vs = readValueSource(linkedField as any);
    expect(isPreviousServiceLink(vs)).toBe(true);
    expect(linkOriginLabel(vs)).toBe("Vorheizen → Temperatur");
    expect(isLinkedField(linkedField as any)).toBe(true);
  });

  it("macht verknüpfte Felder unabhängig vom Feldtyp rechenbar", () => {
    expect(isCalcInputFieldDef(linkedField as any)).toBe(true);
    expect(isCalcInputFieldDef({ field_type: "text" } as any)).toBe(false);
    expect(isCalcInputFieldDef({ field_type: "number" } as any)).toBe(true);
  });

  it("löst den aktuellen Wert auf – ohne Ersatzwert 0", () => {
    const vs = readValueSource(linkedField as any);
    expect(resolveLinkedValue(vs, { stepData: { s1: { temp: "300 °C" } } })).toBe("300 °C");
    expect(resolveLinkedValue(vs, { stepData: {} })).toBeNull();
  });

  it("rechnet mit dem verknüpften Wert und folgt Änderungen", () => {
    const k = calc({ calc_key: "k_wert", formula: "temperatur * 2", decimals: 1 });
    expect(evaluateLocalCalculations([k], { temperatur: "300 °C" }, ["temperatur"]).k_wert.value).toBe(600);
    expect(evaluateLocalCalculations([k], { temperatur: "310" }, ["temperatur"]).k_wert.value).toBe(620);
  });

  it("bleibt ohne Quellwert leer statt 0", () => {
    const k = calc({ calc_key: "k_wert", formula: "temperatur * 2" });
    const r = evaluateLocalCalculations([k], {}, ["temperatur"]).k_wert;
    expect(r.value).toBeNull();
    expect(r.error).toBeNull();
  });
});
