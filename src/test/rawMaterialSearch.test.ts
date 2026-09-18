import { describe, expect, it } from "vitest";
import {
  matchesRawMaterialSearch,
  rawMaterialSearchHaystack,
  matchingBatches,
} from "@/lib/rawMaterialSearch";

const material = {
  material_name: "TiW",
  material_number: "1821",
  supplier: "Muster GmbH",
  raw_material_batches: [
    { batch_number: "LOT-2026-001", mrs_number: "123456" },
    { batch_number: "LOT-2026-002", mrs_number: null },
  ],
};

describe("Zentrale Rohstoffsuche (Rohstoff → LOT → MRS)", () => {
  it("findet über den Rohstoffnamen", () => {
    expect(matchesRawMaterialSearch(material, "tiw")).toBe(true);
  });

  it("findet über die LOT-Nummer", () => {
    expect(matchesRawMaterialSearch(material, "LOT-2026-001")).toBe(true);
  });

  it("findet über die vollständige MRS-Nummer des LOTs", () => {
    expect(matchesRawMaterialSearch(material, "123456")).toBe(true);
  });

  it("findet über einen Teil der MRS-Nummer", () => {
    expect(matchesRawMaterialSearch(material, "3456")).toBe(true);
  });

  it("findet nicht bei unbekanntem Begriff", () => {
    expect(matchesRawMaterialSearch(material, "999999")).toBe(false);
  });

  it("liefert den passenden LOT zur MRS-Nummer", () => {
    expect(matchingBatches(material, "123456").map((b) => b.batch_number)).toEqual([
      "LOT-2026-001",
    ]);
  });

  it("funktioniert auch ohne geladene LOTs (Altbestand mit MRS am Rohstoff)", () => {
    const legacy = { material_name: "Alt", mrs_number: "777" };
    expect(matchesRawMaterialSearch(legacy, "777")).toBe(true);
    expect(rawMaterialSearchHaystack(legacy)).toContain("777");
  });

  it("leere Suche liefert alle Treffer", () => {
    expect(matchesRawMaterialSearch(material, "")).toBe(true);
  });
});
