import { describe, expect, it } from "vitest";
import { NAV_PERMISSION_LABELS, PERMISSION_GROUPS, PERMISSION_LABELS } from "@/hooks/usePermissions";

describe("Fertigungsunterlagen-Berechtigung", () => {
  it("behält die bestehenden technischen Permission-Keys bei", () => {
    const group = PERMISSION_GROUPS.find((entry) => entry.key === "production_releases");

    expect(group?.labelDe).toBe("Fertigungsunterlagen");
    expect(group?.permissions).toEqual([
      "production_releases.view",
      "production_releases.create",
      "production_releases.edit",
      "production_releases.import",
      "production_releases.approve",
      "production_releases.delete",
      "customers.manage",
    ]);
  });

  it("zeigt Navigation und Leserecht unter der aktuellen Bezeichnung an", () => {
    expect(NAV_PERMISSION_LABELS["nav.production_releases"].de).toBe("Fertigungsunterlagen");
    expect(PERMISSION_LABELS["production_releases.view"].de).toBe("Fertigungsunterlagen ansehen");
  });
});