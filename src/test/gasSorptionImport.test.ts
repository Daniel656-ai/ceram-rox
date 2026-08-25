import { describe, expect, it } from "vitest";
import { detectGasSorption, parseGasSorptionFile, toNumber } from "@/lib/instrumentImport/gasSorption";
import { mapImportedResults, allResults } from "@/lib/instrumentImport";

/** Baut eine binäre Messdatei (z. B. .SMP) aus UTF-16LE-Textblöcken. */
function binaryFile(lines: string[]): ArrayBuffer {
  const parts: number[] = [];
  for (const l of lines) {
    for (const ch of l) parts.push(ch.charCodeAt(0) & 0xff, 0);
    parts.push(0, 0, 0, 0);
  }
  return new Uint8Array(parts).buffer;
}

const textFile = (lines: string[]) => new TextEncoder().encode(lines.join("\n")).buffer;

const LINES = [
  "Micromeritics TriStar II Plus 3020",
  "Sample: Ton A 1200C",
  "Sample Mass: 0.3421 g",
  "Analysis Date: 2026-05-04 09:12",
  "Operator: M. Huber",
  "BET Surface Area: 12.4837 m²/g",
  "Slope: 0.279431 g/cm³ STP",
  "Intercept: 0.001204 g/cm³ STP",
  "Correlation Coefficient: 0.9999412",
  "C Constant: 232.4501",
  "Langmuir Surface Area: 18.221 m²/g",
  "t-Plot micropore volume: 0.002145 cm³/g",
  "t-Plot external surface area: 11.902 m²/g",
  "BJH Adsorption cumulative volume of pores: 0.03911 cm³/g",
  "BJH Desorption cumulative surface area: 14.771 m²/g",
  "DFT cumulative pore volume: 0.04012 cm³/g",
  "Single point adsorption total pore volume: 0.041233 cm³/g",
];

const FILE = { name: "probe-a.SMP", buffer: binaryFile(LINES) };

describe("Importprofil Gasadsorption", () => {
  it("erkennt Gasadsorptionsdateien inhaltlich, nicht nur per Endung", () => {
    expect(detectGasSorption(FILE)).toBe(true);
    expect(detectGasSorption({ name: "notizen.txt", buffer: textFile(["Hallo Welt"]) })).toBe(false);
    expect(detectGasSorption({ name: "bericht.txt", buffer: textFile(LINES) })).toBe(true);
  });

  it("liest BET-Kennwerte mit hoher Konfidenz", () => {
    const m = parseGasSorptionFile(FILE);
    const bet = m.analyses.find((a) => a.type === "BET")!;
    const area = bet.results.find((r) => r.normalizedName === "bet_surface_area")!;
    expect(area.value).toBeCloseTo(12.4837, 4);
    expect(area.unit).toBe("m²/g");
    expect(area.confidence).toBe("high");
    expect(bet.results.find((r) => r.normalizedName === "bet_c_constant")!.value).toBeCloseTo(232.4501, 4);
  });

  it("unterstützt mehrere Auswertungen in einem Profil", () => {
    const types = parseGasSorptionFile(FILE).analyses.map((a) => a.type);
    for (const t of ["BET", "LANGMUIR", "T_PLOT", "BJH_ADSORPTION", "BJH_DESORPTION", "NLDFT", "ISOTHERM"]) {
      expect(types).toContain(t);
    }
  });

  it("trennt Einheiten sauber vom Parameternamen", () => {
    const rows = allResults(parseGasSorptionFile(FILE));
    for (const r of rows) {
      expect(r.sourceName).not.toMatch(/m²\/g|cm³\/g|\bnm\b/i);
    }
    expect(rows.find((r) => r.normalizedName === "tplot_micropore_volume")!.unit).toBe("cm³/g");
  });

  it("importiert technische Metadaten nicht als Messwert", () => {
    const rows = allResults(parseGasSorptionFile(FILE));
    const names = rows.map((r) => r.sourceName.toLowerCase()).join(" | ");
    expect(names).not.toContain("operator");
    expect(names).not.toContain("analysis date");
    const m = parseGasSorptionFile(FILE);
    expect(m.sampleInformation.sampleName).toContain("Ton A");
    expect(m.sampleInformation.sampleMass).toBeCloseTo(0.3421, 4);
  });

  it("bleibt herstellerunabhängig und hält Herstellerangaben als Metadatum", () => {
    const m = parseGasSorptionFile(FILE);
    expect(m.source.toLowerCase()).toContain("micromeritics");
    const other = parseGasSorptionFile({
      name: "autosorb.txt",
      buffer: textFile(["Quantachrome Autosorb iQ", "BET Surface Area: 5,25 m²/g"]),
    });
    expect(allResults(other)[0].value).toBeCloseTo(5.25, 2);
  });

  it("erhält unbekannte Messwerte statt sie zu verwerfen", () => {
    const m = parseGasSorptionFile({
      name: "extra.txt",
      buffer: textFile(["BET Surface Area: 3.10 m²/g", "Kohlenstoffgehalt: 1.44 %"]),
    });
    const unknown = allResults(m).find((r) => r.sourceName.toLowerCase().includes("kohlenstoff"))!;
    expect(unknown).toBeTruthy();
    expect(unknown.value).toBeCloseTo(1.44, 2);
    expect(unknown.unit).toBe("%");
  });

  it("warnt bei unbekannten Dateien statt zu raten", () => {
    const m = parseGasSorptionFile({ name: "leer.smp", buffer: binaryFile(["Irgendein Text", "ohne Kennwerte"]) });
    expect(allResults(m)).toHaveLength(0);
    expect(m.warnings.length).toBeGreaterThan(0);
  });

  it("liest deutsche und englische Zahlenformate", () => {
    expect(toNumber("12,4837")).toBeCloseTo(12.4837, 4);
    expect(toNumber("1.234,5")).toBeCloseTo(1234.5, 1);
    expect(toNumber("1,234.5")).toBeCloseTo(1234.5, 1);
  });

  it("ordnet Kennwerte deutschen Formularfeldern zu und erkennt Konflikte", () => {
    const rows = mapImportedResults(
      allResults(parseGasSorptionFile(FILE)),
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
    expect(rows.find((r) => r.normalizedName === "bet_c_constant")!.targetFieldKey).toBe("bet_c_konstante");
    expect(rows.some((r) => r.targetFieldKey === null)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Reale Gerätedateien (Micromeritics TriStar II Plus)                 */
/* ------------------------------------------------------------------ */

/** Baut eine .REP-Datenstruktur: Gruppenkopf + längenpräfigierte UTF-16LE-Records. */
function repFile(groups: string[][]): ArrayBuffer {
  const bytes: number[] = [];
  const u32 = (n: number) => { bytes.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255); };
  for (const group of groups) {
    group.forEach((text, idx) => {
      if (idx === 0) { u32(0); u32(1); u32(group.length); }
      bytes.push(0xe0, 0x01, 0x00);
      u32(text.length * 2);
      for (const ch of text) { const c = ch.charCodeAt(0); bytes.push(c & 255, (c >> 8) & 255); }
    });
    bytes.push(0, 0, 0, 0, 0, 0);
  }
  return new Uint8Array(bytes).buffer;
}

describe("Micromeritics Reportdatei (.REP)", () => {
  const REP = {
    name: "0000-8579.REP",
    buffer: repFile([
      ["BET Surface Area:", "  "],
      ["264,7311 m²/g", "  "],
      ["TriStar II Plus Version 3.03"],
      ["Sample:", "Operator:", "Submitter:", "File:"],
      ["MRS-525", "Berger Christian", "Ceram Austria GmbH", "C:\\TriStar II Plus\\data\\0000-8579.SMP"],
      ["Started:", "Completed:", "Sample mass:", "Analysis bath temp.:"],
      ["04.08.2026 09:03:49", "04.08.2026 10:02:34", "0,1959 g", "77,300 K"],
    ]),
  };

  it("liest die BET-Oberfläche exakt aus der Gruppenstruktur", () => {
    const m = parseGasSorptionFile(REP);
    const bet = allResults(m).find((r) => r.normalizedName === "bet_surface_area");
    expect(bet?.value).toBeCloseTo(264.7311, 4);
    expect(bet?.unit).toBe("m²/g");
    expect(bet?.confidence).toBe("high");
  });

  it("übernimmt Probenangaben und behandelt Analysebedingungen als Metadaten", () => {
    const m = parseGasSorptionFile(REP);
    expect(m.sampleInformation.sampleName).toBe("MRS-525");
    expect(m.sampleInformation.sampleMass).toBeCloseTo(0.1959, 4);
    const names = allResults(m).map((r) => r.sourceName.toLowerCase());
    expect(names.some((n) => n.includes("bath temp"))).toBe(false);
    expect(names.some((n) => n.includes("sample mass"))).toBe(false);
    expect(m.instrumentFamily).not.toMatch(/\\/);
  });
});
