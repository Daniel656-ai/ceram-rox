import { describe, it, expect } from "vitest";
import { buildServiceSchemas, flattenSchemas, columnHeader, resultCell, exportCell } from "@/lib/resultSchema";
import { reorderNoxItems, parseNoxParam } from "@/lib/noxColumnOrder";

const res = (label: string, value: number, unit: string) => ({
  id: label, result_name: label, display_label: label, value, unit,
  temperature_range_from: null, temperature_range_to: null, temperature_unit: null,
  remarks: null, measured_at: "2026-10-15", is_official: true,
});
const rec = (outputResults: any[], serviceName = "NOX-Messung", serviceId = "nox") =>
  ({ measurementId: "m", serviceId, serviceName, outputResults, inputParameters: {} }) as any;

const shuffled = [
  res("η-NOx 3 (360 °C)", 93, "%"),
  res("K-Wert 1 (200 °C)", 10, "Nm/h"),
  res("η-NOx 1 (200 °C)", 71, "%"),
  res("K-Wert 3 (360 °C)", 30, "Nm/h"),
  res("K-Wert 2 (280 °C)", 20, "Nm/h"),
  res("η-NOx 2 (280 °C)", 85, "%"),
];

describe("NOx-Spaltenreihenfolge", () => {
  it("sortiert nach Temperatur, je Temperatur K-Wert vor η-NOx – unabhängig von DB-Reihenfolge", () => {
    for (const input of [shuffled, [...shuffled].reverse()]) {
      const cols = flattenSchemas(buildServiceSchemas([rec(input)]));
      expect(cols.map(columnHeader)).toEqual([
        "K-Wert (200 °C) [Nm/h]", "η-NOx (200 °C) [%]",
        "K-Wert (280 °C) [Nm/h]", "η-NOx (280 °C) [%]",
        "K-Wert (360 °C) [Nm/h]", "η-NOx (360 °C) [%]",
      ]);
    }
  });

  it("Zuordnung Wert ↔ Spalte bleibt unverändert", () => {
    const r = rec(shuffled);
    const cols = flattenSchemas(buildServiceSchemas([r]));
    expect(cols.map((c) => exportCell(r, c.key))).toEqual([10, 71, 20, 85, 30, 93]);
    expect(resultCell(r, cols[0].key).value).toBe(10);
  });

  it("behält Indexnummer bei mehrdeutiger Temperatur", () => {
    const cols = flattenSchemas(buildServiceSchemas([rec([
      res("K-Wert 1 (200 °C)", 1, "Nm/h"), res("K-Wert 2 (200 °C)", 2, "Nm/h"),
    ])]));
    expect(cols.map(columnHeader)).toEqual(["K-Wert 1 (200 °C) [Nm/h]", "K-Wert 2 (200 °C) [Nm/h]"]);
  });

  it("andere Spalten behalten ihre Position", () => {
    const items = ["Feuchte", "η-NOx 1 (200 °C)", "SiO2", "K-Wert 1 (200 °C)"];
    expect(reorderNoxItems(items, (x) => x)).toEqual(["Feuchte", "K-Wert 1 (200 °C)", "SiO2", "η-NOx 1 (200 °C)"]);
    const rfa = flattenSchemas(buildServiceSchemas([rec([res("SiO2", 1, "%"), res("Al2O3", 2, "%")], "RFA", "rfa")]));
    expect(rfa.map((c) => c.key)).toEqual(["SiO2", "Al2O3"]);
    expect(parseNoxParam("K-Wert")).toBeNull();
  });
});
