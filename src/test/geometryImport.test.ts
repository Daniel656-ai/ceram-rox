import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectImporter, allResults } from "@/lib/instrumentImport";
import { parseGeometryMeasurement, parseElementName, GEOMETRY_IMPORTER_ID } from "@/lib/instrumentImport/geometry";

const load = () => {
  const buf = readFileSync(resolve(__dirname, "fixtures/geometry/geometrie.csv"));
  return { name: "geometrie.csv", buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
};

const mean = (name: string) =>
  allResults(parseGeometryMeasurement(load())).find((r) => r.sourceName === name && r.analysis === "GEOMETRY_MEAN");

describe("Geometrievermessung – Import", () => {
  it("wird automatisch erkannt", () => {
    expect(detectImporter(load())?.id).toBe(GEOMETRY_IMPORTER_ID);
  });

  it("erkennt Messart, Nummer und Zusatz dynamisch", () => {
    expect(parseElementName("D2")).toEqual({ group: "D", index: 2, qualifier: null });
    expect(parseElementName("ti1 Außen")).toEqual({ group: "ti", index: 1, qualifier: "Außen" });
    expect(parseElementName("d3 Innen")).toEqual({ group: "d", index: 3, qualifier: "Innen" });
  });

  it("bildet die erwarteten Mittelwerte", () => {
    expect(mean("D")?.value).toBeCloseTo(151.04, 6);
    expect(mean("to")?.value).toBeCloseTo(0.658, 6);
    expect(mean("ti")?.value).toBeCloseTo(0.242, 6);
    expect(mean("d")?.value).toBeCloseTo(1.751875, 6);
  });

  it("ignoriert fehlende Messwerte, wertet sie nie als 0", () => {
    const d = mean("D")!;
    expect(d.value).toBe(151.04);
    expect(mean("x")).toBeUndefined(); // "Fehler" und "---" ergeben keinen Wert
  });

  it("trennt D und d", () => {
    expect(mean("D")?.value).not.toBeCloseTo(mean("d")!.value as number, 3);
  });

  it("übernimmt die Einheit als eigenes Attribut", () => {
    for (const n of ["D", "to", "ti", "d"]) {
      expect(mean(n)?.unit).toBe("mm");
      expect(mean(n)?.sourceName).not.toContain("mm");
    }
  });

  it("erhält die Einzelmesswerte", () => {
    const singles = allResults(parseGeometryMeasurement(load())).filter((r) => r.analysis === "GEOMETRY_SINGLE");
    expect(singles.map((s) => s.sourceName)).toContain("ti5 Außen");
    expect(singles.find((s) => s.sourceName === "D2")?.value).toBe(151.04);
    expect(singles.find((s) => s.sourceName === "D1")).toBeUndefined();
  });

  it("dokumentiert die Nachvollziehbarkeit der Mittelwertbildung", () => {
    const m = parseGeometryMeasurement(load());
    expect(m.headerMap?.["Mittelwert D"]).toContain("gültige Werte: 1");
    expect(m.headerMap?.["Mittelwert D"]).toContain("nicht erkannte Werte: 1");
    expect(m.headerMap?.["Mittelwert ti"]).toContain("gültige Werte: 8");
  });
});
