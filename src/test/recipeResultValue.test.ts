import { describe, it, expect } from "vitest";
import { groupRecipeSections, parseRecipeValue } from "@/lib/recipeSections";
import { normalizeImageValue } from "@/lib/imageGallery";

const recipe = [
  { kind: "section", offset_minutes: 0 },
  { raw_material_id: "a", quantity: 2, unit: "kg" },
  { raw_material_id: "b", quantity: 1, unit: "kg" },
  { kind: "section", offset_minutes: 30 },
  { raw_material_id: "c", quantity: 5, unit: "g" },
];

describe("Rezeptur als Ergebniswert im Abschluss", () => {
  it("erkennt eine Rezeptur aus dem gespeicherten JSON-String", () => {
    const entries = parseRecipeValue(JSON.stringify(recipe));
    expect(entries).not.toBeNull();
    const sections = groupRecipeSections(entries!);
    expect(sections).toHaveLength(2);
    expect(sections[0].offset_minutes).toBe(0);
    expect(sections[0].rows.map((r) => r.row.raw_material_id)).toEqual(["a", "b"]);
    expect(sections[1].offset_minutes).toBe(30);
  });

  it("erkennt Altwerte ohne Abschnittswechsel als einen Abschnitt", () => {
    const entries = parseRecipeValue([{ raw_material_id: "a", quantity: 1, unit: "kg" }]);
    expect(entries).not.toBeNull();
    expect(groupRecipeSections(entries!)).toHaveLength(1);
  });

  it("liefert null für leere Rezepturen und fremde Werte", () => {
    expect(parseRecipeValue(null)).toBeNull();
    expect(parseRecipeValue("[]")).toBeNull();
    expect(parseRecipeValue("Freitext")).toBeNull();
    expect(parseRecipeValue([{ raw_material_id: "", quantity: "", unit: "" }])).toBeNull();
    expect(parseRecipeValue([{ storage_path: "x/y.jpg", file_name: "Foto" }])).toBeNull();
  });

  it("vermischt sich nicht mit der Fotodokumentation", () => {
    expect(normalizeImageValue(JSON.stringify(recipe))).toEqual([]);
    expect(parseRecipeValue(JSON.stringify([{ storage_path: "x/y.jpg" }]))).toBeNull();
  });
});
