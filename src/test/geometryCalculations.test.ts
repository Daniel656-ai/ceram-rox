import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { allResults } from "@/lib/instrumentImport";
import { parseGeometryMeasurement } from "@/lib/instrumentImport/geometry";
import {
  GEOMETRY_CALCULATIONS,
  evaluateGeometryCalculation,
  computeGeometryDesign,
  recommendCellDensity,
  reactorCrossSectionMm2,
  DEFAULT_REACTOR_GEOMETRY,
  type CellDensityOption,
} from "@/lib/geometry/calculations";
import {
  activeCellDensities,
  reactorGeometryFor,
  CELL_DENSITY_LIST_KEY,
  REACTOR_LIST_KEY,
} from "@/lib/geometry/masterData";

const cat = (list_key: string, items: any[]): any => ({
  list: { id: list_key, list_key, display_name: list_key },
  attributes: [],
  items: items.map((i, idx) => ({ is_active: true, archived_at: null, sort_order: idx, ...i })),
});

const densities: CellDensityOption[] = [400, 500, 600, 800].map((z) => ({
  key: String(z), label: String(z), zellenzahl: z,
}));

describe("Test A – Geometrievermessung bleibt Grundlage", () => {
  it("liefert D, ti, to, d als Mittelwerte in Formularreihenfolge", () => {
    const buf = readFileSync(resolve(__dirname, "fixtures/geometry/geometrie.csv"));
    const m = parseGeometryMeasurement({
      name: "geometrie.csv",
      buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    });
    const means = allResults(m).filter((r) => r.analysis === "GEOMETRY_MEAN");
    expect(means.map((r) => r.sourceName).sort()).toEqual(["D", "d", "ti", "to"]);
    expect(means.every((r) => r.unit === "mm")).toBe(true);
  });
});

describe("Test B/C – AP und ε", () => {
  const base = { d: 1.75, t: 0.24, zellenzahl: 62 };
  it("berechnet AP nach der vorgegebenen Formel", () => {
    const r = evaluateGeometryCalculation("ap", base);
    const expected = (4 * 1.75 * 62 * 62 * 1000) / Math.pow(62 * 1.75 + 63 * 0.24, 2);
    expect(r.value).toBeCloseTo(expected, 6);
    expect(r.unit).toBe("m²/m³");
  });
  it("berechnet ε aus AP und d", () => {
    const ap = evaluateGeometryCalculation("ap", base).value!;
    const r = evaluateGeometryCalculation("epsilon", { ...base, ap });
    expect(r.value).toBeCloseTo((ap * 1.75) / 4 / 10, 9);
    expect(r.unit).toBe("%");
  });
});

describe("Test D/E/F – Modusabhängige Berechnung", () => {
  const geo = { d: 1.75, t: 0.24, zellenzahl_ist: 62 };

  it("Test D – AV vorgegeben ergibt die Bauteillänge", () => {
    const r = computeGeometryDesign({ ...geo, av_soll: 41.38 });
    expect(r.mode).toBe("av_vorgegeben");
    const expected = (1.8 / (41.38 * 62 * (1.75 / 1000) * 4)) * 1000;
    expect(r.berechnet.laenge).toBeCloseTo(expected, 6);
    expect(r.soll.av).toBe(41.38);
    expect(r.berechnet.av).toBeNull(); // Vorgabe wird nicht als „berechnet“ ausgegeben
  });

  it("Test E – FR vorgegeben ergibt AV über die innere Fläche", () => {
    const r = computeGeometryDesign({ ...geo, fr_soll: 1.44, laenge_ist: 61 });
    expect(r.mode).toBe("fr_vorgegeben");
    const flaeche = 4 * 62 * (1.75 / 1000) * (61 / 1000);
    expect(r.berechnet.innere_flaeche).toBeCloseTo(flaeche, 9);
    expect(r.berechnet.av).toBeCloseTo(1.44 / flaeche, 6);
  });

  it("Test F – SV = AV × AP", () => {
    const r = computeGeometryDesign({ ...geo, av_soll: 41.38 });
    expect(r.berechnet.sv).toBeCloseTo(41.38 * r.berechnet.ap!, 6);
  });

  it("SV vorgegeben ergibt AV = SV / AP", () => {
    const ap = evaluateGeometryCalculation("ap", { d: 1.75, t: 0.24, zellenzahl: 62 }).value!;
    const r = computeGeometryDesign({ ...geo, sv_soll: 20000 });
    expect(r.mode).toBe("sv_vorgegeben");
    expect(r.berechnet.av).toBeCloseTo(20000 / ap, 6);
  });
});

describe("Test G/H – Zelligkeitsauswahl aus Stammdaten", () => {
  it("Test G – rechnet alle Stammdaten durch und wählt die passendste", () => {
    const rec = recommendCellDensity(
      { d: 1.75, t: 0.24, av_soll: 41.38, laenge_soll: 61 },
      densities
    );
    expect(rec.candidates).toHaveLength(4);
    expect(densities.map((x) => x.zellenzahl)).toContain(rec.best!.option.zellenzahl);
    expect(rec.best!.deviationPercent).not.toBeNull();
    // Nie eine frei berechnete Zellenzahl
    expect(rec.candidates.every((c) => densities.some((d) => d.zellenzahl === c.option.zellenzahl))).toBe(true);
  });

  it("Test H – ohne exakte Übereinstimmung wird die Abweichung ausgewiesen", () => {
    const rec = recommendCellDensity(
      { d: 1.75, t: 0.24, av_soll: 41.38, laenge_soll: 61, tolerancePercent: 0.0001 },
      densities
    );
    expect(rec.withinTolerance).toBe(false);
    expect(rec.message).toContain("außerhalb Toleranz");
    expect(rec.best!.av).not.toBeNull();
    expect(Math.abs(rec.best!.deviationPercent!)).toBeGreaterThan(0);
  });

  it("liefert eine Meldung, wenn keine Zelligkeiten gepflegt sind", () => {
    const rec = recommendCellDensity({ d: 1.75, t: 0.24, av_soll: 41.38 }, []);
    expect(rec.best).toBeNull();
    expect(rec.message).toContain("Stammdaten");
  });
});

describe("Test I – Ist und Empfehlung bleiben getrennt", () => {
  it("verändert die gemessene Zelligkeit nicht", () => {
    const design = computeGeometryDesign({ d: 1.75, t: 0.24, zellenzahl_ist: 400, av_soll: 41.38 });
    const rec = recommendCellDensity(
      { d: 1.75, t: 0.24, av_soll: 41.38, laenge_soll: 61 },
      densities
    );
    expect(design.ist.zellenzahl).toBe(400);
    expect(rec.best!.option.zellenzahl).toBeTypeOf("number");
    expect(design.ist.zellenzahl).toBe(400); // durch die Empfehlung unverändert
  });
});

describe("Test J – Reaktorgeometrie als Konfiguration", () => {
  const catalog = [
    cat(REACTOR_LIST_KEY, [
      { item_value: "standard", label: "Standard Aktivität", metadata: { breite_mm: 30, hoehe_mm: 30 } },
      { item_value: "sox", label: "SOx", metadata: { breite_mm: 35, hoehe_mm: 35 } },
    ]),
    cat(CELL_DENSITY_LIST_KEY, [
      { item_value: "400", label: "400", metadata: { zellenzahl: 400 } },
      { item_value: "500", label: "500", metadata: { zellenzahl: 500 }, is_active: false },
    ]),
  ];

  it("liefert Standard 3 × 3 cm und ist für SOx vorbereitet", () => {
    expect(reactorGeometryFor(catalog, "standard")).toMatchObject({ widthMm: 30, heightMm: 30 });
    expect(reactorGeometryFor(catalog, "sox")).toMatchObject({ widthMm: 35, heightMm: 35 });
    expect(reactorCrossSectionMm2(DEFAULT_REACTOR_GEOMETRY)).toBe(900);
  });

  it("berücksichtigt nur aktive Zelligkeiten aus den Stammdaten", () => {
    expect(activeCellDensities(catalog).map((c) => c.zellenzahl)).toEqual([400]);
  });
});

describe("Test K – keine Berechnung bei fehlenden Werten", () => {
  it("setzt niemals 0 ein und nennt die fehlende Eingabe", () => {
    const r = evaluateGeometryCalculation("laenge_berechnet", { zellenzahl: 62, d: 1.75 });
    expect(r.value).toBeNull();
    expect(r.missing).toContain("av_soll");
    const design = computeGeometryDesign({ d: null, t: null, zellenzahl_ist: null, av_soll: 41.38 });
    expect(design.berechnet.ap).toBeNull();
    expect(design.berechnet.laenge).toBeNull();
    expect(design.hints.join(" ")).toContain("kann nicht berechnet werden");
  });
});

describe("Test L – widersprüchliche Vorgaben", () => {
  it("meldet den Konflikt und verändert keine Vorgabe", () => {
    const r = computeGeometryDesign({
      d: 1.75, t: 0.24, zellenzahl_ist: 62,
      av_soll: 41.38, laenge_soll: 200, sv_soll: 100, fr_soll: 99,
    });
    expect(r.conflicts[0]).toContain("nicht gleichzeitig erfüllbar");
    expect(r.soll).toEqual({ av: 41.38, sv: 100, fr: 99, laenge: 200 });
  });

  it("meldet keinen Konflikt bei stimmigen Vorgaben", () => {
    const laenge = (1.8 / (41.38 * 62 * (1.75 / 1000) * 4)) * 1000;
    const r = computeGeometryDesign({
      d: 1.75, t: 0.24, zellenzahl_ist: 62, av_soll: 41.38, laenge_soll: laenge,
    });
    expect(r.conflicts).toEqual([]);
  });
});

describe("Zentrale Definitionen", () => {
  it("führt jede Formel mit Einheit und Nachkommastellen", () => {
    for (const c of GEOMETRY_CALCULATIONS) {
      expect(c.unit.length).toBeGreaterThan(0);
      expect(c.inputs.length).toBeGreaterThan(0);
      expect(typeof c.decimals).toBe("number");
    }
  });
});
