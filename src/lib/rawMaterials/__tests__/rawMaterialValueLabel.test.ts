import { describe, it, expect } from "vitest";
import { rawMaterialValueLabel } from "../displayLabel";

const ID = "902256b5-d2c1-49d7-87c8-b22f21c8be04";
const ID2 = "11111111-2222-3333-4444-555555555555";
const byId = new Map([
  [ID, { id: ID, material_number: "RK-1821", material_name: "Titandioxid" }],
  [ID2, { id: ID2, material_number: null, material_name: "Wasser" }],
]);

describe("rawMaterialValueLabel", () => {
  it("bekannte ID → RK-Code – Name", () => {
    expect(rawMaterialValueLabel("raw_material_id", ID, byId)).toEqual({ label: "RK-1821 – Titandioxid", unresolved: false });
  });
  it("ohne RK-Code → nur Name", () => {
    expect(rawMaterialValueLabel("raw_material_id", ID2, byId)?.label).toBe("Wasser");
  });
  it("nicht auflösbare ID → Hinweis, keine ID als Name", () => {
    const r = rawMaterialValueLabel("raw_material_id", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", new Map());
    expect(r?.unresolved).toBe(true);
    expect(r?.label).toMatch(/nicht im Stamm/);
  });
  it("Objekt der Rohstoffauswahl wird aufgelöst", () => {
    expect(rawMaterialValueLabel("rohstoff", { mode: "db", raw_material_id: ID, material_name: "alt" }, byId)?.label)
      .toBe("RK-1821 – Titandioxid");
  });
  it("andere Spalten bleiben unberührt; Eingabewert wird nicht verändert", () => {
    const v = { quantity: "5" };
    expect(rawMaterialValueLabel("quantity", "5", byId)).toBeNull();
    expect(rawMaterialValueLabel("x", v, byId)).toBeNull();
    expect(v).toEqual({ quantity: "5" });
  });
});
