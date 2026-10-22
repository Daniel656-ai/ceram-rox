import { describe, it, expect, vi } from "vitest";
import { leaveTask, needsBackDialog, backTarget } from "./taskBack";

const ME = "me";
const states = [
  { id: "a", status: "in_progress", assigned_to: ME },
  { id: "b", status: "open", assigned_to: ME },
  { id: "c", status: "completed", assigned_to: ME },
  { id: "d", status: "open", assigned_to: "other" },
];
const base = (over: any = {}) => ({
  measurementId: "a", runIds: [] as string[], userId: ME,
  save: vi.fn().mockResolvedValue(undefined),
  loadState: vi.fn(async (ids: string[]) => states.filter((s) => ids.includes(s.id))),
  release: vi.fn().mockResolvedValue(true),
  ...over,
});

describe("Zurückpfeil Dienstleistungsbearbeitung", () => {
  it("Behalten: speichert, keine Freigabe", async () => {
    const o = base();
    await leaveTask({ ...o, choice: "keep" });
    expect(o.save).toHaveBeenCalledTimes(1);
    expect(o.release).not.toHaveBeenCalled();
  });
  it("Einzeln freigeben: erst speichern, nur diese Aufgabe", async () => {
    const order: string[] = [];
    const o = base({
      save: vi.fn(async () => { order.push("save"); }),
      release: vi.fn(async (id: string) => { order.push("rel:" + id); return true; }),
    });
    const r = await leaveTask({ ...o, choice: "release" });
    expect(order).toEqual(["save", "rel:a"]);
    expect(r.released).toEqual(["a"]);
  });
  it("Durchlauf freigeben: nur eigene offene des Durchlaufs", async () => {
    const o = base({ runIds: ["a", "c", "d"] });
    const r = await leaveTask({ ...o, choice: "release" });
    expect(r.released).toEqual(["a"]);
    expect(o.release).toHaveBeenCalledTimes(1);
  });
  it("Durchlauf behalten: keine Freigabe", async () => {
    const o = base({ runIds: ["a", "b"] });
    await leaveTask({ ...o, choice: "keep" });
    expect(o.release).not.toHaveBeenCalled();
  });
  it("Speicherfehler: keine Freigabe, Fehler wird geworfen", async () => {
    const o = base({ save: vi.fn().mockRejectedValue(new Error("x")) });
    await expect(leaveTask({ ...o, choice: "release" })).rejects.toThrow("x");
    expect(o.release).not.toHaveBeenCalled();
  });
  it("Abgeschlossene Aufgabe: kein Dialog und keine Freigabe", async () => {
    expect(needsBackDialog({ canEdit: true, status: "completed", assignedTo: ME, userId: ME })).toBe(false);
    const o = base({ measurementId: "c" });
    expect((await leaveTask({ ...o, choice: "release" })).released).toEqual([]);
  });
  it("Ohne Bearbeitungsrecht/fremde Zuweisung: kein Dialog", () => {
    expect(needsBackDialog({ canEdit: false, status: "open", assignedTo: ME, userId: ME })).toBe(false);
    expect(needsBackDialog({ canEdit: true, status: "open", assignedTo: "other", userId: ME })).toBe(false);
    expect(needsBackDialog({ canEdit: true, status: "open", assignedTo: ME, userId: ME })).toBe(true);
  });
  it("Navigation: im Durchlauf nie history-back", () => {
    expect(backTarget(true, 5)).toBe("/auftraege");
    expect(backTarget(false, 3)).toBe(-1);
    expect(backTarget(false, 0)).toBe("/auftraege");
  });
});
