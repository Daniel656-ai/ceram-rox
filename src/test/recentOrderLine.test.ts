import { describe, expect, it } from "vitest";
import { recentOrderDate, recentOrderProject } from "@/lib/orders/recentOrderLine";

describe("Dashboard: Projekt und Datum der letzten Aufträge", () => {
  it("zeigt Projektnummer und -name, wenn ein Projekt vorhanden ist", () => {
    expect(recentOrderProject({ projects: { project_number: "P-1", project_name: "Test" } })).toBe("P-1 – Test");
  });
  it("zeigt nur die Projektnummer, wenn der Name fehlt", () => {
    expect(recentOrderProject({ projects: { project_number: "P-1", project_name: null } })).toBe("P-1");
  });
  it("liefert leeren Text statt Strich, wenn der Auftrag kein Projekt hat", () => {
    expect(recentOrderProject({ projects: null })).toBe("");
    expect(recentOrderProject({})).toBe("");
  });
  it("formatiert das Datum zweistellig als TT.MM.JJJJ", () => {
    expect(recentOrderDate({ created_at: "2026-11-05T10:00:00Z" })).toBe("05.11.2026");
  });
  it("liefert leeren Text, wenn kein Datum vorhanden ist", () => {
    expect(recentOrderDate({})).toBe("");
  });
});
