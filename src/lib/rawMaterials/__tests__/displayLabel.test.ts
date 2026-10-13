import { describe, it, expect } from "vitest";
import { resolveRawMaterialDisplay } from "../displayLabel";

const ID = "11111111-2222-3333-4444-555555555555";
const map = new Map([[ID, { id: ID, material_number: "RM-1", material_name: "Alox" }]]);

describe("resolveRawMaterialDisplay", () => {
  it("löst ID zu Code – Name auf", () => {
    expect(resolveRawMaterialDisplay({ id: ID }, map)).toEqual({ label: "RM-1 – Alox", unresolved: false });
  });
  it("behandelt reinen ID-String im Namen als ID", () => {
    expect(resolveRawMaterialDisplay({ name: ID }, map)?.label).toBe("RM-1 – Alox");
  });
  it("Rohstoff ohne Code zeigt nur Namen", () => {
    const m = new Map([[ID, { id: ID, material_number: null, material_name: "Alox" }]]);
    expect(resolveRawMaterialDisplay({ id: ID }, m)?.label).toBe("Alox");
  });
  it("nicht auflösbar: Snapshot oder Kennzeichnung, kein Absturz", () => {
    expect(resolveRawMaterialDisplay({ id: ID, name: "Alt", code: "X" }, new Map())).toEqual({ label: "X – Alt", unresolved: true });
    expect(resolveRawMaterialDisplay({ id: ID }, new Map())?.unresolved).toBe(true);
    expect(resolveRawMaterialDisplay({ id: ID }, new Map())?.label).not.toBe(ID);
  });
  it("Freitext bleibt Freitext", () => {
    expect(resolveRawMaterialDisplay({ name: "Ton extern" }, map)?.label).toBe("Ton extern");
    expect(resolveRawMaterialDisplay({}, map)).toBeNull();
  });
});
