import { describe, expect, it } from "vitest";
import {
  EXTERNAL_APPS,
  canOpenExternalApp,
  externalAppForService,
  externalAppUrl,
} from "@/lib/externalApps";

describe("externalAppForService", () => {
  it("findet die App zum exakten Leistungsnamen", () => {
    expect(externalAppForService("Extrusion")?.label).toBe("In Extruder-App öffnen");
    expect(externalAppForService("Staucher")?.label).toBe("In Staucher-App öffnen");
  });

  it("liefert null für unbekannte oder fehlende Leistungsnamen", () => {
    expect(externalAppForService("RFA")).toBeNull();
    expect(externalAppForService("extrusion")).toBeNull();
    expect(externalAppForService(null)).toBeNull();
    expect(externalAppForService(undefined)).toBeNull();
    expect(externalAppForService("")).toBeNull();
  });
});

describe("externalAppUrl", () => {
  const extrusion = EXTERNAL_APPS[0];
  const staucher = EXTERNAL_APPS[1];

  it("baut den Charge-Link mit der Versuchsnummer", () => {
    expect(externalAppUrl(extrusion, "TE123")).toBe(
      "http://172.30.100.162:8080/charge-oeffnen?nr=TE123",
    );
    expect(externalAppUrl(staucher, "TE123")).toBe(
      "http://172.30.100.162:8081/?charge=TE123",
    );
  });

  it("kodiert Sonderzeichen in der Versuchsnummer", () => {
    expect(externalAppUrl(extrusion, "TE 25/7 ä")).toBe(
      `http://172.30.100.162:8080/charge-oeffnen?nr=${encodeURIComponent("TE 25/7 ä")}`,
    );
  });

  it("nutzt ohne Versuchsnummer die Startseite", () => {
    expect(externalAppUrl(extrusion, null)).toBe(extrusion.startUrl);
    expect(externalAppUrl(extrusion, undefined)).toBe(extrusion.startUrl);
    expect(externalAppUrl(extrusion, "")).toBe(extrusion.startUrl);
    expect(externalAppUrl(extrusion, "   ")).toBe(extrusion.startUrl);
  });

  it("entfernt umschließende Leerzeichen aus der Versuchsnummer", () => {
    expect(externalAppUrl(staucher, "  NC42  ")).toBe(
      "http://172.30.100.162:8081/?charge=NC42",
    );
  });
});

describe("canOpenExternalApp", () => {
  it("Master sieht den Button immer", () => {
    expect(canOpenExternalApp("master", null, "svc-1")).toBe(true);
    expect(canOpenExternalApp("master", [], null)).toBe(true);
  });

  it("Qualifizierte sehen den Button für ihre Leistung", () => {
    expect(canOpenExternalApp("durchfuehrer", ["svc-1", "svc-2"], "svc-1")).toBe(true);
    expect(canOpenExternalApp("durchfuehrer", new Set(["svc-1"]), "svc-1")).toBe(true);
  });

  it("andere Rollen ohne Qualifikation sehen den Button nicht", () => {
    expect(canOpenExternalApp("durchfuehrer", ["svc-2"], "svc-1")).toBe(false);
    expect(canOpenExternalApp("durchfuehrer", [], "svc-1")).toBe(false);
    expect(canOpenExternalApp("auftraggeber", ["svc-1"], "svc-1")).toBe(true);
    expect(canOpenExternalApp("durchfuehrer", null, "svc-1")).toBe(false);
    expect(canOpenExternalApp(null, ["svc-1"], "svc-1")).toBe(true);
  });

  it("ohne service_id ist der Button für Nicht-Master verborgen", () => {
    expect(canOpenExternalApp("durchfuehrer", ["svc-1"], null)).toBe(false);
    expect(canOpenExternalApp("durchfuehrer", ["svc-1"], undefined)).toBe(false);
  });
});
