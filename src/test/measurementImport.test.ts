import { describe, it, expect } from "vitest";
import { parseMeasurementText, mapReadings, outputValue, parseValue, normalizeName } from "@/lib/measurementImport";

const profile = { mappings: [{ source_names: ["SiO₂"], target_field_key: "sio2", unit: "%" }] } as any;
const targets = [{ field_key: "sio2", display_name: "SiO2", unit: "%" }];

describe("measurementImport", () => {
  it("normalisiert tiefgestellte Ziffern", () => {
    expect(normalizeName("SiO₂")).toBe("sio2");
    expect(normalizeName("Spez. Oberfläche")).toBe("spezoberflache");
  });

  it("liest deutsche und englische Zahlen inkl. Einheit", () => {
    expect(parseValue("54,2").value).toBe(54.2);
    expect(parseValue("1.234,5").value).toBe(1234.5);
    expect(parseValue("38.1 %").unit).toBe("%");
    expect(parseValue("<0,01").belowDetection).toBe(true);
  });

  it("erkennt Parameter/Wert-Listen", () => {
    const r = parseMeasurementText("SiO2\t54,2\nFe2O3 <0,01");
    expect(r.detectedFormat).toBe("key_value");
    expect(r.samples[0].readings.map((x) => x.sourceName)).toEqual(["SiO2", "Fe2O3"]);
  });

  it("erkennt Tabellen mit Proben in Spalten und in Zeilen", () => {
    const a = parseMeasurementText("Element\tP1\tP2\nSiO2\t54,2\t53,9", { knownNames: ["SiO2"] });
    expect(a.detectedFormat).toBe("table_params_in_rows");
    expect(a.samples.map((s) => s.label)).toEqual(["P1", "P2"]);
    const b = parseMeasurementText("Probe;SiO2;Al2O3\nA;54,2;38,1", { knownNames: ["SiO2", "Al2O3"] });
    expect(b.detectedFormat).toBe("table_params_in_columns");
    expect(b.samples[0].label).toBe("A");
  });

  it("ordnet über Profil zu und übernimmt Werte", () => {
    const r = parseMeasurementText("SiO2: 54,2");
    const rows = mapReadings(r.samples[0].readings, profile, targets);
    expect(rows[0].targetFieldKey).toBe("sio2");
    expect(outputValue(rows[0])).toBe(54.2);
  });
});
