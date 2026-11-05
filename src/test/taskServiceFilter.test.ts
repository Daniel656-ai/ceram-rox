import { describe, it, expect, beforeEach } from "vitest";
import { parseTaskFilterState, loadTaskFilterState, saveTaskFilterState, effectiveServiceIds, buildTaskServicePredicate, isTaskFilterActive, taskFilterStorageKey } from "@/lib/tasks/taskServiceFilter";

const ready = (ids: string[], isMaster = false) => ({ status: "ready" as const, isMaster, serviceIds: ids });
const tasks = ["bet", "rfa", "akt", "xrd"];
const run = (p: (s: string) => boolean) => tasks.filter(p);

describe("Meine Aufgaben – Dienstleistungs-/Kompetenzfilter", () => {
  beforeEach(() => localStorage.clear());
  it("ohne Filter alle Aufgaben", () => expect(run(buildTaskServicePredicate([], false, ready([])))).toEqual(tasks));
  it("einzelne Dienstleistung", () => expect(run(buildTaskServicePredicate(["rfa"], false, ready([])))).toEqual(["rfa"]));
  it("Mehrfachauswahl ODER", () => expect(run(buildTaskServicePredicate(["bet", "rfa", "akt"], false, ready([])))).toEqual(["bet", "rfa", "akt"]));
  it("Kompetenzfilter allein", () => expect(run(buildTaskServicePredicate([], true, ready(["rfa", "xrd"])))).toEqual(["rfa", "xrd"]));
  it("Kombination Dienstleistung UND Kompetenz", () => expect(run(buildTaskServicePredicate(["bet", "rfa", "akt"], true, ready(["rfa", "xrd"])))).toEqual(["rfa"]));
  it("ohne Kompetenzfilter bleiben nicht qualifizierte sichtbar", () => expect(run(buildTaskServicePredicate([], false, { status: "error" }))).toEqual(tasks));
  it("Fehler/Laden der Kompetenzabfrage → nichts als qualifiziert", () => {
    expect(run(buildTaskServicePredicate([], true, { status: "error" }))).toEqual([]);
    expect(run(buildTaskServicePredicate([], true, { status: "loading" }))).toEqual([]);
  });
  it("Master gilt als für alle qualifiziert", () => expect(run(buildTaskServicePredicate([], true, ready([], true)))).toEqual(tasks));
  it("ungültige gespeicherte IDs werden entfernt bzw. verworfen", () => {
    expect(effectiveServiceIds(["rfa", "geloescht"], ["rfa", "bet"])).toEqual(["rfa"]);
    expect(parseTaskFilterState("kaputt{")).toEqual({ serviceIds: [], onlyCompetent: false });
    expect(parseTaskFilterState('{"serviceIds":[1,"a","a"],"onlyCompetent":"ja"}')).toEqual({ serviceIds: ["a"], onlyCompetent: false });
  });
  it("Zurücksetzen-Zustand ist inaktiv", () => {
    expect(isTaskFilterActive({ serviceIds: [], onlyCompetent: false }, [])).toBe(false);
    expect(isTaskFilterActive({ serviceIds: [], onlyCompetent: true }, [])).toBe(true);
  });
  it("Benutzer haben getrennte gespeicherte Filter", () => {
    saveTaskFilterState("u1", { serviceIds: ["rfa"], onlyCompetent: true });
    saveTaskFilterState("u2", { serviceIds: ["bet"], onlyCompetent: false });
    expect(localStorage.getItem(taskFilterStorageKey("u1"))).toContain("rfa");
    expect(loadTaskFilterState("u1")).toEqual({ serviceIds: ["rfa"], onlyCompetent: true });
    expect(loadTaskFilterState("u2")).toEqual({ serviceIds: ["bet"], onlyCompetent: false });
  });
});
