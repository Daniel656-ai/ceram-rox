import { describe, it, expect, vi } from "vitest";
import { leaveDestination, leaveDialogScope, performLeave } from "./leaveRun";

const ME = "me";
const base = (over: Partial<Parameters<typeof performLeave>[0]> = {}) => ({
  choice: "release" as const,
  flush: async () => {},
  runIds: ["a", "b", "c", "d"],
  userId: ME,
  loadState: async () => [
    { id: "a", status: "open", assigned_to: ME },
    { id: "b", status: "in_progress", assigned_to: ME },
    { id: "c", status: "completed", assigned_to: ME },
    { id: "d", status: "open", assigned_to: "other" },
  ],
  release: vi.fn().mockResolvedValue(true),
  ...over,
});

describe("Verlassen-Dialog Messdurchlauf", () => {
  it("1: Behalten sendet keinen Freigabeaufruf", async () => {
    const o = base({ choice: "keep" });
    expect(await performLeave(o)).toEqual({ ok: true });
    expect(o.release).not.toHaveBeenCalled();
  });
  it("2+4: Freigeben nur eigene offene Aufgaben, nicht abgeschlossene/fremde", async () => {
    const o = base();
    const r = await performLeave(o);
    expect(r.ok).toBe(true);
    expect((o.release as any).mock.calls.map((c: any[]) => c[0])).toEqual(["a", "b"]);
  });
  it("3: Umfang bei mehreren bzw. einer Aufgabe", () => {
    expect(leaveDialogScope(["a", "b"], () => "X")).toEqual({ count: 2, singleLabel: null });
    expect(leaveDialogScope(["a"], () => "A25-0001 · M250001")).toEqual({ count: 1, singleLabel: "A25-0001 · M250001" });
  });
  it("5: Speicherfehler → keine Freigabe", async () => {
    const o = base({ flush: async () => { throw new Error("x"); } });
    const r = await performLeave(o);
    expect(r).toMatchObject({ ok: false, stage: "save" });
    expect(o.release).not.toHaveBeenCalled();
  });
  it("6: Freigabefehler → ok:false (keine Navigation)", async () => {
    const o = base({ release: vi.fn().mockRejectedValue(new Error("net")) });
    expect(await performLeave(o)).toMatchObject({ ok: false, stage: "release" });
  });
  it("Zwischenzeitlich umgewiesen (Server false) → übersprungen, ok", async () => {
    const r = await performLeave(base({ release: vi.fn().mockResolvedValue(false) }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result?.skipped).toEqual(["a", "b"]);
  });
  it("8: Direktaufruf → /auftraege, sonst vorherige Seite", () => {
    expect(leaveDestination(0)).toBe("/auftraege");
    expect(leaveDestination(undefined)).toBe("/auftraege");
    expect(leaveDestination(3)).toBe(-1);
  });
});
