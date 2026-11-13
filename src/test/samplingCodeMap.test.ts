import { describe, it, expect } from "vitest";
import { serviceNamesForCode, samplingCodeForServiceName } from "@/lib/samplingCodeMap";

describe("samplingCodeMap", () => {
  it("löst Kürzel auf Dienstleistungsnamen auf", () => {
    expect(serviceNamesForCode("Geo")).toContain("Geometrievermessung");
    expect(serviceNamesForCode("nox")).toContain("NOX-Messung");
    expect(serviceNamesForCode("SOx")).toContain("SOX-Messung");
    expect(serviceNamesForCode("PV")).toContain("Porenvolumen");
    expect(serviceNamesForCode("DP")).toContain("DP");
    expect(serviceNamesForCode("A")).toContain("Abrieb");
    expect(serviceNamesForCode("CA")).toContain("CA");
    expect(serviceNamesForCode("Bench")).toEqual(
      expect.arrayContaining(["BENCH NOx", "BENCH SOx"])
    );
  });

  it("liefert für unbekannte Kürzel nichts", () => {
    expect(serviceNamesForCode("XYZ")).toEqual([]);
  });

  it("liefert das Kürzel zum Dienstleistungsnamen", () => {
    expect(samplingCodeForServiceName("BET")).toBe("BET");
    expect(samplingCodeForServiceName("Geometrievermessung")).toBe("Geo");
    expect(samplingCodeForServiceName("Schulung")).toBeNull();
    expect(samplingCodeForServiceName("BENCH NOx")).toBe("Bench");
    expect(samplingCodeForServiceName("BENCH SOx")).toBe("Bench");
  });
});

import { findSamplingCodeConflict, normalizeServiceSamplingCode, selectableSamplingCodes, matchSamplingCodes } from "@/lib/samplingCodeMap";

describe("Beprobungskürzel aus den Dienstleistungseinstellungen", () => {
  const svc = [
    { id: "geo", service_name: "Geometrievermessung", sampling_code: "Geo", active: true, archived_at: null },
    { id: "rw", service_name: "Raumgewicht", sampling_code: "RW", active: true, archived_at: null },
    { id: "old", service_name: "Alt", sampling_code: "XX", active: false, archived_at: null },
    { id: "arch", service_name: "Archiv", sampling_code: "YY", active: true, archived_at: "2026-01-01" },
  ];
  it("speichert getrimmt, leer als null", () => {
    expect(normalizeServiceSamplingCode("  RW ")).toBe("RW");
    expect(normalizeServiceSamplingCode("   ")).toBeNull();
    expect(normalizeServiceSamplingCode(null)).toBeNull();
  });
  it("verhindert doppelte Kürzel ohne Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(findSamplingCodeConflict(" rw ", svc, "geo")?.id).toBe("rw");
    expect(findSamplingCodeConflict("GEO", svc, null)?.id).toBe("geo");
  });
  it("nimmt die bearbeitete, inaktive und archivierte Dienstleistung aus", () => {
    expect(findSamplingCodeConflict("RW", svc, "rw")).toBeNull();
    expect(findSamplingCodeConflict("XX", svc)).toBeNull();
    expect(findSamplingCodeConflict("YY", svc)).toBeNull();
    expect(findSamplingCodeConflict("", svc)).toBeNull();
  });
  it("neue dynamische Kürzel erscheinen in der Auswahl, ohne Duplikate", () => {
    const codes = selectableSamplingCodes([], ["RW", "geo", null, " "]);
    expect(codes).toContain("RW");
    expect(codes.filter((c) => c.toLowerCase() === "geo")).toHaveLength(1);
    expect(codes.slice(0, 3)).toEqual(["Geo", "NOx", "SOx"]);
  });
  it("löst dynamisches Kürzel auf die richtige service_id auf", () => {
    const r = matchSamplingCodes(["rw"], svc);
    expect(r.matched).toEqual([{ code: "rw", id: "rw", service_name: "Raumgewicht" }]);
  });
  it("DB-Kürzel hat Vorrang vor statischer Zuordnung", () => {
    const r = matchSamplingCodes(["CA"], [
      { id: "rfa", service_name: "RFA", sampling_code: "CA" },
      { id: "ca", service_name: "CA", sampling_code: null },
    ]);
    expect(r.matched.map((m) => m.id)).toEqual(["rfa"]);
  });
  it("statischer Fallback und Bench bleiben erhalten, keine Doppelten", () => {
    const s = [
      { id: "bn", service_name: "BENCH NOx", sampling_code: null },
      { id: "bs", service_name: "BENCH SOx", sampling_code: null },
      { id: "bet", service_name: "BET", sampling_code: null },
    ];
    const r = matchSamplingCodes(["BET", "Bench", "Bench NOx"], s);
    expect(r.matched.map((m) => m.id)).toEqual(["bet", "bn", "bs"]);
    expect(matchSamplingCodes(["ZZ"], s).missing).toEqual(["ZZ"]);
  });
});
