import { describe, expect, it } from "vitest";
import { detectTriStar, parseTriStarFile } from "@/lib/instrumentImport/micromeritics/tristar";
import { mapImportedResults, allResults } from "@/lib/instrumentImport";

/** Baut eine SMP-ähnliche Binärdatei aus UTF-16LE-Textblöcken. */
function smp(lines: string[]): ArrayBuffer {
  const parts: number[] = [];
  for (const l of lines) {
    for (const ch of l) { parts.push(ch.charCodeAt(0) & 0xff, 0); }
    parts.push(0, 0, 0, 0);
  }
  return new Uint8Array(parts).buffer;
}

const FILE = {
  name: "probe-a.SMP",
  buffer: smp([
    "Micromeritics TriStar II Plus 3020",
    "Sample: Ton A 1200C",
    "Sample Mass: 0.3421 g",
    "Analysis Date: 2026-05-04 09:12",
    "BET Surface Area: 12.4837 m²/g",
    "Slope: 0.279431 g/cm³ STP",
    "Intercept: 0.001204 g/cm³ STP",
    "Correlation Coefficient: 0.9999412",
    "C Constant: 232.4501",
    "Single point adsorption total pore volume: 0.041233 cm³/g",
  ]),
};

describe("Micromeritics TriStar Importer", () => {
  it("erkennt TriStar-Dateien", () => {
    expect(detectTriStar(FILE)).toBe(true);
    expect(detectTriStar({ name: "daten.csv", buffer: FILE.buffer })).toBe(false);
  });

  it("liest BET-Kennwerte mit hoher Konfidenz", () => {
    const m = parseTriStarFile(FILE);
    const bet = m.analyses.find((a) => a.type === "BET");
    expect(bet).toBeTruthy();
    const area = bet!.results.find((r) => r.normalizedName === "bet_surface_area")!;
    expect(area.value).toBeCloseTo(12.4837, 4);
    expect(area.unit).toBe("m²/g");
    expect(area.confidence).toBe("high");
    const c = bet!.results.find((r) => r.normalizedName === "bet_c_constant")!;
    expect(c.value).toBeCloseTo(232.4501, 4);
  });

  it("liest Probeninformationen", () => {
    const m = parseTriStarFile(FILE);
    expect(m.sampleInformation.sampleName).toContain("Ton A");
    expect(m.sampleInformation.sampleMass).toBeCloseTo(0.3421, 4);
  });

  it("warnt bei unbekannten Dateien statt zu raten", () => {
    const m = parseTriStarFile({ name: "leer.smp", buffer: smp(["Irgendein Text", "ohne Kennwerte"]) });
    expect(allResults(m)).toHaveLength(0);
    expect(m.warnings.length).toBeGreaterThan(0);
  });

  it("ordnet Kennwerte deutschen Formularfeldern zu und erkennt Konflikte", () => {
    const m = parseTriStarFile(FILE);
    const rows = mapImportedResults(
      allResults(m),
      null,
      [
        { field_key: "spezifische_oberflaeche_bet", display_name: "Spezifische Oberfläche - BET", unit: "m²/g" },
        { field_key: "bet_c_konstante", display_name: "BET C-Konstante", unit: null },
      ],
      { spezifische_oberflaeche_bet: 10 }
    );
    const area = rows.find((r) => r.normalizedName === "bet_surface_area")!;
    expect(area.targetFieldKey).toBe("spezifische_oberflaeche_bet");
    expect(area.existingValue).toBe(10);
    const c = rows.find((r) => r.normalizedName === "bet_c_constant")!;
    expect(c.targetFieldKey).toBe("bet_c_konstante");
    expect(c.existingValue).toBeNull();
    // Nicht zuordenbare Kennwerte bleiben ohne Zielfeld (kein Feld wird erzeugt).
    expect(rows.some((r) => r.targetFieldKey === null)).toBe(true);
  });
});
