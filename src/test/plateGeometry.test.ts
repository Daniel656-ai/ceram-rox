import { describe, it, expect } from "vitest";
import {
  computePlateGeometry,
  emptyPlateGeometryData,
  mean,
  parsePlateGeometryData,
  plateRowCount,
  PLATE_GEOMETRY_CALCULATIONS,
  PLATE_GEOMETRY_KIND,
  HONEYCOMB_GEOMETRY_KIND,
  type PlateGeometryData,
} from "@/lib/geometry/plate";
import { geometryKindsForServices, geometryKindForService } from "@/lib/geometry/kinds";
import { DEFAULT_REACTOR_GEOMETRY } from "@/lib/geometry/calculations";

const base = (over: Partial<PlateGeometryData> = {}): PlateGeometryData => ({
  ...emptyPlateGeometryData(),
  plattenlaenge: 500,
  breite_1x_sicke: 10,
  breite_2x_sicke: 20,
  plattenanzahl: 3,
  stk_doppelsicke: 1,
  stk_einzelsicke: 2,
  thickness: [
    { messwert_1: 0.5, messwert_2: 0.6 },
    { messwert_1: 0.4, messwert_2: null },
    { messwert_1: null, messwert_2: null },
  ],
  weights: [
    { gewicht: 100, breite_1: 30, breite_2: 30 },
    { gewicht: 110, breite_1: 30, breite_2: null },
    { gewicht: null, breite_1: null, breite_2: null },
  ],
  ...over,
});

describe("Plattengeometrie – Mittelwerte", () => {
  it("ignoriert fehlende Werte und wertet sie nie als 0", () => {
    expect(mean([1, null, 3])).toBe(2);
    expect(mean([null, undefined])).toBeNull();
    const r = computePlateGeometry(base(), DEFAULT_REACTOR_GEOMETRY);
    expect(r.mittelwerte.dicke).toBeCloseTo((0.5 + 0.6 + 0.4) / 3, 9);
    expect(r.mittelwerte.gewicht).toBeCloseTo(105, 9);
    expect(r.mittelwerte.breite).toBeCloseTo(30, 9);
  });
});

describe("Plattengeometrie – berechnete Größen", () => {
  it("berechnet Modulbreite, Oberfläche, Ap und ε aus den zentralen Definitionen", () => {
    const r = computePlateGeometry(base(), DEFAULT_REACTOR_GEOMETRY);
    expect(r.berechnet.modulbreite).toBeCloseTo(2 * 10 + 1 * 20, 9);
    const oberflaeche = (2 * 500 * 30 * 3) / 1_000_000;
    expect(r.berechnet.oberflaeche).toBeCloseTo(oberflaeche, 9);
    const modulvolumen = (30 * 30 * 500) / 1_000_000_000;
    expect(r.berechnet.modulvolumen).toBeCloseTo(modulvolumen, 12);
    expect(r.berechnet.ap).toBeCloseTo(oberflaeche / modulvolumen, 6);
    const dicke = (0.5 + 0.6 + 0.4) / 3;
    const plattenvolumen = (500 * 30 * dicke * 3) / 1_000_000_000;
    expect(r.berechnet.epsilon).toBeCloseTo((1 - plattenvolumen / modulvolumen) * 100, 6);
  });

  it("liefert null plus Hinweis, wenn Eingaben fehlen – niemals 0", () => {
    const r = computePlateGeometry(emptyPlateGeometryData(), DEFAULT_REACTOR_GEOMETRY);
    expect(r.berechnet.ap).toBeNull();
    expect(r.berechnet.epsilon).toBeNull();
    expect(r.hints.join(" ")).toContain("kann nicht berechnet werden");
  });

  it("führt jede Definition mit Einheit und Nachkommastellen", () => {
    for (const c of PLATE_GEOMETRY_CALCULATIONS) {
      expect(c.unit.length).toBeGreaterThan(0);
      expect(c.inputs.length).toBeGreaterThan(0);
      expect(typeof c.decimals).toBe("number");
    }
  });
});

describe("Plattengeometrie – Zeilenanzahl", () => {
  it("richtet sich nach der Plattenanzahl und ist nicht fest verdrahtet", () => {
    expect(plateRowCount(base({ plattenanzahl: 7, thickness: [], weights: [] }))).toBe(7);
    expect(plateRowCount(base({ plattenanzahl: 1 }))).toBe(3); // erfasste Zeilen gehen nie verloren
    expect(plateRowCount(emptyPlateGeometryData())).toBe(0);
  });

  it("liest gespeicherte Daten robust wieder ein", () => {
    const parsed = parsePlateGeometryData(JSON.parse(JSON.stringify(base())));
    expect(parsed.plattenlaenge).toBe(500);
    expect(parsed.thickness).toHaveLength(3);
    expect(parsed.weights[0].gewicht).toBe(100);
  });
});

describe("Geometrieart je Dienstleistung", () => {
  it("ordnet BENCH NOx und BENCH SOx der Plattengeometrie zu", () => {
    expect(geometryKindForService("BENCH NOx")).toBe(PLATE_GEOMETRY_KIND);
    expect(geometryKindForService("BENCH SOx")).toBe(PLATE_GEOMETRY_KIND);
    expect(geometryKindForService("NOX-Messung")).toBeNull();
  });

  it("nur NOx → nur Wabenkörper", () => {
    expect(geometryKindsForServices(["NOX-Messung", "Geometrievermessung"])).toEqual([
      HONEYCOMB_GEOMETRY_KIND,
    ]);
  });

  it("nur BENCH NOx bzw. nur BENCH SOx → nur Plattengeometrie", () => {
    expect(geometryKindsForServices(["BENCH NOx", "Geometrievermessung"])).toEqual([PLATE_GEOMETRY_KIND]);
    expect(geometryKindsForServices(["BENCH SOx", "Geometrievermessung"])).toEqual([PLATE_GEOMETRY_KIND]);
  });

  it("BENCH NOx + BENCH SOx → genau eine gemeinsame Plattengeometrie", () => {
    const kinds = geometryKindsForServices(["BENCH NOx", "BENCH SOx", "Geometrievermessung"]);
    expect(kinds).toEqual([PLATE_GEOMETRY_KIND]);
    expect(kinds.filter((k) => k === PLATE_GEOMETRY_KIND)).toHaveLength(1);
  });

  it("NOx + BENCH NOx (+ BENCH SOx) → beide Geometriearten getrennt", () => {
    expect(geometryKindsForServices(["NOX-Messung", "BENCH NOx", "Geometrievermessung"])).toEqual([
      HONEYCOMB_GEOMETRY_KIND,
      PLATE_GEOMETRY_KIND,
    ]);
    expect(
      geometryKindsForServices(["NOX-Messung", "BENCH NOx", "BENCH SOx", "Geometrievermessung"]),
    ).toEqual([HONEYCOMB_GEOMETRY_KIND, PLATE_GEOMETRY_KIND]);
  });
});
