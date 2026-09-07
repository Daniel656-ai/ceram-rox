import { describe, it, expect } from "vitest";
import { elementKey, formatElementKey } from "@/lib/elementKeys";
import { canonicalParameter } from "@/lib/measurementClassification";
import { mapReadings, openTargets, rowStatus } from "@/lib/measurementImport";

describe("elementKeys", () => {
  it("liefert stabile Schlüssel für Formeln, Trivial- und Klartextnamen", () => {
    expect(elementKey("SiO₂")).toBe("SiO2");
    expect(elementKey("sio2")).toBe("SiO2");
    expect(elementKey("Silicon dioxide")).toBe("SiO2");
    expect(elementKey("Siliziumdioxid")).toBe("SiO2");
    expect(elementKey("Pb")).toBe("Pb");
    expect(elementKey("Blei")).toBe("Pb");
    expect(elementKey("Messdatum")).toBeNull();
    expect(formatElementKey("Al2O3")).toBe("Al₂O₃");
  });

  it("gleicht Import und Ergebnisfeld über den Element-Key ab", () => {
    expect(canonicalParameter("Silicon dioxide")).toBe(canonicalParameter("SiO₂"));
  });

  it("ordnet nur die vom Messfall benötigten Elemente zu", () => {
    const targets = [
      { field_key: "sio2", display_name: "SiO₂", unit: "%" },
      { field_key: "al2o3", display_name: "Al₂O₃", unit: "%" },
      { field_key: "cao", display_name: "CaO", unit: "%" },
    ];
    const readings = [
      { sourceName: "Silicon dioxide", raw: "54,2", value: 54.2, unit: "%", belowDetection: false },
      { sourceName: "Al2O3", raw: "38,1", value: 38.1, unit: "%", belowDetection: false },
      { sourceName: "TiO2", raw: "0,4", value: 0.4, unit: "%", belowDetection: false },
      { sourceName: "BaO", raw: "0,1", value: 0.1, unit: "%", belowDetection: false },
    ];
    const rows = mapReadings(readings as any, null, targets);
    expect(rows.map(rowStatus)).toEqual(["assigned", "assigned", "not_needed", "not_needed"]);
    expect(openTargets(rows, targets).map((t) => t.field_key)).toEqual(["cao"]);
  });
});
