import { describe, expect, it } from "vitest";
import {
  buildLinkedFormResultCandidates,
  collectStaleRepeaterInstanceKeys,
} from "@/lib/officialResults";
import { resolveResultPrecision, type PrecisionDefinitions } from "@/lib/resultDisplayPrecision";
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

const repeaterField = (key = "aktivitaeten") =>
  baseField({
    id: `rep-${key}`,
    field_key: key,
    display_name: "Aktivitäten",
    field_type: "repeater",
    metadata: { repeater: { item_label: "Aktivität" } },
  });

const repeaterChild = (key: string, label: string, over: Partial<FormField> = {}) =>
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

describe("Repeater-Unterfelder in der offiziellen Ergebnisermittlung", () => {
  it("Test A – eine Zeile: offizielles Unterfeld wird Instanz-Ergebnis", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true, unit: "Bq" }),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [row("m_abc123", { aktivitaet: 12.5 })],
    });

    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(1);
    expect(official[0]).toMatchObject({
      key: `form:${formId}:aktivitaeten[m_abc123].aktivitaet`,
      label: "Aktivität",
      unit: "Bq",
      value: 12.5,
      kind: "field",
      instanceKey: "m_abc123",
    });
    // Der Repeater-Container selbst ist kein Ergebnis.
    expect(candidates.some((c) => c.key === `form:${formId}:aktivitaeten`)).toBe(false);
    // Das Unterfeld erzeugt kein flaches Ergebnis mehr.
    expect(candidates.some((c) => c.key === `form:${formId}:aktivitaet`)).toBe(false);
  });

  it("Test B – mehrere Zeilen: eigenständige Ergebnisse ohne Überschreibung", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [
        row("m_zeile1", { aktivitaet: 12.5 }),
        row("m_zeile2", { aktivitaet: 14.2 }),
      ],
    });

    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(2);
    expect(official.map((c) => c.instanceKey)).toEqual(["m_zeile1", "m_zeile2"]);
    expect(official.find((c) => c.instanceKey === "m_zeile1")?.value).toBe(12.5);
    expect(official.find((c) => c.instanceKey === "m_zeile2")?.value).toBe(14.2);
  });

  it("Test C – Nullwert: numerische 0 bleibt gültiger Messwert", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [row("m_null", { aktivitaet: 0 })],
    });
    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(1);
    expect(official[0].value).toBe(0);
  });

  it("Test D – fehlender Wert: kein künstlicher Nullwert", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [row("m_leer", { aktivitaet: "" })],
    });
    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(1);
    expect(official[0].value).toBe("");
    expect(official[0].value).not.toBe(0);
  });

  it("Test E – wiederholtes Speichern: stabile Kennung, gleiche Schlüssel", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
    ];
    const first = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [row("m_stabil", { aktivitaet: 12.5 })],
    });
    const second = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [row("m_stabil", { aktivitaet: 13.1 })],
    });
    expect(second.map((c) => c.key)).toEqual(first.map((c) => c.key));
    expect(second.find((c) => c.official)?.value).toBe(13.1);
  });

  it("Test F – historische flache Ergebnisse: kein flacher Kandidat für Repeater-Unterfelder", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
    ];
    // Historischer flacher Wert liegt noch in den gespeicherten Werten.
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaet`]: 11.9,
      [`form:${formId}:aktivitaeten`]: [row("m_neu", { aktivitaet: 12.5 })],
    });
    // Das Unterfeld erzeugt keinen flachen Definitionskandidaten – der
    // historische Schlüssel gehört damit nicht zum bekannten Ergebnissatz
    // und wird von der Bereinigung nicht berührt.
    expect(candidates.some((c) => c.key === `form:${formId}:aktivitaet`)).toBe(false);
  });

  it("Test G – Berechnung über mehrere Repeater-Zeilen (Aggregat)", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
    ];
    const sum: FormCalculation = {
      id: "calc-sum",
      form_id: formId,
      calc_key: "aktivitaet_gesamt",
      display_name: "Aktivität gesamt",
      description: null,
      formula: "SUM(aktivitaeten.aktivitaet)",
      expression: [],
      inputs: ["aktivitaeten.aktivitaet"],
      unit: "Bq",
      decimals: 2,
      rounding: "round",
      result_type: "number",
      is_result: true,
      result_label: null,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    };
    const candidates = buildLinkedFormResultCandidates(formId, fields, [sum], {
      [`form:${formId}:aktivitaeten`]: [
        row("m_1", { aktivitaet: 12.5 }),
        row("m_2", { aktivitaet: 14.2 }),
        row("m_3", { aktivitaet: "" }), // leere Eingabe fließt nicht als 0 ein
      ],
    });
    const calc = candidates.find((c) => c.key === `form:${formId}:aktivitaet_gesamt`);
    expect(calc).toMatchObject({ official: true, value: 26.7, error: null });
  });

  it("Test H – Regression Messdatenblock: unverändert neben Repeater", () => {
    const block = baseField({
      id: "block-1",
      field_key: "messungen",
      display_name: "Messungen",
      field_type: "measurement_block",
      metadata: { measurement_block: { min_entries: 1, item_label: "Messung", add_label: "Messung hinzufügen", context_fields: [] } },
    });
    const blockChild = baseField({
      id: "block-child-1",
      field_key: "sio2",
      display_name: "SiO2",
      parent_field_id: "block-1",
      is_result: true,
    });
    const fields = [block, blockChild, repeaterField(), repeaterChild("aktivitaet", "Aktivität", { is_result: true })];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:messungen`]: [row("m_block1", { sio2: 55.1 })],
      [`form:${formId}:aktivitaeten`]: [row("m_rep1", { aktivitaet: 12.5 })],
    });
    const blockResult = candidates.find((c) => c.key === `form:${formId}:messungen[m_block1].sio2`);
    expect(blockResult).toMatchObject({ official: true, value: 55.1, instanceKey: "m_block1" });
    const repResult = candidates.find((c) => c.key === `form:${formId}:aktivitaeten[m_rep1].aktivitaet`);
    expect(repResult).toMatchObject({ official: true, value: 12.5 });
  });

  it("Test I – Repeater ohne offizielle Unterfelder erzeugt keine offiziellen Ergebnisse", () => {
    const fields = [
      repeaterField(),
      repeaterChild("bemerkung", "Bemerkung", { field_type: "text" }),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [row("m_1", { bemerkung: "nur intern" })],
    });
    expect(candidates.every((c) => !c.official)).toBe(true);
    // Der Container wird auch bei is_result am Container kein JSON-Array-Ergebnis.
    const withOfficialContainer = buildLinkedFormResultCandidates(
      formId,
      [repeaterField(), repeaterChild("bemerkung", "Bemerkung")].map((f) =>
        f.id === "rep-aktivitaeten" ? { ...f, is_result: true } : f
      ),
      [],
      { [`form:${formId}:aktivitaeten`]: [row("m_1", { bemerkung: "x" })] },
    );
    expect(withOfficialContainer.some((c) => c.key === `form:${formId}:aktivitaeten`)).toBe(false);
  });

  it("Altdaten ohne Instanzkennung: positionsbasierte idx-Kennung als Rückfallebene", () => {
    const fields = [
      repeaterField(),
      repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
    ];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:aktivitaeten`]: [{ aktivitaet: 9.9 }],
    });
    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(1);
    expect(official[0].key).toBe(`form:${formId}:aktivitaeten[idx_1].aktivitaet`);
    expect(official[0].instanceKey).toBe("idx_1");
  });

  it("storage_key des Repeaters wird für die Ergebnisidentität verwendet", () => {
    const rep = repeaterField();
    rep.metadata = { repeater: { item_label: "Aktivität", storage_key: "akt_speicher" } };
    const fields = [rep, repeaterChild("aktivitaet", "Aktivität", { is_result: true })];
    const candidates = buildLinkedFormResultCandidates(formId, fields, [], {
      [`form:${formId}:akt_speicher`]: [row("m_s1", { aktivitaet: 3.3 })],
    });
    expect(candidates.find((c) => c.official)?.key).toBe(
      `form:${formId}:akt_speicher[m_s1].aktivitaet`
    );
  });
});

describe("Bereinigung verwaister Repeater-Ergebnisse", () => {
  const fields = [
    repeaterField(),
    repeaterChild("aktivitaet", "Aktivität", { is_result: true }),
  ];

  it("entfernte Zeile mit stabiler Kennung wird gemeldet", () => {
    const stale = collectStaleRepeaterInstanceKeys(
      formId,
      fields,
      { [`form:${formId}:aktivitaeten`]: [row("m_bleibt", { aktivitaet: 1 })] },
      [
        `form:${formId}:aktivitaeten[m_bleibt].aktivitaet`,
        `form:${formId}:aktivitaeten[m_entfernt].aktivitaet`,
      ],
    );
    expect([...stale]).toEqual([`form:${formId}:aktivitaeten[m_entfernt].aktivitaet`]);
  });

  it("positionsbasierte Kennungen (Altdaten) werden niemals gemeldet", () => {
    const stale = collectStaleRepeaterInstanceKeys(
      formId,
      fields,
      { [`form:${formId}:aktivitaeten`]: [row("m_bleibt", { aktivitaet: 1 })] },
      [`form:${formId}:aktivitaeten[idx_3].aktivitaet`],
    );
    expect(stale.size).toBe(0);
  });

  it("historische flache Ergebnisse und fremde Strukturen bleiben unberührt", () => {
    const stale = collectStaleRepeaterInstanceKeys(
      formId,
      fields,
      { [`form:${formId}:aktivitaeten`]: [] },
      [
        `form:${formId}:aktivitaet`,
        `form:${formId}:messungen[m_block1].sio2`,
        `form:anderes-form:aktivitaeten[m_x].aktivitaet`,
        "klassisches_ergebnis",
      ],
    );
    expect(stale.size).toBe(0);
  });
});

describe("Dezimalpräzision für Repeater-Unterfelder", () => {
  const definitions = (decimals: number | null): PrecisionDefinitions => ({
    fields: [
      {
        id: "rep-aktivitaeten",
        form_id: formId,
        field_key: "aktivitaeten",
        decimal_places: null,
        parent_field_id: null,
        field_type: "repeater",
        metadata: { repeater: {} },
      },
      {
        id: "child-aktivitaet",
        form_id: formId,
        field_key: "aktivitaet",
        decimal_places: decimals,
        parent_field_id: "rep-aktivitaeten",
        field_type: "decimal",
        metadata: {},
      },
    ],
    calculations: [],
    serviceFields: [],
  });

  it("Test J – 2 und 3 Nachkommastellen werden je Unterfeld aufgelöst", () => {
    const name = `form:${formId}:aktivitaeten[m_1].aktivitaet`;
    expect(resolveResultPrecision({ result_name: name, instance_key: "m_1" }, null, definitions(2))).toBe(2);
    expect(resolveResultPrecision({ result_name: name, instance_key: "m_1" }, null, definitions(3))).toBe(3);
  });

  it("abweichende Instanzkennung liefert keine Präzision", () => {
    const name = `form:${formId}:aktivitaeten[m_1].aktivitaet`;
    expect(resolveResultPrecision({ result_name: name, instance_key: "m_anders" }, null, definitions(2))).toBeUndefined();
  });

  it("Repeater-Unterfeld erzeugt keine flache Präzisionszuordnung", () => {
    expect(
      resolveResultPrecision({ result_name: `form:${formId}:aktivitaet` }, null, definitions(2))
    ).toBeUndefined();
  });
});
