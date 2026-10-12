import { describe, it, expect } from "vitest";
import {
  formatOrderNumber, isValidStartValue, isValidYear, isValidReason, sortForRenumber, overflows, lastCounter,
  hasCollision, canExecute, expectedIds, isStalePreviewError, type RenumberPreview,
} from "@/lib/orders/renumber";

const base: RenumberPreview = {
  user_id: "u", short_code: "SW-", prefix: "SW-26", year: 2026, start_value: 234, count: 2,
  last_counter: 235, overflow: false, collision_count: 0,
  orders: [
    { id: "a", current_number: "SW-260001", new_number: "SW-260234", created_at: "2026-01-01", status: "open", workflow_status: null, collision: false },
    { id: "b", current_number: "SW-260002", new_number: "SW-260235", created_at: "2026-01-02", status: "open", workflow_status: null, collision: false },
  ],
};

describe("renumber orders helpers", () => {
  it("formats like generate_order_number incl. hyphen short codes", () => {
    expect(formatOrderNumber("SW-", 2026, 234)).toBe("SW-260234");
    expect(formatOrderNumber("dga", 2026, 1)).toBe("DGA260001");
  });
  it("validates start value, year and reason", () => {
    expect(isValidStartValue(1)).toBe(true);
    expect(isValidStartValue(9999)).toBe(true);
    expect(isValidStartValue(0)).toBe(false);
    expect(isValidStartValue(10000)).toBe(false);
    expect(isValidStartValue(1.5)).toBe(false);
    expect(isValidYear(2026)).toBe(true);
    expect(isValidYear(1999)).toBe(false);
    expect(isValidReason("  abcd ")).toBe(false);
    expect(isValidReason(" abcde ")).toBe(true);
  });
  it("sorts by created_at ASC, id ASC", () => {
    const r = sortForRenumber([
      { id: "c", created_at: "2026-02-01T00:00:00Z" },
      { id: "b", created_at: "2026-01-01T00:00:00Z" },
      { id: "a", created_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("detects overflow", () => {
    expect(lastCounter(9998, 2)).toBe(9999);
    expect(overflows(9998, 2)).toBe(false);
    expect(overflows(9998, 3)).toBe(true);
    expect(overflows(9999, 0)).toBe(false);
  });
  it("detects normalized collisions", () => {
    expect(hasCollision(["SW-260234"], [" sw-260234 "])).toBe(true);
    expect(hasCollision(["SW-260234"], ["SW-260235"])).toBe(false);
  });
  it("blocks execution on empty, overflow, collision, short reason or missing confirmation", () => {
    expect(canExecute(base, "Anpassung extern", true)).toBe(true);
    expect(canExecute(base, "Anpassung extern", false)).toBe(false);
    expect(canExecute(base, "kurz", true)).toBe(false);
    expect(canExecute({ ...base, count: 0, orders: [] }, "Anpassung extern", true)).toBe(false);
    expect(canExecute({ ...base, overflow: true }, "Anpassung extern", true)).toBe(false);
    expect(canExecute({ ...base, collision_count: 1 }, "Anpassung extern", true)).toBe(false);
    expect(canExecute(null, "Anpassung extern", true)).toBe(false);
  });
  it("passes ordered ids and recognizes stale preview errors", () => {
    expect(expectedIds(base)).toEqual(["a", "b"]);
    expect(isStalePreviewError("Die Auftragsliste hat sich seit der Vorschau geändert. Bitte Vorschau aktualisieren.")).toBe(true);
    expect(isStalePreviewError("anderer Fehler")).toBe(false);
  });
});
