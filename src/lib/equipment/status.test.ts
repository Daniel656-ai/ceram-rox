import { describe, expect, it } from "vitest";
import { equipmentStatus, warningDays, viennaDay, addDays, currentChecks, type EquipmentCheck } from "./status";
const equipment = { active: true, maintenance: false, manual_lock: false, next_due_date: "2026-11-10", history_locked: false, interval_days: 30 };
describe("equipment status rules", () => {
  it.each([[7, 1], [30, 6], [90, 7], [1, 1]])("warning interval %i = %i", (interval, expected) => expect(warningDays(interval)).toBe(expected));
  it("is green before warning", () => expect(equipmentStatus(equipment, "2026-11-03")).toBe("green"));
  it("is yellow on first warning day", () => expect(equipmentStatus(equipment, "2026-11-04")).toBe("yellow"));
  it("is yellow on due day", () => expect(equipmentStatus(equipment, "2026-11-10")).toBe("yellow"));
  it("is red after due day", () => expect(equipmentStatus(equipment, "2026-11-11")).toBe("red"));
  it("is neutral without first proof", () => expect(equipmentStatus({ ...equipment, next_due_date: null })).toBe("pending"));
  it("failure never turns green with time", () => expect(equipmentStatus({ ...equipment, history_locked: true }, "2027-11-01")).toBe("locked"));
  it("passed check does not end maintenance", () => expect(equipmentStatus({ ...equipment, maintenance: true }, "2026-11-01")).toBe("maintenance"));
  it("lock survives maintenance release", () => expect(equipmentStatus({ ...equipment, maintenance: false, history_locked: true })).toBe("locked"));
  it("inactive history remains neutral", () => expect(equipmentStatus({ ...equipment, active: false, history_locked: true })).toBe("inactive"));
  it("uses Vienna date across UTC midnight", () => expect(viennaDay(new Date("2026-11-09T23:30:00Z"))).toBe("2026-11-10"));
  it("uses calendar days across daylight saving", () => expect(addDays("2026-03-28", 7)).toBe("2026-04-04"));
  it("only leaves count, older correction cannot replace newer proof", () => {
    const rows = [{ id: "a", corrects_check_id: null, performed_at: "2026-01-01", root_check_id: null }, { id: "b", corrects_check_id: null, performed_at: "2026-02-01", root_check_id: null }, { id: "c", corrects_check_id: "a", performed_at: "2026-01-01", root_check_id: "a" }] as EquipmentCheck[];
    expect(currentChecks(rows).map(c => c.id)).toEqual(["b", "c"]);
  });
});