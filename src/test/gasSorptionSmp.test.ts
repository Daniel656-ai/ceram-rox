import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseGasSorptionFile, detectGasSorption } from "@/lib/instrumentImport/gasSorption";
import { readIsothermPoints, isothermDataset } from "@/lib/instrumentImport/gasSorption/smp";
import { allResults } from "@/lib/instrumentImport";

const load = (name: string) => {
  const b = readFileSync(resolve(__dirname, "fixtures/gasSorption", name));
  return { name, buffer: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
};

const textFile = (lines: string[]) => ({
  name: "isotherme.txt",
  buffer: new TextEncoder().encode(lines.join("\n")).buffer as ArrayBuffer,
});

describe("Gasadsorption: SMP genügt als Importquelle", () => {
  const SMP = load("0000-8579.SMP");
  const REP = load("0000-8579.REP");

  it("Test 1 – nur SMP: Import gelingt und liefert Proben- und Analysedaten", () => {
    expect(detectGasSorption(SMP)).toBe(true);
    const m = parseGasSorptionFile(SMP);
    expect(m.sampleInformation.sampleName).toBe("MRS-525");
    expect(m.sampleInformation.sampleMass).toBeCloseTo(0.1959, 4);
    expect(m.headerMap?.["Free Space (kalt)"]).toBe("31.0337 cm³");
    expect(m.headerMap?.["Systemvolumen"]).toBe("13.5066 cm³");
  });

  it("verlangt niemals eine Reportdatei", () => {
    const w = parseGasSorptionFile(SMP).warnings.join(" ");
    expect(w).not.toMatch(/bitte zusätzlich.*\.REP/i);
    expect(w).not.toMatch(/erforderlich/i);
    expect(w).toMatch(/optional/i);
  });

  it("Test 2 – SMP + REP: die Reportdatei liefert zusätzlich die BET-Kennwerte", () => {
    const bet = allResults(parseGasSorptionFile(REP)).find((r) => r.normalizedName === "bet_surface_area");
    expect(bet?.value).toBeCloseTo(264.7311, 4);
    expect(bet?.unit).toBe("m²/g");
    // Der SMP-Import bleibt davon unberührt.
    expect(parseGasSorptionFile(SMP).sampleInformation.sampleMass).toBeCloseTo(0.1959, 4);
  });

  it("Test 3 – Kennwerte aus einer Messdatei mit Ergebnisteil werden übernommen", () => {
    const m = parseGasSorptionFile({
      name: "mit-ergebnis.smp",
      buffer: new TextEncoder().encode(
        ["Sample: Probe X", "BET Surface Area: 12,5 m²/g", "Single point adsorption total pore volume: 0,041 cm³/g"].join("\n")
      ).buffer as ArrayBuffer,
    });
    const bet = allResults(m).find((r) => r.normalizedName === "bet_surface_area");
    expect(bet?.value).toBeCloseTo(12.5, 3);
    expect(bet?.unit).toBe("m²/g");
  });

  it("Test 4 – Isothermen-Rohdaten werden als Kurvendatensatz übernommen", () => {
    const lines = ["Relative Pressure;Quantity Adsorbed", "0,05;12,1", "0,10;18,4", "0,20;24,9", "0,30;29,2", "0,40;33,8"];
    const pts = readIsothermPoints(lines);
    expect(pts).toHaveLength(5);
    const m = parseGasSorptionFile(textFile(lines));
    expect(m.dataset?.rows).toHaveLength(5);
    expect(m.dataset?.channels.map((c) => c.key)).toEqual(["relative_pressure", "quantity_adsorbed"]);
    expect(isothermDataset([])).toBeUndefined();
  });
});
