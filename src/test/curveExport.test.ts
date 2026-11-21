import { describe, expect, it } from "vitest";
import { evaluationCsv, rawDataCsv } from "@/lib/curves/export";
import type { CurveEvaluationRecord } from "@/lib/api/measurementRawData";

/** Ergänzt curveEvaluationPoints.test.ts und curveZoom.test.ts (Normalfall, Zeilenzahl). */

const rec = (over: Partial<CurveEvaluationRecord> = {}): CurveEvaluationRecord => ({
  id: "r1", dataset_id: "d1", measurement_result_id: null, kind: "point", x_at: 850,
  group_id: "g1", comment: null, include_in_report: true, x_label: "Temp.", y_label: "dL/Lo",
  revision: 1, updated_by: null, updated_at: "2026-01-02T10:00:00Z",
  method: "value_at_x", method_label: "Wert an definierter Stelle",
  x_channel: "temp", x_unit: "°C", y_channel: "dl_lo", y_unit: "%",
  x_from: 100, x_to: 900, value: 1.23, unit: "%", formula: "", details: [],
  result_label: null, created_by: null, created_at: "2026-01-01T10:00:00Z",
  ...over,
});

/** Datenzeile (ohne Kopf- und Metazeilen) als Spaltenliste. */
const dataCells = (csv: string, line = 1) => csv.split("\n")[line].split(";");

describe("Rohdaten-CSV", () => {
  it("schreibt Metaangaben als Kommentarzeilen vor den Kopf und lässt leere Angaben weg", () => {
    const csv = rawDataCsv(
      { channels: [{ key: "t", label: "Zeit", unit: null }], rows: [[1]] },
      { Probe: "P-1", Gerät: null, Bemerkung: "", Datei: "a;b.txt" },
    );
    expect(csv.split("\n")).toEqual(["# Probe;P-1", '# Datei;"a;b.txt"', "Zeit", "1"]);
  });

  it("lässt ungültige oder fehlende Messwerte leer und schreibt nie 0", () => {
    const csv = rawDataCsv({
      channels: [{ key: "a", label: "A", unit: null }, { key: "b", label: "B", unit: null }, { key: "c", label: "C", unit: null }],
      rows: [[NaN, Infinity, -0.5], [0]],
    });
    expect(csv.split("\n").slice(1)).toEqual([";;-0,5", "0;;"]);
  });

  it("setzt Überschriften mit Semikolon oder Anführungszeichen in Anführungszeichen", () => {
    const csv = rawDataCsv({ channels: [{ key: "a", label: 'Masse "roh"; netto', unit: "mg" }], rows: [] });
    expect(csv).toBe('"Masse ""roh""; netto [mg]"');
  });
});

describe("Auswertungs-CSV", () => {
  it("verwendet bei Punktauswertungen die X-Stelle und bei Bereichsauswertungen den Bereichsbeginn", () => {
    const csv = evaluationCsv([rec({ kind: "point", x_at: 850.5 }), rec({ kind: "range", x_at: null, x_from: 100.25 })]);
    expect(dataCells(csv, 1)[3]).toBe("850,5");
    expect(dataCells(csv, 2)[3]).toBe("100,25");
  });

  it("fällt bei fehlenden Bezeichnungen auf die technischen Schlüssel zurück und lässt fehlende Werte leer", () => {
    const csv = evaluationCsv([
      rec({ method_label: null, y_label: null, x_label: null, x_unit: null, unit: null, value: null, comment: null, include_in_report: false }),
    ]);
    expect(dataCells(csv).slice(0, 9)).toEqual(["value_at_x", "dl_lo", "temp", "850", "", "", "", "", "nein"]);
  });

  it("schreibt Kommentare mit Semikolon in Anführungszeichen und markiert Berichtsübernahme mit „ja“", () => {
    const csv = evaluationCsv([rec({ comment: "Peak; unsicher", include_in_report: true })]);
    const line = csv.split("\n")[1];
    expect(line).toContain(';"Peak; unsicher";ja;');
  });

  it("nimmt als Änderungsdatum das Erstelldatum, wenn noch keine Änderung gespeichert ist", () => {
    const created = "2026-01-01T10:00:00Z";
    const csv = evaluationCsv([rec({ created_at: created, updated_at: null as unknown as string })]);
    const cells = csv.split("\n")[1].split(";");
    const expected = new Date(created).toLocaleString("de-AT");
    expect(cells.slice(-2)).toEqual([expected, expected]);
  });

  it("schreibt Metaangaben vor die Kopfzeile und ohne Auswertungen nur die Kopfzeile", () => {
    const csv = evaluationCsv([], { Messung: "M-1", Leer: undefined });
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("# Messung;M-1");
    expect(lines[1].split(";")[0]).toBe("Auswertungsmethode");
  });
});
