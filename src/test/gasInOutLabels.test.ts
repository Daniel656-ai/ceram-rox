import { describe, it, expect } from "vitest";
import { formatElementLabel, elementKey } from "@/lib/elementKeys";
import { formatResultLabel } from "@/lib/resultLabels";
import { humanizeKey } from "@/lib/results/structuredValues";

describe("Gasnamen mit „in“/„out“ (nie Iod + Stickstoff)", () => {
  it.each([
    ["NO in", "NO in"],
    ["NO2 in", "NO₂ in"],
    ["N2O out", "N₂O out"],
    ["N2O in", "N₂O in"],
    ["NH3 in", "NH₃ in"],
    ["NH3 out", "NH₃ out"],
    ["CO in", "CO in"],
    ["CO out", "CO out"],
    ["CO2 in", "CO₂ in"],
    ["CO2 out", "CO₂ out"],
    ["H2O in", "H₂O in"],
    ["O2 in", "O₂ in"],
    ["N2 in", "N₂ in"],
    ["No2 in", "NO₂ in"],
    ["N2o out", "N₂O out"],
    ["NO₂ out", "NO₂ out"],
    ["NO_{2} in", "NO₂ in"],
  ])("Anzeige %s -> %s", (raw, expected) => {
    expect(formatElementLabel(raw)).toBe(expected);
  });

  it.each([
    ["no2_in", "NO₂ in"],
    ["no2_out", "NO₂ out"],
    ["n2o_in", "N₂O in"],
    ["n2o_out", "N₂O out"],
    ["nh3_in", "NH₃ in"],
    ["co_in", "CO in"],
    ["co2_out", "CO₂ out"],
    ["no_out", "NO out"],
    ["n_2_o_out", "N₂O out"],
  ])("JSON-Schlüssel %s -> %s", (key, expected) => {
    expect(humanizeKey(key)).toBe(expected);
  });

  it("mit Einheit: NO₂ in [ppm]", () => {
    expect(formatResultLabel("NO2 in", "ppm")).toBe("NO₂ in [ppm]");
    expect(formatResultLabel("CO2 out", "%")).toBe("CO₂ out [%]");
  });

  it("ist keine chemische Verbindung (keine Zuordnung/Umsortierung wie ein Element)", () => {
    expect(elementKey("NO2 in")).toBeNull();
    expect(elementKey("CO out")).toBeNull();
  });

  it("unverändert: Formeln ohne Richtung, Klartext und fremde Wörter mit „in“", () => {
    expect(formatElementLabel("NO2")).toBe("NO₂");
    expect(formatElementLabel("N2O")).toBe("N₂O");
    expect(formatElementLabel("SiO2")).toBe("SiO₂");
    expect(formatElementLabel("Temperatur in")).toBe("Temperatur in");
    expect(humanizeKey("fr_trocken")).toBe("Fr trocken");
    expect(humanizeKey("al_2_o_3")).toBe("Al₂O₃");
    expect(elementKey("SiO2")).toBe("SiO2");
  });
});

import { resultLabel } from "@/hooks/useResultsDatabase";
import { buildOrderComparison, type OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup, SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";

describe("Gasnamen in allen Ergebnisansichten", () => {
  it("resultLabel: Bezeichnung oder technischer Schlüssel", () => {
    expect(resultLabel({ display_label: "NO2 in", result_name: "form:f:no2_in" })).toBe("NO₂ in");
    expect(resultLabel({ display_label: null, result_name: "form:f:n2o_out" })).toBe("N₂O out");
    expect(resultLabel({ display_label: null, result_name: "form:f:co_in" })).toBe("CO in");
    expect(resultLabel({ display_label: "Temperatur", result_name: "form:f:temperatur" })).toBe("Temperatur");
    expect(resultLabel({ display_label: null, result_name: "form:f:fr_trocken" })).toBe("Fr trocken");
  });

  it("Ergebnisübersicht (Spalten je Auftrag)", () => {
    const res = (name: string, label: string | null): SampleResultValue =>
      ({ id: name, result_name: name, value: 1, unit: "ppm", display_label: label, is_official: true, remarks: null }) as unknown as SampleResultValue;
    const meas = { measurementId: "m1", serviceName: "Aktivität", results: [res("form:f:no2_in", null), res("form:f:n2o_out", "N2O out"), res("form:f:co2_out", "CO2 out")] } as unknown as SampleMeasurementRecord;
    const sample = { sampleKey: "P1", sampleNumber: "P1", sampleName: "", measurements: [meas] } as unknown as SampleGroup;
    const order = { orderKey: "o", orderId: "o", displayNumber: "A", projectNames: [], samples: [sample], measurementCount: 1, officialCount: 3, interimCount: 0, lastActivityAt: null } as OrderGroup;
    const labels = buildOrderComparison(order)[0].columns.map((c) => c.label);
    expect(labels).toEqual(["NO₂ in", "N₂O out", "CO₂ out"]);
  });
});
