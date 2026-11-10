import { describe, it, expect } from "vitest";
import { buildOrderRunSheet, orderDmcPayload, runSheetFileName, runSheetOrderLabel } from "./buildOrderRunSheet";
import { specValueHtml } from "./specHtml";
import { specValueShape, specTableCols, isKnetungService } from "@/lib/specValues";

const p = (id: string, name: string, v: string | null, unit: string | null = null) =>
  ({ id, parameter_name: name, parameter_value: v, unit });
const baseOrder = (extra: any = {}) => ({
  id: "O1", order_number: "SW-260025", order_kind: "labor", customer_name: "Kunde",
  shared_form_data: { template: { form_definition_id: "F", values: {} } }, order_measurements: [], ...extra,
});
const noMat = new Map();

describe("Auftrags-Laufzettel", () => {
  it("Extrusion ohne Probe erscheint mit allen Vorgaben inkl. Tabellen", () => {
    const s = buildOrderRunSheet(baseOrder({ order_measurements: [{ id: "m1", order_id: "O1", samples: null,
      measurement_services: { service_name: "Extrusion" },
      measurement_parameters: [p("1", "Extruder", "ECT 80B"), p("2", "Brenntemperaturen", '[{"brenntemperatur":500,"anzahl":3}]')] }] }), [], []);
    expect(s.services[0].sampleNumber).toBeNull();
    expect(s.services[0].params).toHaveLength(2);
    const html = specValueHtml(s.services[0].params[1].raw, null, noMat);
    expect(html).toContain("<table");
    expect(html).toContain(">500<");
    expect(html).not.toContain("{");
  });
  it("mehrere Proben/Dienstleistungen; fremde Aufträge nicht", () => {
    const s = buildOrderRunSheet(baseOrder({ order_measurements: [
      { id: "m1", order_id: "O1", samples: { sample_number: "P1" }, measurement_parameters: [] },
      { id: "m2", order_id: "O1", samples: { sample_number: "P2" }, measurement_parameters: [] },
      { id: "m3", order_id: "OTHER", samples: { sample_number: "P9" }, measurement_parameters: [] },
    ] }), [], []);
    expect(s.services.map((x) => x.sampleNumber)).toEqual(["P1", "P2"]);
  });
  it("Formular: Reihenfolge, Bezeichnung, Einheit; unbekannte Schlüssel bleiben", () => {
    const s = buildOrderRunSheet(baseOrder({ shared_form_data: { template: { values: { fr: "1.2", af: "20", altkey: "x" } } } }), [
      { id: "a", field_key: "af", display_name: "AV", unit: "m/h" },
      { id: "b", field_key: "fr", display_name: "FR", unit: "m3/h" },
    ], []);
    expect(s.form.map((f) => [f.key, f.label, f.unit])).toEqual([["af", "AV", "m/h"], ["fr", "FR", "m3/h"], ["altkey", null, null]]);
  });
  it("leer → –, nie 0; 0 bleibt 0", () => {
    expect(specValueHtml(null, "°C", noMat)).toBe("–");
    expect(specValueHtml("", null, noMat)).toBe("–");
    expect(specValueHtml("0", "°C", noMat)).toBe("0 °C");
  });
  it("gleiche Angabe in Formular und Dienstleistung bleibt doppelt; Mehrfachparameter erhalten", () => {
    const s = buildOrderRunSheet(baseOrder({
      shared_form_data: { template: { values: { o2: "12" } } },
      order_measurements: [{ id: "m1", order_id: "O1", measurement_parameters: [p("1", "O2", "12"), p("2", "O2", "8")] }],
    }), [{ id: "x", field_key: "o2", display_name: "O2" }], []);
    expect(s.form).toHaveLength(1);
    expect(s.services[0].params.map((x) => x.raw)).toEqual(["12", "8"]);
  });
  it("Änderungsstand nur aus order_spec_updated dieses Auftrags", () => {
    const s = buildOrderRunSheet(baseOrder(), [], [
      { event_type: "order_spec_updated", order_id: "O1", created_at: "2026-10-02T00:00:00Z" },
      { event_type: "status_changed", order_id: "O1", created_at: "2026-10-09T00:00:00Z" },
    ]);
    expect(s.lastSpecChange).toBe("2026-10-02T00:00:00Z");
    expect(buildOrderRunSheet(baseOrder(), [], []).lastSpecChange).toBeNull();
  });
  it("Pilot Plant: angezeigte Nummer, technische Nummer zusätzlich; DMC-Inhalt", () => {
    const s = buildOrderRunSheet(baseOrder({ order_kind: "pilot_plant", pp_experiment_number: "TE0042" }), [], []);
    expect(s.number).toBe("TE0042");
    expect(s.technicalNumber).toBe("SW-260025");
    expect(orderDmcPayload(s.number)).toBe("ROX|A:TE0042");
    expect(orderDmcPayload("")).toBeNull();
  });
  it("Repeater-Spalten nutzen Unterfeld-Bezeichnungen", () => {
    const s = buildOrderRunSheet(baseOrder({ shared_form_data: { template: { values: { ms: [{ mundstucke: "293" }] } } } }), [
      { id: "r", field_key: "ms", display_name: "Mundstücke", field_type: "repeater" },
      { id: "c", field_key: "mundstucke", display_name: "Mundstück", parent_field_id: "r" },
    ], []);
    expect(specValueHtml(s.form[0].raw, null, noMat, s.form[0].colLabels)).toContain(">Mundstück<");
  });
  it("gemeinsame Formatierung: Tabellen-/Listen-/Einzelform wie bisher", () => {
    expect(specValueShape('[{"__id":"x","a":1}]')).toEqual({ kind: "table", cols: ["a"], rows: [{ __id: "x", a: 1 }] });
    expect(specValueShape(["a", "", "b"])).toEqual({ kind: "list", items: ["a", "b"] });
    expect(specValueShape("5")).toEqual({ kind: "single", value: "5" });
  });
  it("Erstellungsdatum wird aus created_at übernommen", () => {
    const s = buildOrderRunSheet(baseOrder({ created_at: "2026-03-04T09:30:00Z" }), [], []);
    expect(s.createdAt).toBe("2026-03-04T09:30:00Z");
    expect(buildOrderRunSheet(baseOrder(), [], []).createdAt).toBeNull();
  });
  it("PPP-Auswahllisten werden aus dem Formular herausgelöst, Werte lesbar", () => {
    const s = buildOrderRunSheet(baseOrder({ shared_form_data: { template: { values: {
      gewuenschte_pilot_plant_prozesse: ["Knetung", "Extrusion"],
      standardpruefungen_ppp: ["Feuchte"],
      analyse_ppp: ["Schwindung", "RFA"],
      bemerkung: "bleibt",
    } } } }), [
      { id: "1", field_key: "gewuenschte_pilot_plant_prozesse", display_name: "Gewünschte Pilot Plant Prozesse" },
      { id: "2", field_key: "standardpruefungen_ppp", display_name: "Standardprüfungen PPP" },
      { id: "3", field_key: "analyse_ppp", display_name: "Analyse PPP" },
      { id: "4", field_key: "bemerkung", display_name: "Bemerkung" },
    ], []);
    expect(s.pppSelections.map((x) => [x.id, x.label, x.values])).toEqual([
      ["prozesse", "Gewünschte Pilot Plant Prozesse", ["Knetung", "Extrusion"]],
      ["standard", "Standardprüfungen PPP", ["Feuchte"]],
      ["analyse", "Analyse PPP", ["Schwindung", "RFA"]],
    ]);
    expect(s.form.map((f) => f.key)).toEqual(["bemerkung"]);
  });
  it("Mundstückgruppen: echter MS-Wert statt Zeilenindex, führende Nullen bleiben", () => {
    const s = buildOrderRunSheet(baseOrder({ order_measurements: [{ id: "m1", order_id: "O1",
      measurement_services: { service_name: "Extrusion" },
      measurement_parameters: [p("r1", "repeat:r19l4e74", JSON.stringify([
        { __id: "a", mundstucke: "3001", laenge: 100 },
        { __id: "b", mundstucke: "0293/1", laenge: 80 },
        { __id: "c", mundstucke: "3001", laenge: 90 },
      ]))] }] }), [], []);
    const grp = s.services[0].msGroups;
    expect(grp.map((x) => x.label)).toEqual(["Mundstück 3001", "Mundstück 0293/1"]);
    expect(grp[0].rows).toHaveLength(2);
    expect(grp[0].cols).toEqual(["laenge"]);
    expect(grp.every((x) => x.paramId === "r1")).toBe(true);
  });
  it("Mundstück ohne Wert: neutraler Fallback, kein Index", () => {
    const s = buildOrderRunSheet(baseOrder({ order_measurements: [{ id: "m1", order_id: "O1",
      measurement_services: { service_name: "Extrusion" },
      measurement_parameters: [p("r1", "repeat:x", JSON.stringify([{ ms: "" }]))] }] }), [], []);
    expect(s.services[0].msGroups[0].label).toBe("Mundstück nicht angegeben");
  });
  it("Knetung: vorbereitende Tätigkeiten, Knetdauer und Rohstoffe werden aufgelöst", () => {
    const s = buildOrderRunSheet(baseOrder({ order_kind: "pilot_plant", order_measurements: [{ id: "m1", order_id: "O1",
      measurement_services: { service_name: "Knetung" },
      measurement_parameters: [
        p("1", "vorbereitende_taetigkeiten", "Mischung homogenisieren"),
        p("2", "knetdauer", "4", "h"),
        p("3", "repeat:rezeptur", JSON.stringify([{ rohstoff: "mat-1", menge: 500, einheit: "g", lot_number: "L7", bemerkung: "frisch" }])),
        p("4", "wasserzugabe", "12", "%"),
      ] }] }), [], []);
    expect(s.knetung).not.toBeNull();
    expect(s.knetung!.vorbereitendeTaetigkeiten).toBe("Mischung homogenisieren");
    expect(s.knetung!.knetdauer).toEqual({ value: "4", unit: "h" });
    expect(s.knetung!.rohstoffe).toHaveLength(1);
    expect(s.knetung!.otherParams.map((x) => x.name)).toEqual(["wasserzugabe"]);
  });
  it("Knetung ohne vorbereitende Tätigkeiten: null (Darstellung zeigt Gedankenstrich), kein Bemerkungs-Rückfall", () => {
    const s = buildOrderRunSheet(baseOrder({ order_kind: "pilot_plant",
      shared_form_data: { template: { values: { bemerkung_versuch: "nicht verwenden" } } },
      order_measurements: [{ id: "m1", order_id: "O1", measurement_services: { service_name: "Knetung" }, measurement_parameters: [] }] }), [], []);
    expect(s.knetung!.vorbereitendeTaetigkeiten).toBeNull();
  });
  it("Indexspalte der Wertetabellen ist im Laufzettel unterdrückt", () => {
    const html = specValueHtml('[{"a":1},{"a":2}]', null, noMat, undefined, { hideIndex: true });
    expect(html).not.toContain("<th>#</th>");
    expect(specValueHtml('[{"a":1}]', null, noMat)).toContain("<th>#</th>");
  });
  it("PDF-Dateiname: Versuchsnummer mit führenden Nullen, Sonderzeichen bereinigt, Fallback", () => {
    expect(runSheetFileName("TE0042")).toBe("Laufzettel_TE0042");
    expect(runSheetFileName("0293/1")).toBe("Laufzettel_0293-1");
    expect(runSheetFileName("SW-260026")).toBe("Laufzettel_SW-260026");
    expect(runSheetFileName("TE 0042")).toBe("Laufzettel_TE_0042");
    expect(runSheetFileName("   ")).toBe("Laufzettel_Auftrag");
  });
  it("Versuchsnummer erscheint nicht als eigene Formularzeile; Auftragsnummer bleibt geführt", () => {
    const s = buildOrderRunSheet(baseOrder({
      order_kind: "pilot_plant", pp_experiment_number: "3121",
      shared_form_data: { template: { values: { versuchsnummer: "3121", bemerkung: "bleibt" } } },
    }), [
      { id: "v", field_key: "versuchsnummer", display_name: "Versuchsnummer" },
      { id: "b", field_key: "bemerkung", display_name: "Bemerkung" },
    ], []);
    expect(s.form.map((f) => f.key)).toEqual(["bemerkung"]);
    expect(s.orderNumber).toBe("SW-260025");
    expect(s.number).toBe("3121");
    expect(runSheetFileName(s.number)).toBe("Laufzettel_3121");
  });
  it("Kopfzeile: Versuchsnummer und Auftragsnummer gemeinsam (3121 – SW-260010)", () => {
    const s = buildOrderRunSheet(baseOrder({
      order_kind: "pilot_plant", order_number: "SW-260010", pp_experiment_number: "3121",
    }), [], []);
    expect(runSheetOrderLabel(s)).toBe("3121 – SW-260010");
    // Dateiname und DMC nutzen weiterhin nur die Versuchsnummer.
    expect(runSheetFileName(s.number)).toBe("Laufzettel_3121");
    expect(orderDmcPayload(s.number)).toBe("ROX|A:3121");
  });
  it("Kopfzeile ohne Versuchsnummer: nur die Auftragsnummer", () => {
    const s = buildOrderRunSheet(baseOrder({ order_number: "SW-260010" }), [], []);
    expect(runSheetOrderLabel(s)).toBe("SW-260010");
  });
  it("Kopfzeile: führende Nullen und Schrägstriche bleiben unverändert", () => {
    const s = buildOrderRunSheet(baseOrder({
      order_kind: "pilot_plant", order_number: "TT-260027", pp_experiment_number: "0293/1",
    }), [], []);
    expect(runSheetOrderLabel(s)).toBe("0293/1 – TT-260027");
  });
  it("V2O5-Gehalt und Massetyp werden aus dem Formular gelöst und gemeinsam geführt", () => {
    const s = buildOrderRunSheet(baseOrder({
      shared_form_data: { template: { values: { v2o5_gehalt: "0,6", massetyp: "DK", bemerkung: "bleibt" } } },
    }), [
      { id: "v", field_key: "v2o5_gehalt", display_name: "V2O5-Gehalt", unit: "%" },
      { id: "m", field_key: "massetyp", display_name: "Massetyp" },
      { id: "b", field_key: "bemerkung", display_name: "Bemerkung" },
    ], []);
    expect(s.v2o5).toEqual({ label: "V2O5-Gehalt", text: "0,6 %" });
    expect(s.masseTyp).toEqual({ label: "Massetyp", text: "DK" });
    expect(s.form.map((f) => f.key)).toEqual(["bemerkung"]);
  });
  it("V2O5/Massetyp: fehlende Werte bleiben null, keine Ersatzwerte", () => {
    const s = buildOrderRunSheet(baseOrder({
      shared_form_data: { template: { values: { massetyp: "GK" } } },
    }), [{ id: "m", field_key: "massetyp", display_name: "Massetyp" }], []);
    expect(s.v2o5).toBeNull();
    expect(s.masseTyp).toEqual({ label: "Massetyp", text: "GK" });
    expect(buildOrderRunSheet(baseOrder(), [], []).v2o5).toBeNull();
    expect(buildOrderRunSheet(baseOrder(), [], []).masseTyp).toBeNull();
  });
  it("container_id-Spalte nur bei Knetung ausgeblendet, andere Dienstleistungen unverändert", () => {
    const cols = ["rohstoff", "quantity", "unit", "note", "container_id", "lot_number"];
    expect(isKnetungService("Knetung")).toBe(true);
    expect(isKnetungService("knetung")).toBe(true);
    expect(isKnetungService("Extrusion")).toBe(false);
    expect(specTableCols(cols, "Knetung")).toEqual(["rohstoff", "quantity", "unit", "note", "lot_number"]);
    expect(specTableCols(cols, "Extrusion")).toEqual(cols);
    expect(specTableCols(cols, null)).toEqual(cols);
  });
});
