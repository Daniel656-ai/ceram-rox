import { describe, it, expect } from "vitest";
import { linkedFieldScope } from "@/lib/fieldLinks";
import { evaluateLocalCalculations } from "@/lib/localCalculations";
import type { FormCalculation } from "@/lib/api/formCalculations";

const calc = (p: Partial<FormCalculation>): FormCalculation => ({
  id: "c", form_id: "f", calc_key: "k", display_name: "K", description: null,
  formula: "", expression: [], inputs: [], unit: null, decimals: 2,
  rounding: "round", result_type: "number", is_result: false, result_label: null,
  sort_order: 0, created_at: "", updated_at: "", ...(p as any),
});

/** Verknüpftes Feld im Zielformular, Quelle = Auftraggeber-Vorgabe T1. */
const linkTo = (key: string, srcKey: string) => ({
  id: key,
  field_key: key,
  field_type: "number",
  data_source: {
    mode: "copy",
    source: { kind: "linked_form", form_id: "vorgaben", field_key: srcKey, label: `Vorgaben → ${srcKey}` },
  },
});

const vorgaben = { t1: "300 °C", t2: 350, t3: 400, t4: 450, t5: 500, t6: 550 };

describe("Auftraggeber-Vorgaben T1–T6 in Berechnungen", () => {
  it("löst verknüpfte Werte auch ohne sichtbares Feld auf", () => {
    const fields = [linkTo("t1", "t1"), linkTo("t6", "t6")];
    const scope = linkedFieldScope(fields as any, { formData: { vorgaben } });
    expect(scope).toEqual({ t1: "300 °C", t6: 550 });
  });

  it("rechnet mit dem Vorgabewert (Einheit bleibt Metainformation)", () => {
    const scope = linkedFieldScope([linkTo("t1", "t1")] as any, { formData: { vorgaben } });
    const eta = calc({ calc_key: "eta_nox", formula: "t1 * 2", decimals: 1 });
    expect(evaluateLocalCalculations([eta], scope, ["t1"]).eta_nox.value).toBe(600);
  });

  it("folgt Änderungen der Quelle", () => {
    const fields = [linkTo("t2", "t2")] as any;
    const a = linkedFieldScope(fields, { formData: { vorgaben } });
    const b = linkedFieldScope(fields, { formData: { vorgaben: { ...vorgaben, t2: 700 } } });
    const c = calc({ calc_key: "k_wert", formula: "t2" });
    expect(evaluateLocalCalculations([c], a, ["t2"]).k_wert.value).toBe(350);
    expect(evaluateLocalCalculations([c], b, ["t2"]).k_wert.value).toBe(700);
  });

  it("liefert keinen Ersatzwert 0, wenn die Vorgabe fehlt", () => {
    const scope = linkedFieldScope([linkTo("t4", "t4")] as any, { formData: { vorgaben: { t4: "" } } });
    expect(scope.t4).toBeUndefined();
    const r = evaluateLocalCalculations([calc({ calc_key: "k", formula: "t4 * 2" })], scope, ["t4"]).k;
    expect(r.value).toBeNull();
  });

  it("lässt Felder ohne Wertquelle unberührt", () => {
    const scope = linkedFieldScope([{ id: "x", field_key: "laenge", field_type: "number" }] as any, {
      formValues: { laenge: 10 },
      formData: { vorgaben },
    });
    expect(scope).toEqual({});
  });
});
