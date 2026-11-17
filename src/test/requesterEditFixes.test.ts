import { describe, it, expect } from "vitest";
import { adoptLoadedSelection, applyPilotPlantColumnFallback, type LoadedPosition } from "@/lib/orders/requesterEdit";
import { copyTemplateInputs, templateInputAllowed } from "@/lib/orderTemplateInputs";

const services = [{ id: "s-knet", service_name: "Knetung" }, { id: "s-ext", service_name: "Extrusion" }];

describe("Bearbeiten: geladene Positionen wiedererkennen", () => {
  it("markiert vorhandene Positionen als Formularpositionen mit stabiler uid", () => {
    const out = adoptLoadedSelection<LoadedPosition>(
      [{ uid: "u1", service_id: "s-knet", service_name: "Knetung", origin: "manual" }, { uid: "u2", service_id: "s-ext", service_name: "Extrusion", origin: "manual" }],
      [{ token: "knetung" }, { token: "x", service_id: "s-ext" }], services);
    expect(out.map((m) => [m.uid, m.origin, m.selection_token])).toEqual([["u1", "template", "knetung"], ["u2", "template", "x"]]);
  });
  it("ordnet jede Auswahl nur einer Position zu; Zusatzpositionen bleiben manuell", () => {
    const out = adoptLoadedSelection(
      [{ uid: "a", service_id: "s-knet", service_name: "Knetung", origin: "manual" }, { uid: "b", service_id: "s-knet", service_name: "Knetung", origin: "manual" }],
      [{ token: "Knetung" }], services);
    expect(out.map((m) => m.origin)).toEqual(["template", "manual"]);
  });
});

describe("Bearbeiten: PP-Stammdaten aus Auftragsspalten", () => {
  const fields = [
    { field_key: "versuchsnummer", binding_path: "order.versuchsnummer", field_type: "text" },
    { field_key: "massetyp", field_type: "select" },
    { field_key: "v2o5", field_type: "decimal" },
  ];
  it("ergänzt nur fehlende Werte", () => {
    const { values, filled } = applyPilotPlantColumnFallback({ massetyp: "GK" }, fields,
      { pp_experiment_number: "TE-26-001", pp_masse_type: "KK", pp_v2o5_percent: "2.5" });
    expect(values).toEqual({ versuchsnummer: "TE-26-001", massetyp: "GK", v2o5: 2.5 });
    expect(filled).toEqual(["versuchsnummer", "v2o5"]);
  });
  it("lässt mehrdeutige Felder leer", () => {
    const { values } = applyPilotPlantColumnFallback({}, [{ field_key: "massetyp" }, { field_key: "pp_masse_type" }], { pp_masse_type: "KK" });
    expect(values).toEqual({});
  });
});

describe("Ausschlussfilter: Kopie vs. Bearbeitung", () => {
  const vn = { field_key: "versuchsnummer", field_type: "text" };
  it("Vorlagenkopie verwirft Versuchsnummer weiterhin", () => {
    expect(templateInputAllowed(vn)).toBe(false);
    expect(copyTemplateInputs({ versuchsnummer: "TE1" }, [vn])).toEqual({});
  });
  it("Bearbeitung behält Versuchsnummer und Chargenzuordnung", () => {
    expect(copyTemplateInputs({ versuchsnummer: "TE1" }, [vn], [vn], { preserveIdentity: true })).toEqual({ versuchsnummer: "TE1" });
    const recipe = { field_key: "rezept", field_type: "raw_material_recipe" };
    const rows = [{ raw_material_id: "r", container_id: "c1", lot_number: "L1" }];
    const kept = copyTemplateInputs({ rezept: rows }, [recipe], [recipe], { preserveIdentity: true }) as any;
    expect(kept.rezept[0].container_id).toBe("c1");
    const copied = copyTemplateInputs({ rezept: rows }, [recipe]) as any;
    expect(copied.rezept[0].container_id).not.toBe("c1");
  });
});
