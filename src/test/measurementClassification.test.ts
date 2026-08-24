import { describe, expect, it } from "vitest";
import { parseMeasurementText, mapReadings, outputValue } from "@/lib/measurementImport";
import { classifyReading, splitNameUnit, canonicalParameter } from "@/lib/measurementClassification";

const targets = [
  { field_key: "sio2", display_name: "SiO2", unit: "%" },
  { field_key: "al2o3", display_name: "Al2O3", unit: "%" },
  { field_key: "as", display_name: "As", unit: "ppm" },
  { field_key: "pb", display_name: "Pb", unit: "ppm" },
];

const classifyAll = (text: string) =>
  parseMeasurementText(text).samples[0].readings.map((r) => ({ r, c: classifyReading(r) }));

describe("Trennung Messwerte / Metadaten", () => {
  it("TEST 1: erkennt Messwerte und Metadaten getrennt", () => {
    const rows = classifyAll(
      "Datum: 24.08.2026\nMessmethode: Standardless\nOperator: Max Mustermann\nSiO2: 51,98 %\nAl2O3: 18,47 %\nAs (PPM): 123\nPb (PPM): 45"
    );
    const cat = Object.fromEntries(rows.map((x) => [x.c.parameter, x.c.category]));
    expect(cat["SiO2"]).toBe("measurement");
    expect(cat["Al2O3"]).toBe("measurement");
    expect(cat["As"]).toBe("measurement");
    expect(cat["Pb"]).toBe("measurement");
    expect(cat["Datum"]).toBe("metadata");
    expect(cat["Messmethode"]).toBe("metadata");
    expect(cat["Operator"]).toBe("metadata");
  });

  it("TEST 2: unbekannter Messwert bleibt erhalten und gilt als nicht zugeordnet", () => {
    const rows = classifyAll("Cr: 125 ppm");
    expect(rows[0].c.category).toBe("measurement");
    const mapped = mapReadings([rows[0].r], null, targets)[0];
    expect(mapped.targetFieldKey).toBeNull();
    expect(outputValue(mapped)).toBe(125);
  });

  it("TEST 3 + 4: As (PPM) und Pb (PPM) werden zugeordnet", () => {
    const rows = classifyAll("As (PPM): 123\nPB [ppm]: 45\nArsenic: 7");
    const mapped = mapReadings(
      rows.map((x) => ({ ...x.r, sourceName: x.c.parameter, unit: x.c.unit })),
      null,
      targets
    );
    expect(mapped[0].targetFieldKey).toBe("as");
    expect(mapped[1].targetFieldKey).toBe("pb");
    expect(mapped[2].targetFieldKey).toBe("as");
  });

  it("TEST 5: numerische Geräte-ID ist kein Messwert", () => {
    expect(classifyAll("Geräte-ID: 123456")[0].c.category).toBe("metadata");
    expect(classifyAll("Messzeit: 14:35:22")[0].c.category).toBe("metadata");
    expect(classifyAll("Seriennummer: 998877")[0].c.category).toBe("metadata");
  });

  it("trennt Parametername und Einheit", () => {
    expect(splitNameUnit("As (PPM)")).toEqual({ name: "As", unit: "ppm" });
    expect(splitNameUnit("SiO₂ (%)").unit).toBe("%");
    expect(splitNameUnit("Pb ppm").name).toBe("Pb");
    expect(canonicalParameter("As [PPM]")).toBe("as");
    expect(canonicalParameter("Lead")).toBe("pb");
  });
});
