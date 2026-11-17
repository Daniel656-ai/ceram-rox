import { describe, it, expect } from "vitest";
import { showOwnOrderActions, ownOrderActionMode } from "./requesterEdit";
const roles = (...r: string[]) => (x: string) => r.includes(x);
const base = { userId: "u1", createdBy: "u1", status: "open" };
describe("own order actions", () => {
  it("master, own open order → shown when server allows", () => {
    expect(showOwnOrderActions({ ...base, hasRole: roles("master") })).toBe(true);
    expect(ownOrderActionMode({ can_edit: true, reason: null }, false)).toBe("edit_delete");
  });
  it("master, foreign order → not shown", () => {
    expect(showOwnOrderActions({ ...base, createdBy: "u2", hasRole: roles("master") })).toBe(false);
  });
  it("requester, own open order → shown", () => {
    expect(showOwnOrderActions({ ...base, hasRole: roles("auftraggeber") })).toBe(true);
  });
  it("order in progress → no delete", () => {
    expect(showOwnOrderActions({ ...base, status: "in_progress", hasRole: roles("master") })).toBe(false);
    expect(ownOrderActionMode({ can_edit: false, reason: "started" }, false)).toBe("locked");
  });
  it("server denies or errors → no delete", () => {
    expect(ownOrderActionMode({ can_edit: false, reason: "forbidden" }, false)).toBe("none");
    expect(ownOrderActionMode(undefined, true)).toBe("none");
    expect(ownOrderActionMode(undefined, false)).toBe("none");
  });
  it("multiple roles detected via hasRole", () => {
    expect(showOwnOrderActions({ ...base, hasRole: roles("durchfuehrer", "auftraggeber") })).toBe(true);
    expect(showOwnOrderActions({ ...base, hasRole: roles("durchfuehrer") })).toBe(false);
  });
});
