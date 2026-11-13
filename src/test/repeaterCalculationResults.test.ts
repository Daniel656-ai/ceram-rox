import { describe, expect, it } from "vitest";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import { INSTANCE_ID_KEY } from "@/lib/measurementBlocks";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";

const formId = "form-akt";

const baseField = (over: Partial<FormField>): FormField => ({
  id: "field-x",
  form_id: formId,
  field_key: "x",
  display_name: "X",
  description: null,
  field_type: "decimal",
  category: null,
  unit: null,
  is_required: false,
  default_value: null,
  validation: {},
  min_value: null,
  max_value: null,
  decimal_places: 2,
  readonly: false,
  formula: null,
  select_options: [],
  ref_target: null,
  parent_field_id: null,
  sort_order: 0,
  metadata: {},
  global_field_id: null,
  binding_path: null,
  is_result: false,
  result_label: null,
  created_at: "",
  updated_at: "",
  ...over,
});

const baseCalc = (over: Partial<FormCalculation>): FormCalculation => ({
  id: "calc-x",
  form_id: formId,
  calc_key: "x",
  display_name: "X",
  description: null,
  formula: "",
  expression: [],
  inputs: [],
  unit: null,
  decimals: 2,
  rounding: "round",
  result_type: "number",
  is_result: false,
  result_label: null,
  sort_order: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

/** Repeater mit Layout: Felder und Berechnungen sind platziert (wie im Formulardesigner). */
const repeaterWithLayout = (items: unknown[]) =>
  baseField({
    id: "rep-aktivitaeten",
    field_key: "aktivitaeten",
    display_name: "Temperaturstufen",
    field_type: "repeater",
    metadata: { repeater: { item_label: "Temperaturstufe", layout: { version: 1, gap: "md", items } } },
  });

const child = (key: string, label: string, over: Partial<FormField> = {}) =>
  baseField({
    id: `child-${key}`,
    field_key: key,
    display_name: label,
    parent_field_id: "rep-aktivitaeten",
    sort_order: 1,
    ...over,
  });

const row = (id: string, values: Record<string, unknown>) => ({
  [INSTANCE_ID_KEY]: id,
  ...values,
});

// Aktivitätsmessung: Temperatur, Aktivität und die Berechnungen K-Wert / η-NOx je Zeile.
const activityFields = () => [
  repeaterWithLayout([
    { id: "i-temp", type: "field", key: "temperatur", field_id: "child-temperatur", width: 4 },
    { id: "i-akt", type: "field", key: "aktivitaet", field_id: "child-aktivitaet", width: 4 },
    { id: "i-k", type: "calculation", calc_key: "k_wert", calc_id: "calc-k", width: 4 },
    { id: "i-eta", type: "calculation", calc_key: "eta_nox", calc_id: "calc-eta", width: 4 },
  ]),
  child("temperatur", "Temperatur", { unit: "°C" }),
  child("aktivitaet", "Aktivität", { is_result: true, unit: "%" }),
];

const activityCalcs = () => [
  baseCalc({
    id: "calc-k",
    calc_key: "k_wert",
    display_name: "K-Wert",
    formula: "aktivitaet * 2",
    is_result: true,
    unit: "1/s",
  }),
  baseCalc({
    id: "calc-eta",
    calc_key: "eta_nox",
    display_name: "η-NOx",
    formula: "aktivitaet / 100",
    is_result: true,
    unit: "%",
  }),
];

const threeRows = () => ({
  [`form:${formId}:aktivitaeten`]: [
    row("m_t200", { temperatur: 200, aktivitaet: 10 }),
    row("m_t280", { temperatur: 280, aktivitaet: 20 }),
    row("m_t360", { temperatur: 360, aktivitaet: 30 }),
  ],
});

describe("Zeilenbezogene Repeater-Berechnungen in der Ergebnisermittlung", () => {
  it("Test 1 – drei Temperaturstufen mit drei unterschiedlichen K-Werten", () => {
    const candidates = buildLinkedFormResultCandidates(
      formId, activityFields(), activityCalcs(), threeRows()
    );
    const kValues = candidates.filter((c) => c.kind === "calculation" && c.label === "K-Wert");
    expect(kValues).toHaveLength(3);
    expect(kValues.map((c) => c.instanceKey)).toEqual(["m_t200", "m_t280", "m_t360"]);
    expect(kValues.map((c) => c.value)).toEqual([20, 40, 60]);
    expect(kValues.every((c) => c.official)).toBe(true);
    expect(kValues.map((c) => c.key)).toEqual([
      `form:${formId}:aktivitaeten[m_t200].k_wert`,
      `form:${formId}:aktivitaeten[m_t280].k_wert`,
      `form:${formId}:aktivitaeten[m_t360].k_wert`,
    ]);
  });

  it("Test 2 – mehrere η-NOx-Ergebnisse innerhalb desselben Repeaters", () => {
    const candidates = buildLinkedFormResultCandidates(
      formId, activityFields(), activityCalcs(), threeRows()
    );
    const eta = candidates.filter((c) => c.kind === "calculation" && c.label === "η-NOx");
    expect(eta).toHaveLength(3);
    expect(eta.map((c) => c.value)).toEqual([0.1, 0.2, 0.3]);
    expect(eta.every((c) => c.official)).toBe(true);
  });

  it("Test 3 – gleiche Ergebnisnamen in verschiedenen Zeilen überschreiben sich nicht", () => {
    const candidates = buildLinkedFormResultCandidates(
      formId, activityFields(), activityCalcs(), threeRows()
    );
    const aktivitaet = candidates.filter((c) => c.label === "Aktivität");
    expect(aktivitaet).toHaveLength(3);
    expect(new Set(aktivitaet.map((c) => c.key)).size).toBe(3);
    expect(aktivitaet.map((c) => c.value)).toEqual([10, 20, 30]);
  });

  it("Test 4 – Repeater-Felder mit parent_field_id bleiben zugeordnet", () => {
    const candidates = buildLinkedFormResultCandidates(
      formId, activityFields(), activityCalcs(), threeRows()
    );
    const temp = candidates.filter((c) => c.label === "Temperatur");
    expect(temp).toHaveLength(3);
    expect(temp.map((c) => c.value)).toEqual([200, 280, 360]);
    expect(temp.every((c) => !c.official)).toBe(true); // Eingabefeld, kein Ergebnisfeld
  });

  it("Test 5 – Feld ausschließlich über das Layout zugeordnet (kein parent_field_id)", () => {
    const layoutOnly = baseField({
      id: "child-druck",
      field_key: "druck",
      display_name: "Druck",
      is_result: true,
      unit: "bar",
      parent_field_id: null, // nur Layout-Zuordnung
    });
    const fields = [
      repeaterWithLayout([
        { id: "i-druck", type: "field", key: "druck", field_id: "child-druck", width: 6 },
      ]),
      layoutOnly,
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [row("m_1", { druck: 1.5 })],
    });
    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(1);
    expect(official[0]).toMatchObject({
      key: `form:${formId}:aktivitaeten[m_1].druck`,
      value: 1.5,
      instanceKey: "m_1",
    });
    // Kein flaches Ergebnis zusätzlich.
    expect(candidates.some((c) => c.key === `form:${formId}:druck`)).toBe(false);
  });

  it("Test 6 – Berechnung im Repeater erscheint nicht zusätzlich auf Top-Level-Ebene", () => {
    const candidates = buildLinkedFormResultCandidates(
      formId, activityFields(), activityCalcs(), threeRows()
    );
    expect(candidates.some((c) => c.key === `form:${formId}:k_wert`)).toBe(false);
    expect(candidates.some((c) => c.key === `form:${formId}:eta_nox`)).toBe(false);
  });

  it("Test 7 – Berechnung außerhalb des Repeaters (Aggregat) bleibt Top-Level-Ergebnis", () => {
    const aggregate = baseCalc({
      id: "calc-sum",
      calc_key: "aktivitaet_gesamt",
      display_name: "Aktivität gesamt",
      formula: "SUM(aktivitaeten.aktivitaet)",
      inputs: ["aktivitaeten.aktivitaet"],
      is_result: true,
      unit: "%",
    });
    const candidates = buildLinkedFormResultCandidates(
      formId, activityFields(), [...activityCalcs(), aggregate], threeRows()
    );
    const sum = candidates.find((c) => c.key === `form:${formId}:aktivitaet_gesamt`);
    expect(sum).toMatchObject({ official: true, value: 60, error: null });
  });

  it("Test 8 – nicht offizielle Repeater-Felder und -Berechnungen bleiben inoffiziell", () => {
    const inofficialCalc = baseCalc({
      id: "calc-intern",
      calc_key: "intern",
      display_name: "Intern",
      formula: "aktivitaet + 1",
      is_result: false,
    });
    const fields = [
      repeaterWithLayout([
        { id: "i-akt", type: "field", key: "aktivitaet", field_id: "child-aktivitaet", width: 6 },
        { id: "i-int", type: "calculation", calc_key: "intern", calc_id: "calc-intern", width: 6 },
      ]),
      child("aktivitaet", "Aktivität", { is_result: false }),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [inofficialCalc], {
      [`form:${formId}:aktivitaeten`]: [row("m_1", { aktivitaet: 5 })],
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => !c.official)).toBe(true);
    // Die Berechnung wird dennoch zeilenbezogen mitgeführt (Wert sichtbar, nicht offiziell).
    expect(candidates.find((c) => c.label === "Intern")).toMatchObject({ value: 6, instanceKey: "m_1" });
  });

  it("Test 9 – erneutes Speichern erzeugt keine doppelten Ergebnisschlüssel", () => {
    const first = buildLinkedFormResultCandidates(formId, activityFields(), activityCalcs(), threeRows());
    const second = buildLinkedFormResultCandidates(formId, activityFields(), activityCalcs(), threeRows());
    expect(second.map((c) => c.key)).toEqual(first.map((c) => c.key));
    expect(new Set(second.map((c) => c.key)).size).toBe(second.length);
  });

  it("Test 10 – vorhandene Repeater-Daten ohne Instanzkennung werden ohne Neueingabe ausgewertet", () => {
    // Altdaten: Zeilen ohne __instance_id, aber mit vollständigen Messwerten.
    const candidates = buildLinkedFormResultCandidates(formId, activityFields(), activityCalcs(), {
      [`form:${formId}:aktivitaeten`]: [
        { temperatur: 200, aktivitaet: 10 },
        { temperatur: 280, aktivitaet: 20 },
      ],
    });
    const kValues = candidates.filter((c) => c.kind === "calculation" && c.label === "K-Wert");
    expect(kValues).toHaveLength(2);
    expect(kValues.map((c) => c.instanceKey)).toEqual(["idx_1", "idx_2"]);
    expect(kValues.map((c) => c.value)).toEqual([20, 40]);
    expect(kValues.every((c) => c.official)).toBe(true);
  });

  it("Container-Kennzeichnung wird nicht pauschal auf Unterfelder übertragen", () => {
    const fields = activityFields().map((f) =>
      f.id === "rep-aktivitaeten" ? { ...f, is_result: true } : f
    );
    const candidates = buildLinkedFormResultCandidates(formId, fields, activityCalcs(), threeRows());
    // Der Container selbst ist kein Ergebnis …
    expect(candidates.some((c) => c.key === `form:${formId}:aktivitaeten`)).toBe(false);
    // … und das nicht gekennzeichnete Eingabefeld „Temperatur“ bleibt inoffiziell.
    expect(candidates.filter((c) => c.label === "Temperatur").every((c) => !c.official)).toBe(true);
  });
});
