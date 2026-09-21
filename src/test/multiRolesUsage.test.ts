import { describe, it, expect, vi, beforeEach } from "vitest";
import { primaryRole, normalizeRoles, mergePermissions } from "@/lib/roles";

vi.mock("@/lib/api", () => ({ api: { usageEvents: { insertBatch: vi.fn(async () => true) } } }));

import { trackUsage, setUsageUser, composeAction, parseAction, __usageBuffer, __resetUsage } from "@/lib/usageTracking";

describe("Mehrere Rollen pro Mitarbeiter", () => {
  it("Benutzer nur Auftraggeber verhält sich wie bisher", () => {
    expect(normalizeRoles(["auftraggeber"])).toEqual(["auftraggeber"]);
    expect(primaryRole(["auftraggeber"])).toBe("auftraggeber");
  });

  it("Benutzer nur Messdienstleister verhält sich wie bisher", () => {
    expect(primaryRole(["durchfuehrer"])).toBe("durchfuehrer");
  });

  it("Auftraggeber + Messdienstleister bleiben beide aktiv – keine Kombi-Rolle", () => {
    const roles = normalizeRoles(["auftraggeber", "durchfuehrer"]);
    expect(roles).toEqual(["durchfuehrer", "auftraggeber"]);
    expect(roles).toHaveLength(2);
    expect(primaryRole(roles)).toBe("durchfuehrer");
  });

  it("Rollen überschreiben sich nicht: Berechtigungen sind die Summe", () => {
    const summe = mergePermissions([
      ["orders.create", "orders.view"],
      ["measurements.enter", "orders.view"],
    ]);
    expect(summe.sort()).toEqual(["measurements.enter", "orders.create", "orders.view"]);
  });

  it("Doppelte Rollenangaben erzeugen keine Duplikate", () => {
    expect(normalizeRoles(["master", "master", null, undefined])).toEqual(["master"]);
  });
});

describe("Generische Nutzungserfassung", () => {
  beforeEach(() => { __resetUsage(); setUsageUser("u1"); });

  it("erfasst ein bestehendes Modul korrekt", () => {
    trackUsage({ module: "fertigungsunterlagen", action: "module_opened" });
    const [e] = __usageBuffer();
    expect(e.module).toBe("fertigungsunterlagen");
    expect(e.action).toBe("module_opened");
    expect(e.user_id).toBe("u1");
    expect(e.variant).toBe("web");
    expect(Date.parse(e.occurred_at)).not.toBeNaN();
  });

  it("erfasst Funktion und Aktion innerhalb eines Moduls", () => {
    trackUsage({ module: "fertigungsunterlagen", feature: "m3_liste", action: "export" });
    expect(__usageBuffer()[0].action).toBe("m3_liste.export");
    expect(parseAction("m3_liste.export")).toEqual({ feature: "m3_liste", action: "export" });
    expect(parseAction("module_opened")).toEqual({ feature: null, action: "module_opened" });
  });

  it("ein neues Modul benötigt keine Änderung der Struktur", () => {
    trackUsage({ module: "cfd_simulation", feature: "stroemung", action: "berechnet" });
    const [e] = __usageBuffer();
    expect(e.module).toBe("cfd_simulation");
    expect(e.action).toBe("stroemung.berechnet");
    expect(Object.keys(e).sort()).toEqual(["action", "module", "occurred_at", "user_id", "variant"]);
  });

  it("eine Nutzung erzeugt genau ein Ereignis – unabhängig von der Rollenanzahl", () => {
    trackUsage({ module: "labor", feature: "rfa", action: "geoeffnet" });
    expect(__usageBuffer()).toHaveLength(1);
  });

  it("ohne angemeldeten Benutzer wird nichts erfasst", () => {
    setUsageUser(null);
    trackUsage({ module: "labor" });
    expect(__usageBuffer()).toHaveLength(0);
  });

  it("bestehende Aufrufe ohne Funktion bleiben unverändert", () => {
    expect(composeAction(undefined, "module_opened")).toBe("module_opened");
  });
});
