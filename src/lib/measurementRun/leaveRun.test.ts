import { describe, it, expect, vi } from "vitest";
import { releaseRun, selectReleasable } from "./leaveRun";

const ME = "me";
describe("Durchlauf verlassen", () => {
  it("gibt offene eigene Aufgaben frei (mit und ohne Zwischenstände)", async () => {
    const release = vi.fn().mockResolvedValue(true);
    const r = await releaseRun({
      runIds: ["a", "b"], userId: ME, release,
      loadState: async () => [
        { id: "a", status: "open", assigned_to: ME },
        { id: "b", status: "in_progress", assigned_to: ME },
      ],
    });
    expect(r.released).toEqual(["a", "b"]);
  });
  it("lässt abgeschlossene und fremde Aufgaben unberührt", () => {
    expect(selectReleasable([
      { id: "c", status: "completed", assigned_to: ME },
      { id: "d", status: "open", assigned_to: "other" },
      { id: "e", status: "open", assigned_to: null },
    ], ME)).toEqual([]);
  });
  it("Konkurrenz: Server lehnt ab → übersprungen, nicht überschrieben", async () => {
    const r = await releaseRun({
      runIds: ["a"], userId: ME, release: async () => false,
      loadState: async () => [{ id: "a", status: "open", assigned_to: ME }],
    });
    expect(r.skipped).toEqual(["a"]);
  });
  it("Einzelfehler macht erfolgreiche Freigaben nicht rückgängig", async () => {
    const release = vi.fn().mockImplementation(async (id: string) => {
      if (id === "b") throw new Error("x");
      return true;
    });
    const r = await releaseRun({
      runIds: ["a", "b"], userId: ME, release,
      loadState: async () => [
        { id: "a", status: "open", assigned_to: ME },
        { id: "b", status: "open", assigned_to: ME },
      ],
    });
    expect(r).toEqual({ released: ["a"], skipped: [], failed: ["b"] });
  });
});
