import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ActivityMeasurementView from "@/components/results/ActivityMeasurementView";
import { extractActivity } from "@/lib/results/activityMeasurement";
import { activityExportRows } from "@/lib/orderExport/buildOrderExport";
import { buildLinkedFormResultCandidates, collectStaleRepeaterInstanceKeys } from "@/lib/officialResults";
import {
  filledTemperatureSteps, hasStepMeasurementValues, isTemperatureBlock, parseTemperatureList,
} from "@/lib/results/temperatureBlock";
import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";
import type { FormField } from "@/lib/api/formFields";

vi.mock("@/components/CompletedResultForm", () => ({ default: () => null }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

// Echte Struktur aus Auftrag DGA260003 / Formular-Diff 7801ba5 (NOx):
const FORM_ID = "a8bdb319-e289-4f34-a55c-5b08c3071f36";
const res = (over: Partial<SampleResultValue>): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: "x", value: null, unit: null, temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: null,
  is_official: false, ...over,
});
/** Wie bei der Übergabe des Auftrags: EIN vorläufiger Eintrag, Liste in remarks. */
const container = (list: unknown[], over: Partial<SampleResultValue> = {}) =>
  res({ result_name: `form:${FORM_ID}:temperatur_12`, unit: "°C", display_label: "Temperatur 12", remarks: JSON.stringify(list), ...over });
const flat = (key: string, value: number, official = true) =>
  res({ result_name: `form:${FORM_ID}:${key}`, value, display_label: key, is_official: official });
const row = (n: number, value: number, official = true) =>
  res({ result_name: `form:${FORM_ID}:temperatur_12[idx_${n}].temperatur_13`, value, unit: "°C", is_official: official, instance_key: `idx_${n}` });

const DGA = [{ temperatur_13: 200 }, { temperatur_13: 300 }, { temperatur_13: 400 }];
const SERVICE = { serviceName: "Aktivitätsmessung NOx" };

describe("Temperaturblock: Erkennung", () => {
  const rep = { field_key: "temperatur_12", field_type: "repeater", metadata: { repeater: { storage_key: "temperatur_12" } } };
  const child = { field_type: "number", unit: "°C" };
  it("Block mit Unterfeld Zahl in °C ist ein Temperaturblock – nicht fest an temperatur_12 gebunden", () => {
    expect(isTemperatureBlock(rep, [child])).toBe(true);
    expect(isTemperatureBlock({ ...rep, field_key: "temperatur_7", metadata: { repeater: { storage_key: "temperatur_7" } } }, [child])).toBe(true);
  });
  it("andere Wiederholungsblöcke und Einzelfelder sind keiner", () => {
    expect(isTemperatureBlock({ ...rep, field_key: "mundstueck_ms", metadata: {} }, [child])).toBe(false);
    expect(isTemperatureBlock(rep, [{ field_type: "number", unit: "ppm" }])).toBe(false);
    expect(isTemperatureBlock({ ...rep, field_type: "number" }, [child])).toBe(false);
    expect(isTemperatureBlock(rep, [])).toBe(false);
  });
  it("Liste in remarks wird gelesen, leerer Eintrag bleibt als Lücke (keine Verschiebung)", () => {
    expect(parseTemperatureList(JSON.stringify(DGA))).toEqual([200, 300, 400]);
    expect(parseTemperatureList(JSON.stringify([{ temperatur_13: 200 }, { temperatur_13: "" }, { temperatur_13: 400 }]))).toEqual([200, null, 400]);
    expect(parseTemperatureList(JSON.stringify([{ eta_nox: 1 }]))).toBeNull();
    expect(filledTemperatureSteps([{ temperatur_13: 200 }, {}, { temperatur_13: "400,5" }])).toEqual([{ step: 1, value: 200 }, { step: 3, value: 400.5 }]);
  });
});

describe("Aktivitätsmessung: Temperaturen aus dem Block (DGA260003)", () => {
  it("3 Einträge (200/300/400) erscheinen in der Tabelle, nicht unter „Weitere Angaben“", () => {
    const { view, rest } = extractActivity([container(DGA)], SERVICE);
    expect(view!.catalysts[0].rows.map((r) => r.temperature)).toEqual([200, 300, 400]);
    expect(view!.other).toEqual([]);
    expect(rest).toEqual([]);
  });

  it("Eintrag i = Stufe i: Messwerte der Stufe 3 landen bei der dritten Temperatur", () => {
    const { view } = extractActivity([container(DGA), flat("eta_nox", 10), flat("eta_nox_kopie", 20), flat("eta_nox_kopie_kopie", 30)], SERVICE);
    expect(view!.catalysts[0].rows.map((r) => [r.temperature, r.eta])).toEqual([[200, 10], [300, 20], [400, 30]]);
  });

  it("leerer Eintrag lässt seine Stufe frei, ohne die anderen zu verschieben", () => {
    const list = [{ temperatur_13: 200 }, { temperatur_13: "" }, { temperatur_13: 400 }];
    const { view } = extractActivity([container(list), flat("eta_nox", 10), flat("eta_nox_kopie", 20), flat("eta_nox_kopie_kopie", 30)], SERVICE);
    const rows = view!.catalysts[0].rows;
    expect(rows.map((r) => [r.temperature, r.eta])).toEqual([[200, 10], [null, 20], [400, 30]]);
  });

  it("nicht festgelegt auf temperatur_12: anderer Blockname funktioniert gleich", () => {
    const c = res({ result_name: `form:${FORM_ID}:temperatur_7`, remarks: JSON.stringify(DGA) });
    expect(extractActivity([c], SERVICE).view!.catalysts[0].rows.map((r) => r.temperature)).toEqual([200, 300, 400]);
  });

  it("Zeilenergebnisse der Messperson erscheinen nicht doppelt; offiziell, wenn alle Zeilen offiziell sind", () => {
    const rows = [row(1, 200), row(2, 300), row(3, 400)];
    const { view, rest } = extractActivity([container(DGA), ...rows, flat("eta_nox", 10)], SERVICE);
    expect(view!.catalysts[0].rows.map((r) => r.temperature)).toEqual([200, 300, 400]);
    expect(view!.other).toEqual([]);
    expect(rest).toEqual([]);
    expect(view!.official).toBe(true);
  });

  it("nur Zeilenergebnisse (ohne Liste): Stufe aus idx_<n>", () => {
    const { view } = extractActivity([row(1, 200), row(3, 400), flat("eta_nox_kopie_kopie", 30)], SERVICE);
    expect(view!.catalysts[0].rows.map((r) => [r.temperature, r.eta])).toEqual([[200, null], [400, 30]]);
  });

  it("nicht zur Aktivitätsmessung: reine Temperaturliste ohne Ergebnisse ändert nichts", () => {
    const { view, rest } = extractActivity([container(DGA)], { serviceName: "BET" });
    expect(view).toBeNull();
    expect(rest).toHaveLength(1);
  });
});

describe("Abweichung Vorgabe (Block) vs. gemessen (altes temperatur_<n>)", () => {
  it("gleicher Wert: nur einmal, keine Abweichung", () => {
    const { view } = extractActivity([container([{ temperatur_13: 200 }]), flat("temperatur_1", 200), flat("eta_nox", 10)], SERVICE);
    const r = view!.catalysts[0].rows;
    expect(r).toHaveLength(1);
    expect(r[0].temperature).toBe(200);
    expect(r[0].temperatureTarget).toBeUndefined();
  });

  it("abweichender Wert: beide sichtbar (gemessen + Vorgabe), nichts still gewählt", () => {
    const { view } = extractActivity([container([{ temperatur_13: 200 }]), flat("temperatur_1", 205), flat("eta_nox", 10)], SERVICE);
    const r = view!.catalysts[0].rows[0];
    expect(r.temperature).toBe(205);
    expect(r.temperatureTarget).toBe(200);

    render(<TooltipProvider><ActivityMeasurementView view={view!} /></TooltipProvider>);
    expect(screen.getByText(/Vorgabe 200 \(weicht ab\)/)).toBeTruthy();

    const exp = activityExportRows(view!).map((x) => x.map((c) => c.v));
    expect(exp.some((x) => x.some((c) => typeof c === "string" && c.includes("Vorgabe 200 °C weicht ab")))).toBe(true);
  });
});

describe("Alter Auftrag mit temperatur_1..n bleibt unverändert", () => {
  it("Tabelle wie bisher, keine Vorgabe-Hinweise", () => {
    const old = [
      flat("temperatur_1", 200), flat("temperatur_2", 280), flat("temperatur_3", 360),
      flat("eta_nox", 27.5), flat("eta_nox_kopie", 63.4), flat("eta_nox_kopie_kopie", 78.6),
    ];
    const { view, rest } = extractActivity(old, SERVICE);
    const rows = view!.catalysts[0].rows;
    expect(rows.map((r) => [r.temperature, r.eta])).toEqual([[200, 27.5], [280, 63.4], [360, 78.6]]);
    expect(rows.every((r) => r.temperatureTarget === undefined)).toBe(true);
    expect(rest).toEqual([]);
    expect(activityExportRows(view!).flat().some((c) => typeof c.v === "string" && c.v.includes("Vorgabe"))).toBe(false);
  });
});

/* ---- offizielle Ergebnisse ------------------------------------------------------------------ */

const field = (over: Partial<FormField>): FormField => ({
  id: "f", form_id: FORM_ID, field_key: "x", display_name: "X", description: null, field_type: "number", category: null,
  unit: null, is_required: false, default_value: null, validation: {}, min_value: null, max_value: null, decimal_places: null,
  readonly: false, formula: null, select_options: [], ref_target: null, parent_field_id: null, sort_order: 0, metadata: {},
  global_field_id: null, binding_path: null, is_result: false, result_label: null, created_at: "", updated_at: "", ...over,
});
// Struktur aus dem Diff: Block temperatur_12 (repeater), Unterfeld temperatur_13 (number, °C, KEIN is_result)
const REPEATER = field({
  id: "9a0fdf12", field_key: "temperatur_12", field_type: "repeater", unit: "°C", display_name: "Temperatur 12",
  global_field_id: "e5d4f330",
  metadata: { repeater: { storage_key: "temperatur_12", layout: { version: 1, gap: "md", items: [{ id: "auto-f:temperatur", key: "temperatur", type: "field", width: 12 }] } } },
});
const CHILD = field({ id: "edfbb563", field_key: "temperatur_13", field_type: "number", unit: "°C", display_name: "Temperatur", parent_field_id: "9a0fdf12" });
const FIELDS = [REPEATER, CHILD];
const candidates = (list: unknown[]) =>
  buildLinkedFormResultCandidates(FORM_ID, FIELDS, [], { [`form:${FORM_ID}:temperatur_12`]: list });

describe("Ergebnisdatenbank: ausgefüllte Einträge sind offizielle Ergebnisse", () => {
  it("2 Temperaturen + 1 leerer Eintrag: genau 2 offizielle Ergebnisse, nichts für den leeren", () => {
    const c = candidates([{ temperatur_13: 200 }, { temperatur_13: "" }, { temperatur_13: 400 }]);
    expect(c.map((x) => [x.key, x.value, x.official])).toEqual([
      [`form:${FORM_ID}:temperatur_12[idx_1].temperatur_13`, 200, true],
      [`form:${FORM_ID}:temperatur_12[idx_3].temperatur_13`, 400, true],
    ]);
  });

  it("DGA260003: 3 Einträge -> 3 offizielle Zeilenergebnisse; der Block selbst nie offiziell (kein Doppel)", () => {
    const c = candidates(DGA);
    expect(c.filter((x) => x.official)).toHaveLength(3);
    expect(c.some((x) => x.key === `form:${FORM_ID}:temperatur_12`)).toBe(false);
  });

  it("anderer Wiederholungsblock (kein Temperaturblock) bleibt wie bisher: nicht offiziell ohne is_result", () => {
    const other = field({ id: "r2", field_key: "proben_liste", field_type: "repeater", metadata: { repeater: { storage_key: "proben_liste" } } });
    const ch = field({ id: "c2", field_key: "menge", field_type: "number", unit: "g", parent_field_id: "r2" });
    const c = buildLinkedFormResultCandidates(FORM_ID, [other, ch], [], { [`form:${FORM_ID}:proben_liste`]: [{ menge: 5 }, { menge: "" }] });
    expect(c.every((x) => x.official === false)).toBe(true);
    expect(c.length).toBe(2);
  });

  it("verwaiste Zeilenergebnisse (Position jetzt leer oder weg) werden zur Bereinigung gemeldet", () => {
    const names = [1, 2, 3].map((n) => `form:${FORM_ID}:temperatur_12[idx_${n}].temperatur_13`);
    const stale = collectStaleRepeaterInstanceKeys(FORM_ID, FIELDS, { [`form:${FORM_ID}:temperatur_12`]: [{ temperatur_13: 200 }, { temperatur_13: "" }] }, names);
    expect([...stale].sort()).toEqual([names[1], names[2]]);
  });
});

describe("Sperre: Messwerte je Stufe vorhanden?", () => {
  it("erkennt η-NOx, K-Wert und Gase mit Wert", () => {
    expect(hasStepMeasurementValues({ eta_nox: 12 })).toBe(true);
    expect(hasStepMeasurementValues({ [`form:${FORM_ID}:k_wert_kopie`]: "3,4" })).toBe(true);
    expect(hasStepMeasurementValues({ no_in_1: 200 })).toBe(true);
  });
  it("leere Werte und fremde Felder sperren nicht", () => {
    expect(hasStepMeasurementValues({ eta_nox: "", no_in_1: null, temperatur_12: [{ temperatur_13: 200 }], versuchsnummer: "1" })).toBe(false);
    expect(hasStepMeasurementValues(undefined)).toBe(false);
  });
});
