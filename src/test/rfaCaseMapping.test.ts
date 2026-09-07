import { describe, it, expect } from "vitest";
import { mapReadings, mappingReport, type TargetCandidate } from "@/lib/measurementImport";
import { caseElementKeys } from "@/lib/measurementBlocks";

const targets: TargetCandidate[] = [
  { field_key: "v2o5", display_name: "V₂O₅", unit: "%" },
  { field_key: "as_wert", display_name: "As", unit: "ppm" },
  { field_key: "pb_wert", display_name: "Pb", unit: "ppm" },
  { field_key: "nb_wert", display_name: "Nb", unit: "%" },
];

const context = { V2O5: "", As: "", Pb: "", Nb: "", messmethode: "RFA" };

const read = (name: string, raw: string) => ({
  sourceName: name, raw, value: Number(raw.replace(",", ".")), unit: null, belowDetection: false,
});

describe("RFA-Zuordnung über Messkontext-Schlüssel", () => {
  it("liest die Elemente aus dem Messkontext", () => {
    expect(caseElementKeys(context)).toEqual(["V2O5", "As", "Pb", "Nb"]);
  });

  it("ordnet Spalten mit Einheit dem Ergebnisfeld zu", () => {
    const rows = mapReadings(
      [read("V2O5 (%)", "0,357"), read("As (PPM)", "12"), read("Pb (PPM)", "3"), read("Nb (%)", "0,1")],
      null, targets, { caseElementKeys: caseElementKeys(context) }
    );
    expect(rows.map((r) => r.targetFieldKey)).toEqual(["v2o5", "as_wert", "pb_wert", "nb_wert"]);
    expect(rows[0].value).toBe(0.357);
    expect(rows[0].caseElementKey).toBe("V2O5");
  });

  it("erkennt weitere Elemente, ordnet sie aber keinem Ergebnisfeld zu", () => {
    const rows = mapReadings([read("SiO2 (%)", "54,2")], null, targets, {
      caseElementKeys: caseElementKeys(context),
    });
    expect(rows[0].elementKeyDetected).toBe("SiO2");
    expect(rows[0].targetFieldKey).toBeNull();
    expect(mappingReport(rows, targets)[0]).toContain(
      "SiO2 (%) → SiO2 → nicht in der Ergebnisliste des Messfalls"
    );
  });
});

