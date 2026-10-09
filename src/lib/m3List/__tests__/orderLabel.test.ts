import { describe, it, expect } from "vitest";
import { m3OrderLabel, m3OrderSortText } from "../orderLabel";
import { deriveM3Values } from "../derive";

const projects = new Map<string, string>([["p1", "Miratech SCR"], ["p2", "Alpha"]]);

describe("m3OrderLabel", () => {
  it("zeigt release_number + Projektname", () => {
    expect(m3OrderLabel({ release_number: "0040-6129", project_id: "p1" }, projects))
      .toEqual({ label: "0040-6129 Miratech SCR", complete: true, problem: null });
  });
  it("fehlende project_id → unvollständig, kein Ersatz", () => {
    const r = m3OrderLabel({ release_number: "0020-6047", project_id: null }, projects);
    expect(r.complete).toBe(false);
    expect(r.label).toBe("0020-6047");
    expect(r.problem).toMatch(/Projektzuordnung fehlt/);
  });
  it("nicht auffindbares Projekt → unvollständig", () => {
    const r = m3OrderLabel({ release_number: "0020-6047", project_id: "x" }, projects);
    expect(r.complete).toBe(false);
    expect(r.problem).toMatch(/nicht gefunden/);
  });
  it("Suche/Sortierung nutzt sichtbare Bezeichnung", () => {
    const a = m3OrderLabel({ release_number: "0040-6129", project_id: "p1" }, projects);
    const b = m3OrderLabel({ release_number: "0010-1000", project_id: "p2" }, projects);
    expect(m3OrderSortText(a)).toBe(a.label);
    expect([a, b].map(m3OrderSortText).sort()).toEqual(["0010-1000 Alpha", "0040-6129 Miratech SCR"]);
    expect(m3OrderSortText(a).toLowerCase().includes("miratech")).toBe(true);
    expect(m3OrderSortText(a).includes("SW-")).toBe(false);
  });
  it("interne Auftragsnummer in deriveM3Values bleibt unverändert", () => {
    const d = deriveM3Values({ release: { order_number: "X" } as any, orderNumber: "SW-260003", stored: {}, constants: {} } as any);
    expect(d.values.order_number).toBe("SW-260003");
  });
});
