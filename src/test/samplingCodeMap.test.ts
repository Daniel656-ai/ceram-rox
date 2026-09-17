import { describe, it, expect } from "vitest";
import { serviceNamesForCode, samplingCodeForServiceName } from "@/lib/samplingCodeMap";

describe("samplingCodeMap", () => {
  it("löst Kürzel auf Dienstleistungsnamen auf", () => {
    expect(serviceNamesForCode("Geo")).toContain("Geometrievermessung");
    expect(serviceNamesForCode("nox")).toContain("NOX-Messung");
    expect(serviceNamesForCode("PV")).toContain("Porenvolumen");
    expect(serviceNamesForCode("A")).toContain("Abrieb");
  });

  it("liefert für unbekannte Kürzel nichts", () => {
    expect(serviceNamesForCode("XYZ")).toEqual([]);
  });

  it("liefert das Kürzel zum Dienstleistungsnamen", () => {
    expect(samplingCodeForServiceName("BET")).toBe("BET");
    expect(samplingCodeForServiceName("Geometrievermessung")).toBe("Geo");
    expect(samplingCodeForServiceName("Schulung")).toBeNull();
  });
});
