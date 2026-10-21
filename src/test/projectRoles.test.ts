import { describe, it, expect } from "vitest";
import { rolesOfUser, primaryRole, isLeaderOrOwner, excludedForRole } from "@/lib/projectRoles";

const A = "a", B = "b";

describe("Mehrfachrollen im Projekt", () => {
  it("Owner kann zusätzlich als Leader ausgewählt werden", () => {
    expect(excludedForRole([{ user_id: A, role: "owner" }], "leader")).not.toContain(A);
  });
  it("Leader kann zusätzlich als Owner ausgewählt werden", () => {
    expect(excludedForRole([{ user_id: A, role: "leader" }], "owner")).not.toContain(A);
  });
  it("gleiche Rolle doppelt wird ausgeschlossen", () => {
    expect(excludedForRole([{ user_id: A, role: "owner" }], "owner")).toContain(A);
  });
  it("Doppelrolle wird vollständig erkannt", () => {
    const m = [{ user_id: A, role: "leader" }, { user_id: A, role: "owner" }, { user_id: B, role: "member" }];
    expect(rolesOfUser(m, A)).toEqual(["owner", "leader"]);
    expect(primaryRole(rolesOfUser(m, A))).toBe("owner");
  });
  it("nach Entfernen der Leader-Rolle bleibt Owner-Berechtigung", () => {
    const m = [{ user_id: A, role: "owner" }];
    expect(isLeaderOrOwner(rolesOfUser(m, A))).toBe(true);
  });
  it("Member allein hat keine Leitungsrechte", () => {
    expect(isLeaderOrOwner(rolesOfUser([{ user_id: B, role: "member" }], B))).toBe(false);
  });
});
