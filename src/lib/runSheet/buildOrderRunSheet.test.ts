import { describe, it, expect } from "vitest";
import { buildOrderRunSheet, orderDmcPayload } from "./buildOrderRunSheet";
import { specValueHtml } from "./specHtml";
import { specValueShape } from "@/lib/specValues";

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
});
