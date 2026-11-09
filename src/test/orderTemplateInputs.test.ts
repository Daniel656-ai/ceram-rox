import { describe, it, expect } from "vitest";
import { copyTemplateInputs } from "@/lib/orderTemplateInputs";

const recipeField = {
  field_key: "rezeptur",
  field_type: "raw_material_recipe",
  display_name: "Rezeptur / Rohstoffliste",
  is_result: false,
} as any;

describe("copyTemplateInputs – raw_material_recipe", () => {
  it("setzt container_id und lot_number bei Vorlagenkopien zurück", () => {
    const values = {
      rezeptur: JSON.stringify([
        { raw_material_id: "mat-1", quantity: 500, unit: "g", note: "zuerst", container_id: "c-1", lot_number: "L-2026-01" },
        { kind: "section", offset_minutes: 30 },
        { raw_material_id: "mat-2", quantity: 2.5, unit: "kg", container_id: "c-2", lot_number: "L-2026-02" },
      ]),
    };
    const out = copyTemplateInputs(values, [recipeField]);
    const rows = out.rezeptur as any[];
    expect(rows).toHaveLength(3);
    // Rohstoff, Menge, Einheit, Bemerkung und Abschnitte bleiben erhalten.
    expect(rows[0]).toEqual({ raw_material_id: "mat-1", quantity: 500, unit: "g", note: "zuerst" });
    expect(rows[1]).toEqual({ kind: "section", offset_minutes: 30 });
    expect(rows[2]).toEqual({ raw_material_id: "mat-2", quantity: 2.5, unit: "kg" });
    // Keine Gebinde-/Lot-Schlüssel in der Kopie.
    for (const r of rows) {
      expect(r).not.toHaveProperty("container_id");
      expect(r).not.toHaveProperty("lot_number");
    }
  });

  it("lässt historische Rezepturen ohne Lot-Felder unverändert", () => {
    const values = {
      rezeptur: JSON.stringify([{ raw_material_id: "mat-1", quantity: 2.5, unit: "kg" }]),
    };
    const out = copyTemplateInputs(values, [recipeField]);
    expect(out.rezeptur).toEqual([{ raw_material_id: "mat-1", quantity: 2.5, unit: "kg" }]);
  });

  it("verändert den gespeicherten Quellwert nicht", () => {
    const original = [{ raw_material_id: "mat-1", quantity: 1, unit: "kg", container_id: "c-1", lot_number: "L1" }];
    const values = { rezeptur: JSON.stringify(original) };
    copyTemplateInputs(values, [recipeField]);
    expect(original[0].container_id).toBe("c-1");
    expect(original[0].lot_number).toBe("L1");
  });
});
