import { describe, it, expect } from "vitest";
import { reassignErrorText } from "./ReassignMeasurementDialog";

describe("reassignErrorText", () => {
  it("maps server refusals to clear messages", () => {
    expect(reassignErrorText("reason required")).toMatch(/Grund/);
    expect(reassignErrorText("measurement already completed")).toMatch(/Abgeschlossene/);
    expect(reassignErrorText("target not qualified")).toMatch(/nicht qualifiziert/);
    expect(reassignErrorText("not permitted")).toMatch(/Keine Berechtigung/);
    expect(reassignErrorText("not assigned")).toMatch(/niemandem zugewiesen/);
    expect(reassignErrorText("")).toMatch(/nicht geändert/);
  });
});
