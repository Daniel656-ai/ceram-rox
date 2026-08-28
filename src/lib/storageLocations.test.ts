import { describe, expect, it } from "vitest";
import {
  aggregateContainerLocations,
  formatLocationList,
  formatStorageLocation,
  isActiveContainer,
} from "./storageLocations";

const loc = (name: string) => ({ name, hall: "Halle 8", room: null, shelf: null, position: null });

const container = (over: Record<string, any>) => ({
  id: Math.random().toString(36).slice(2),
  status: "verfuegbar",
  current_quantity: 10,
  location_id: "loc-1",
  storage_locations: loc("Lager 3"),
  location_note: null,
  ...over,
});

describe("isActiveContainer", () => {
  it("aktives Gebinde mit Bestand ist relevant", () => {
    expect(isActiveContainer(container({}))).toBe(true);
  });

  it("leeres Gebinde mit aktivem Status bleibt relevant (Menge ist nicht führend)", () => {
    expect(isActiveContainer(container({ current_quantity: 0 }))).toBe(true);
    expect(isActiveContainer(container({ current_quantity: 0, status: "leer" }))).toBe(true);
  });

  it("entsorgtes Gebinde ist nicht relevant", () => {
    expect(isActiveContainer(container({ status: "entsorgt", current_quantity: 50 }))).toBe(false);
  });

  it("reserviert / in_verwendung / gesperrt bleiben physisch vorhanden", () => {
    for (const s of ["reserviert", "in_verwendung", "gesperrt"]) {
      expect(isActiveContainer(container({ status: s }))).toBe(true);
    }
  });

  it("null/undefined ist nicht relevant", () => {
    expect(isActiveContainer(null)).toBe(false);
    expect(isActiveContainer(undefined)).toBe(false);
  });
});

describe("aggregateContainerLocations", () => {
  it("Test 1: zwei Gebinde am selben Lagerort → nur einmal angezeigt", () => {
    const result = aggregateContainerLocations([container({}), container({})]);
    expect(result).toEqual(["Lager 3 / Halle 8"]);
  });

  it("Test 2: zwei unterschiedliche Lagerorte → beide, Reihenfolge stabil", () => {
    const result = aggregateContainerLocations([
      container({}),
      container({ location_id: "loc-2", storage_locations: loc("Lager 5") }),
    ]);
    expect(result).toEqual(["Lager 3 / Halle 8", "Lager 5 / Halle 8"]);
  });

  it("Test 3: leeres aktives Gebinde (0 kg) + volles Gebinde → beide Lagerorte", () => {
    const result = aggregateContainerLocations([
      container({ current_quantity: 0 }),
      container({ location_id: "loc-2", storage_locations: loc("Lager 5"), current_quantity: 20 }),
    ]);
    expect(result).toEqual(["Lager 3 / Halle 8", "Lager 5 / Halle 8"]);
  });

  it("Test 4: entsorgtes Gebinde wird ignoriert", () => {
    const result = aggregateContainerLocations([
      container({ current_quantity: 0, status: "entsorgt" }),
      container({ location_id: "loc-2", storage_locations: loc("Lager 5"), current_quantity: 20 }),
    ]);
    expect(result).toEqual(["Lager 5 / Halle 8"]);
  });

  it("Test 5: alle Gebinde leer, aber aktiv → Lagerorte bleiben sichtbar", () => {
    const result = aggregateContainerLocations([
      container({ current_quantity: 0 }),
      container({ location_id: "loc-2", storage_locations: loc("Lager 5"), current_quantity: 0 }),
    ]);
    expect(result).toEqual(["Lager 3 / Halle 8", "Lager 5 / Halle 8"]);
  });

  it("Test 6: Gebinde ohne Lagerort verursacht keinen Fehler und kein 'undefined'", () => {
    const result = aggregateContainerLocations([
      container({ storage_locations: null, location_note: null }),
      container({ storage_locations: null, location_id: null, location_note: null }),
    ]);
    expect(result).toEqual([]);
    // Fallback: location_note wird verwendet, wenn kein Stammdaten-Lagerort
    const withNote = aggregateContainerLocations([
      container({ storage_locations: null, location_note: "Freilager" }),
    ]);
    expect(withNote).toEqual(["Freilager"]);
  });

  it("Zusoplast-Beispiel: 0-kg-Gebinde + 40-kg-Gebinde → beide Lagerorte", () => {
    const result = aggregateContainerLocations([
      container({ current_quantity: 0, storage_locations: { name: "Chemikalienschrank rot", hall: "Halle 8", room: "Technikum", shelf: "Chemikalienschrank rot", position: null } }),
      container({ current_quantity: 40.468, storage_locations: { name: "Lager 3", hall: "Halle 8", room: "Lager 3", shelf: null, position: null } }),
    ]);
    expect(formatLocationList(result)).toBe(
      "Chemikalienschrank rot / Halle 8 › Technikum › Chemikalienschrank rot · Lager 3 / Halle 8 › Lager 3",
    );
  });
});

describe("formatStorageLocation", () => {
  it("fehlender Lagerort → Gedankenstrich", () => {
    expect(formatStorageLocation(null)).toBe("–");
  });
});
