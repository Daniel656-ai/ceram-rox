import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectImporter, allResults, mapImportedResults } from "@/lib/instrumentImport";
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

describe("Geometrievermessung – Zuordnung ist case-sensitive", () => {
  const targets = [
    { field_key: "D", display_name: "D", unit: "mm" },
    { field_key: "d", display_name: "d", unit: "mm" },
    { field_key: "to", display_name: "to", unit: "mm" },
    { field_key: "ti", display_name: "ti", unit: "mm" },
  ];
  const res = (name: string, value: number) => ({
    sourceName: name,
    normalizedName: `geom_${name}`,
    aliases: [name],
    value,
    unit: "mm",
    confidence: "high" as const,
    analysis: "GEOMETRY_MEAN" as const,
  });
  const map = (rs: ReturnType<typeof res>[]) =>
    Object.fromEntries(
      mapImportedResults(rs, null, targets).map((r) => [r.sourceName, [r.targetFieldKey, r.value]])
    );

  it("Test A/B – D und d bleiben getrennt", () => {
    expect(map([res("D", 25.42), res("d", 24.87)])).toEqual({
      D: ["D", 25.42],
      d: ["d", 24.87],
    });
    expect(map([res("D", 30), res("d", 28)])).toEqual({ D: ["D", 30], d: ["d", 28] });
  });

  it("Test C/D – einzelner Wert wird nur seinem Feld zugeordnet", () => {
    expect(map([res("D", 25.42)])).toEqual({ D: ["D", 25.42] });
    expect(map([res("d", 24.87)])).toEqual({ d: ["d", 24.87] });
  });

  it("to/ti werden exakt zugeordnet", () => {
    expect(map([res("to", 10.02), res("ti", 8.74)])).toEqual({
      to: ["to", 10.02],
      ti: ["ti", 8.74],
    });
  });

  it("Test E – Trennung bleibt über mehrere Messungen erhalten", () => {
    const rows = mapImportedResults(
      [res("D", 25.4), res("d", 24.8), res("D", 25.5), res("d", 24.9)],
      null,
      targets
    );
    expect(rows.filter((r) => r.targetFieldKey === "D").map((r) => r.value)).toEqual([25.4, 25.5]);
    expect(rows.filter((r) => r.targetFieldKey === "d").map((r) => r.value)).toEqual([24.8, 24.9]);
  });

  it("ordnet bei mehrdeutiger Schreibweise nicht automatisch zu", () => {
    const rows = mapImportedResults([res("D", 25.42), res("d", 24.87)], null, [
      { field_key: "durchmesser", display_name: "D", unit: "mm" },
    ]);
    expect(rows.find((r) => r.sourceName === "d")?.targetFieldKey).toBeNull();
    expect(rows.find((r) => r.sourceName === "D")?.targetFieldKey).toBe("durchmesser");
  });
});

describe("Geometrievermessung – Nachkommastellen und Reihenfolge", () => {
  // Formularreihenfolge (sort_order): D, ti, to, d – bewusst nicht alphabetisch.
  const targets = [
    { field_key: "D", display_name: "D", unit: "mm", decimal_places: 4 },
    { field_key: "ti", display_name: "ti", unit: "mm", decimal_places: 4 },
    { field_key: "to", display_name: "to", unit: "mm", decimal_places: 4 },
    { field_key: "d", display_name: "d", unit: "mm", decimal_places: 4 },
  ];
  const res = (name: string, value: number) => ({
    sourceName: name,
    normalizedName: `geom_${name}`,
    aliases: [name],
    value,
    unit: "mm",
    confidence: "high" as const,
    analysis: "GEOMETRY_MEAN" as const,
  });

  it("Test 1 – rundet auf die im Ergebnisfeld hinterlegten 4 Nachkommastellen", () => {
    const rows = mapImportedResults([res("D", 25.12345678)], null, targets);
    expect(rows[0].value).toBe(25.1235);
    expect(mapImportedResults([res("D", 25.42364)], null, targets)[0].value).toBe(25.4236);
    expect(mapImportedResults([res("D", 25.42365)], null, targets)[0].value).toBe(25.4237);
  });

  it("Test 2/5 – gibt die Ergebnisse in Formularreihenfolge D → ti → to → d aus", () => {
    const rows = mapImportedResults(
      [res("d", 24.8765), res("to", 15.9877), res("D", 25.4236), res("ti", 10.1235)],
      null,
      targets
    );
    expect(rows.map((r) => r.targetFieldKey)).toEqual(["D", "ti", "to", "d"]);
  });

  it("Test 5 – folgt einer geänderten Formularreihenfolge", () => {
    const reordered = [targets[2], targets[0], targets[3], targets[1]];
    const rows = mapImportedResults([res("D", 1), res("ti", 2), res("to", 3), res("d", 4)], null, reordered);
    expect(rows.map((r) => r.targetFieldKey)).toEqual(["to", "D", "d", "ti"]);
  });

  it("Test 3 – D und d bleiben auch mit Rundung getrennt", () => {
    const rows = mapImportedResults([res("D", 25.4), res("d", 24.9)], null, targets);
    expect(rows.map((r) => [r.targetFieldKey, r.value])).toEqual([["D", 25.4], ["d", 24.9]]);
  });

  it("Test 4 – Mittelwerte werden gerundet ausgegeben", () => {
    const mean = (a: number, b: number) => (a + b) / 2;
    const rows = mapImportedResults(
      [res("D", mean(25.4235, 25.4237)), res("d", mean(24.8765, 24.8767))],
      null,
      targets
    );
    expect(rows.map((r) => r.value)).toEqual([25.4236, 24.8766]);
  });

  it("Test 8 – fehlende Messwerte werden nicht ergänzt", () => {
    const rows = mapImportedResults([res("D", 25.4235)], null, targets);
    expect(rows).toHaveLength(1);
    expect(rows[0].targetFieldKey).toBe("D");
  });

  it("ändert die Reihenfolge anderer Importprofile nicht", () => {
    const other = (name: string) => ({
      sourceName: name,
      normalizedName: name.toLowerCase(),
      aliases: [name],
      value: 1.23456789,
      unit: "%",
      confidence: "high" as const,
      analysis: "BET" as const,
    });
    const t = [
      { field_key: "b", display_name: "b", unit: "%", decimal_places: 2 },
      { field_key: "a", display_name: "a", unit: "%", decimal_places: 2 },
    ];
    const rows = mapImportedResults([other("a"), other("b")], null, t);
    expect(rows.map((r) => r.sourceName)).toEqual(["a", "b"]);
    expect(rows[0].value).toBe(1.23456789);
  });
});
