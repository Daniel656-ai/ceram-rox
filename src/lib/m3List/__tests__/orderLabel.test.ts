import { describe, it, expect } from "vitest";
import { m3OrderLabel, m3OrderSortText, articlePrefix } from "../orderLabel";
import { deriveM3Values } from "../derive";

const projects = new Map<string, string>([["p1", "Miratech SCR"], ["p2", "Alpha"]]);

describe("m3OrderLabel", () => {
  it("extrahiert exakt die ersten 9 Zeichen der Artikelnummer", () => {
    expect(articlePrefix("0040-6129-125-0998")).toBe("0040-6129");
    expect(articlePrefix("  0040-6129-125-0998 ")).toBe("0040-6129");
    expect(articlePrefix(null)).toBeNull();
  });
  it("zeigt Artikelnummer-Präfix + Projektname, ohne Rest der Artikelnummer", () => {
    const r = m3OrderLabel({ article_number: "0040-6129-125-0998", project_id: "p1" }, projects);
    expect(r).toEqual({ label: "0040-6129 Miratech SCR", complete: true, problem: null });
    expect(r.label).not.toContain("-125-0998");
  });
  it("fehlende Artikelnummer → unvollständig, kein Ersatz", () => {
    const r = m3OrderLabel({ article_number: null, project_id: "p1" }, projects);
    expect(r.complete).toBe(false);
    expect(r.label).toBe("Miratech SCR");
    expect(r.problem).toMatch(/Artikelnummer fehlt/);
  });
  it("fehlende project_id → unvollständig, kein Ersatz", () => {
    const r = m3OrderLabel({ article_number: "0020-6047-001-0001", project_id: null }, projects);
    expect(r.complete).toBe(false);
    expect(r.label).toBe("0020-6047");
    expect(r.problem).toMatch(/Projektzuordnung fehlt/);
  });
  it("nicht auffindbares Projekt → unvollständig", () => {
    const r = m3OrderLabel({ article_number: "0020-6047-001-0001", project_id: "x" }, projects);
    expect(r.complete).toBe(false);
    expect(r.problem).toMatch(/nicht gefunden/);
  });
  it("Suche/Sortierung nutzt sichtbare Bezeichnung", () => {
    const a = m3OrderLabel({ article_number: "0040-6129-125-0998", project_id: "p1" }, projects);
    const b = m3OrderLabel({ article_number: "0010-1000-000-0000", project_id: "p2" }, projects);
    expect([a, b].map(m3OrderSortText).sort()).toEqual(["0010-1000 Alpha", "0040-6129 Miratech SCR"]);
    expect(m3OrderSortText(a).includes("SW-")).toBe(false);
  });
  it("interne Auftragsnummer in deriveM3Values bleibt unverändert", () => {
    const d = deriveM3Values({ release: { order_number: "X" } as any, orderNumber: "SW-260003", stored: {}, constants: {} } as any);
    expect(d.values.order_number).toBe("SW-260003");
  });
});
