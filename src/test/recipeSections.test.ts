import { describe, it, expect } from "vitest";
import {
  appendRowToSection,
  appendSection,
  groupRecipeSections,
  hasSections,
  isSectionEntry,
  parseRecipeValue,
  removeSectionMarker,
  sectionTitle,
  stripRecipeLotAssignments,
  updateSectionMarker,
  type RecipeEntry,
} from "@/lib/recipeSections";

const row = (id: string): RecipeEntry => ({ raw_material_id: id, quantity: 1, unit: "kg" });

describe("recipeSections", () => {
  it("liest Altwerte ohne Abschnitte als einen Abschnitt", () => {
    const value = [row("a"), row("b")];
    const sections = groupRecipeSections(value);
    expect(hasSections(value)).toBe(false);
    expect(sections).toHaveLength(1);
    expect(sections[0].rows.map((r) => r.row.raw_material_id)).toEqual(["a", "b"]);
  });

  it("gruppiert Abschnitte und erhält die Reihenfolge", () => {
    const value: RecipeEntry[] = [
      { kind: "section", offset_minutes: 0 },
      row("a"),
      row("b"),
      { kind: "section", offset_minutes: 30 },
      row("c"),
    ];
    const sections = groupRecipeSections(value);
    expect(sections).toHaveLength(2);
    expect(sections[0].offset_minutes).toBe(0);
    expect(sections[0].rows.map((r) => r.row.raw_material_id)).toEqual(["a", "b"]);
    expect(sections[1].offset_minutes).toBe(30);
    expect(sections[1].rows.map((r) => r.row.raw_material_id)).toEqual(["c"]);
    expect(sectionTitle(sections[1], 1)).toBe("Teilprozessschritt 2");
  });

  it("fügt Rohstoffe am Ende des jeweiligen Abschnitts ein", () => {
    let value: RecipeEntry[] = [row("a"), { kind: "section", offset_minutes: 30 }, row("c")];
    value = appendRowToSection(value, 0);
    const sections = groupRecipeSections(value);
    expect(sections[0].rows).toHaveLength(2);
    expect(sections[0].rows[1].row.raw_material_id).toBe("");
    expect(sections[1].rows.map((r) => r.row.raw_material_id)).toEqual(["c"]);
  });

  it("hängt einen Abschnittswechsel an und aktualisiert dessen Zugabezeit", () => {
    let value = appendSection([row("a")], 15);
    expect(hasSections(value)).toBe(true);
    expect(isSectionEntry(value[1])).toBe(true);
    value = updateSectionMarker(value, 1, { offset_minutes: 45, label: "Zugabe Binder" });
    const sections = groupRecipeSections(value);
    expect(sections[1].offset_minutes).toBe(45);
    expect(sectionTitle(sections[1], 1)).toBe("Zugabe Binder");
  });

  it("behält Rohstoffe beim Entfernen eines Abschnittswechsels", () => {
    const value: RecipeEntry[] = [row("a"), { kind: "section", offset_minutes: 30 }, row("c")];
    const next = removeSectionMarker(value, 1);
    expect(hasSections(next)).toBe(false);
    expect(groupRecipeSections(next)[0].rows.map((r) => r.row.raw_material_id)).toEqual(["a", "c"]);
  });

  it("stripRecipeLotAssignments entfernt nur Gebinde-/Lot-Felder", () => {
    const value: RecipeEntry[] = [
      { raw_material_id: "a", quantity: 500, unit: "g", note: "n", container_id: "c-1", lot_number: "L1" },
      { kind: "section", offset_minutes: 10 },
      { raw_material_id: "b", quantity: 2, unit: "kg" },
    ];
    const next = stripRecipeLotAssignments(value);
    expect(next[0]).toEqual({ raw_material_id: "a", quantity: 500, unit: "g", note: "n" });
    expect(next[1]).toEqual({ kind: "section", offset_minutes: 10 });
    expect(next[2]).toEqual({ raw_material_id: "b", quantity: 2, unit: "kg" });
    // Quelle bleibt unverändert.
    expect((value[0] as any).container_id).toBe("c-1");
  });

  it("parseRecipeValue akzeptiert Zeilen mit Lot-Feldern und historische ohne", () => {
    const withLot = JSON.stringify([
      { raw_material_id: "a", quantity: 500, unit: "g", container_id: "c-1", lot_number: "L1" },
    ]);
    const withoutLot = JSON.stringify([{ raw_material_id: "b", quantity: 2, unit: "kg" }]);
    expect(parseRecipeValue(withLot)).toHaveLength(1);
    expect(parseRecipeValue(withoutLot)).toHaveLength(1);
  });

  it("gruppiert Zeilen mit Lot-Feldern unverändert in Abschnitte", () => {
    const value: RecipeEntry[] = [
      { raw_material_id: "a", quantity: 500, unit: "g", container_id: "c-1", lot_number: "L1" },
    ];
    const sections = groupRecipeSections(value);
    expect(sections[0].rows[0].row.lot_number).toBe("L1");
    expect(sections[0].rows[0].row.container_id).toBe("c-1");
  });
});
