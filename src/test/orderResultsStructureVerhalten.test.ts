import { describe, expect, it } from "vitest";
import {
  buildComparison,
  buildOrderResultStructure,
  groupByResultGroup,
  type AnalysisEntry,
} from "@/lib/orderResultsStructure";
import type { RawMeasurementRow, RawResultRow } from "@/lib/orderResultsAggregation";

/** Ergänzt resultSchema.test.ts (Gruppierung, Vergleichskennwerte im Normalfall). */

type Res = RawResultRow & { measured_at?: string | null };
const res = (label: string, value: RawResultRow["value"], over: Partial<Res> = {}): Res => ({
  id: `r-${label}-${String(value)}-${over.instance_key ?? ""}`,
  result_name: `form:f:${label.toLowerCase()}`,
  display_label: label,
  value,
  unit: null,
  is_official: true,
  ...over,
});

const meas = (id: string, sample: string | null, results: Res[], over: Partial<RawMeasurementRow> = {}) =>
  ({
    id,
    measurement_number: `M-${id}`,
    sample_id: sample,
    original_sample_id: null,
    service_id: "svc-rfa",
    status: "completed",
    measurement_services: { id: "svc-rfa", service_name: "RFA" },
    samples: sample ? { id: sample, sample_number: sample, sample_name: `Probe ${sample}` } : null,
    measurement_results: results,
    ...over,
  }) as RawMeasurementRow;

describe("Auftrags-Ergebnisstruktur Probe → Dienstleistung → Analyse", () => {
  it("übernimmt nur offizielle Ergebnisse und lässt Messungen ohne offizielle Werte ganz weg", () => {
    const groups = buildOrderResultStructure([
      meas("1", "P-1", [res("SiO2", 50), res("Intern", 1, { is_official: false })]),
      meas("2", "P-2", [res("SiO2", 51, { is_official: null })]),
    ]);
    expect(groups.map((g) => g.sampleNumber)).toEqual(["P-1"]);
    expect(groups[0].services[0].analyses[0].values.map((v) => v.label)).toEqual(["SiO2"]);
    expect(groups[0].analysisCount).toBe(1);
  });

  it("sortiert Proben nach Probennummer mit natürlicher Zahlenreihenfolge", () => {
    const groups = buildOrderResultStructure([
      meas("1", "P-10", [res("SiO2", 1)]),
      meas("2", "P-2", [res("SiO2", 2)]),
      meas("3", "P-1", [res("SiO2", 3)]),
    ]);
    expect(groups.map((g) => g.sampleNumber)).toEqual(["P-1", "P-2", "P-10"]);
  });

  it("hält Messungen ohne Probe als getrennte Einträge „Ohne Probe“", () => {
    const groups = buildOrderResultStructure([
      meas("1", null, [res("SiO2", 1)]),
      meas("2", null, [res("SiO2", 2)]),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.sampleName === "Ohne Probe" && g.sampleNumber === "–" && g.sampleId === null)).toBe(true);
  });

  it("trennt mehrere Dienstleistungen derselben Probe und nummeriert Analysen je Dienstleistung", () => {
    const bet = { service_id: "svc-bet", measurement_services: { id: "svc-bet", service_name: "BET" } };
    const [probe] = buildOrderResultStructure([
      meas("1", "P-1", [res("SiO2", 1)]),
      meas("2", "P-1", [res("BET", 10)], bet),
      meas("3", "P-1", [res("SiO2", 2)]),
    ]);
    expect(probe.services.map((s) => [s.serviceName, s.analyses.map((a) => a.label)])).toEqual([
      ["RFA", ["RFA – Analyse 1", "RFA – Analyse 2"]],
      ["BET", ["BET – Analyse 1"]],
    ]);
    expect(probe.analysisCount).toBe(3);
  });

  it("erzeugt je Messung eines Messdatenblocks eine eigene Analyse mit Bezeichnung und Kontext", () => {
    const [probe] = buildOrderResultStructure([
      meas("1", "P-1", [
        res("SiO2", 50, { instance_key: "m1", instance_label: "Kalibriert", instance_context: { praep: "gemahlen", art: "Schmelze" } }),
        res("Al2O3", 10, { instance_key: "m1", instance_label: null }),
        res("SiO2", 52, { instance_key: "m2", instance_label: null }),
      ]),
    ]);
    const analyses = probe.services[0].analyses;
    expect(analyses.map((a) => a.label)).toEqual(["RFA – Kalibriert (gemahlen · Schmelze)", "RFA – Messung"]);
    expect(analyses.map((a) => a.values.map((v) => v.value))).toEqual([[50, 10], [52]]);
    expect(analyses.map((a) => a.index)).toEqual([1, 2]);
  });

  it("liest Zahlen mit Dezimalkomma und Leerzeichen, behält Text und lässt Leerwerte ohne Text", () => {
    const [probe] = buildOrderResultStructure([
      meas("1", "P-1", [res("A", "1 234,5"), res("B", "<0,01"), res("C", ""), res("D", null)]),
    ]);
    expect(probe.services[0].analyses[0].values.map((v) => [v.label, v.value, v.text])).toEqual([
      ["A", 1234.5, null],
      ["B", null, "<0,01"],
      ["C", null, null],
      ["D", null, null],
    ]);
  });

  it("übernimmt Messnummer, Status, Ergebnis-ID und das erste Messdatum der Analyse", () => {
    const [probe] = buildOrderResultStructure([
      meas("1", "P-1", [
        res("A", 1, { measured_at: null }),
        res("B", 2, { measured_at: "2026-03-01T10:00:00Z" }),
        res("C", 3, { measured_at: "2026-03-02T10:00:00Z" }),
      ], { status: "in_progress" }),
    ]);
    const analysis = probe.services[0].analyses[0];
    expect(analysis).toMatchObject({ measurementId: "1", measurementNumber: "M-1", status: "in_progress", date: "2026-03-01T10:00:00Z" });
    expect(analysis.values[0].resultId).toBe("r-A-1-");
  });

  it("kennzeichnet eine Ersatzprobe mit der ursprünglich vorgesehenen Probe", () => {
    const [probe] = buildOrderResultStructure([
      meas("1", "P-1", [res("A", 1)], {
        original_sample_id: "P-0",
        original_sample: { id: "P-0", sample_number: "P-0", sample_name: "Original" },
      }),
    ]);
    expect(probe).toMatchObject({ isReplacement: true, originalSampleNumber: "P-0" });
  });

  it("ordnet Werte nach der definierten Ergebnisstruktur und übernimmt deren Gruppe, unbekannte Werte ans Ende", () => {
    const columns = new Map([
      ["svc-rfa", [
        // Spaltenschlüssel in anderer Schreibweise als die Ergebnisbezeichnung:
        // die Zuordnung erfolgt über den kanonischen Parameterschlüssel.
        { key: "Al₂O₃ (%)", label: "Al2O3", unit: "%", group: "Hauptoxide" },
        { key: "SiO₂ [%]", label: "SiO2", unit: "%", group: "Hauptoxide" },
      ]],
    ]);
    const [probe] = buildOrderResultStructure(
      [meas("1", "P-1", [res("Glühverlust", 3), res("% SiO₂", 50), res("Al₂O₃", 10)])],
      columns,
    );
    const values = probe.services[0].analyses[0].values;
    expect(values.map((v) => [v.label, v.group])).toEqual([
      ["Al₂O₃", "Hauptoxide"],
      ["% SiO₂", "Hauptoxide"],
      ["Glühverlust", null],
    ]);
  });
});

describe("Vergleichstabelle über ausgewählte Analysen", () => {
  const analysis = (index: number, values: AnalysisEntry["values"]): AnalysisEntry => ({
    measurementId: `m${index}`,
    measurementNumber: `M-${index}`,
    serviceId: "svc",
    serviceName: "RFA",
    index,
    label: `RFA – Analyse ${index}`,
    status: null,
    date: null,
    values,
  });
  const v = (key: string, value: number | null, over: Partial<AnalysisEntry["values"][number]> = {}) => ({
    resultId: `r-${key}-${value}`, key, label: key, unit: null, group: null, value, text: null, ...over,
  });

  it("führt jeden Parameter als Zeile mit einer Zelle je Analyse, fehlende Werte als leere Zelle", () => {
    const rows = buildComparison([
      analysis(1, [v("SiO2", 50), v("Al2O3", 10)]),
      analysis(2, [v("SiO2", 54)]),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["SiO2", "Al2O3"]);
    expect(rows[1].cells).toEqual([{ value: 10, text: null }, { value: null, text: null }]);
  });

  it("berechnet Kennwerte nur aus Zahlenwerten, Text zählt nicht mit", () => {
    const [row] = buildComparison([
      analysis(1, [v("SiO2", 50)]),
      analysis(2, [v("SiO2", null, { text: "n. b." })]),
      analysis(3, [v("SiO2", 54)]),
    ]);
    expect(row).toMatchObject({ mean: 52, min: 50, max: 54 });
    expect(row.sd).toBeCloseTo(Math.sqrt(8), 10);
    expect(row.cells[1]).toEqual({ value: null, text: "n. b." });
  });

  it("liefert leere Kennwerte, wenn ein Parameter keinen Zahlenwert hat", () => {
    const [row] = buildComparison([analysis(1, [v("Farbe", null, { text: "rot" })])]);
    expect(row).toMatchObject({ mean: null, min: null, max: null, sd: null });
  });

  it("übernimmt die Einheit aus einer späteren Analyse, wenn sie zuerst fehlt", () => {
    const [row] = buildComparison([
      analysis(1, [v("SiO2", 50)]),
      analysis(2, [v("SiO2", 52, { unit: "%" })]),
    ]);
    expect(row.unit).toBe("%");
  });
});

describe("Gruppierung von Ergebniszeilen nach fachlicher Gruppe", () => {
  it("fasst Zeilen ohne Gruppe unter „Ergebnisse“ zusammen und behält die Reihenfolge des ersten Auftretens", () => {
    const groups = groupByResultGroup([
      { id: 1, group: "Hauptoxide" },
      { id: 2, group: null },
      { id: 3, group: "Hauptoxide" },
      { id: 4, group: "" },
    ]);
    expect(groups.map((g) => [g.name, g.rows.map((r) => r.id)])).toEqual([
      ["Hauptoxide", [1, 3]],
      ["Ergebnisse", [2, 4]],
    ]);
  });
});
