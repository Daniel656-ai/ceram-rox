import { describe, expect, it } from "vitest";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import {
  collectConditionDimensions, matchesCondition, conditionSummary,
} from "@/lib/resultConditions";
import type { ResultRecord } from "@/hooks/useResultsDatabase";

const formId = "form-nox";

const field = (key: string, label: string, unit: string | null = null): FormField => ({
  id: `field-${key}`,
  form_id: formId,
  field_key: key,
  display_name: label,
  description: null,
  field_type: "decimal",
  category: null,
  unit,
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
});

const calc = (key: string, name: string, extra: Partial<FormCalculation> = {}): FormCalculation => ({
  id: `calc-${key}`,
  form_id: formId,
  calc_key: key,
  display_name: name,
  description: null,
  formula: "c_ein - c_aus",
  expression: [],
  inputs: ["c_ein", "c_aus"],
  unit: null,
  decimals: 2,
  rounding: "round",
  result_type: "number",
  is_result: true,
  result_label: null,
  sort_order: 0,
  created_at: "",
  updated_at: "",
  ...extra,
});

const fields = [
  field("c_ein", "c ein"),
  field("c_aus", "c aus"),
  field("t1", "Temperatur", "°C"),
];

const values = (t1: string) => ({
  [`form:${formId}:c_ein`]: 500,
  [`form:${formId}:c_aus`]: 100,
  [`form:${formId}:t1`]: t1,
});

const withCondition = (key: string, name: string) =>
  calc(key, name, { metadata: { result_conditions: ["t1"] } });

describe("Ergebnisbedingungen bei Berechnungen", () => {
  it("kennzeichnet η NOx mit der Vorgabetemperatur 300 °C, ohne die Formel zu verändern", () => {
    const [result] = buildLinkedFormResultCandidates(
      formId, fields, [withCondition("eta_nox", "η NOx")], values("300"),
    ).filter((c) => c.kind === "calculation");

    expect(result.label).toBe("η NOx_{(300 °C)}");
    expect(result.value).toBe(400);
    expect(result.instanceContext).toEqual({ Temperatur: "300 °C" });
  });

  it("übernimmt dynamisch 380 °C aus derselben Vorgabe", () => {
    const [result] = buildLinkedFormResultCandidates(
      formId, fields, [withCondition("eta_nox", "η NOx")], values("380"),
    ).filter((c) => c.kind === "calculation");

    expect(result.label).toBe("η NOx_{(380 °C)}");
    expect(result.value).toBe(400);
    expect(result.instanceContext).toEqual({ Temperatur: "380 °C" });
  });

  it("kennzeichnet den K-Wert auf demselben Weg", () => {
    for (const t of ["300", "380"]) {
      const [result] = buildLinkedFormResultCandidates(
        formId, fields, [withCondition("k_wert", "K-Wert")], values(t),
      ).filter((c) => c.kind === "calculation");
      expect(result.label).toBe(`K-Wert_{(${t} °C)}`);
      expect(result.instanceContext).toEqual({ Temperatur: `${t} °C` });
      expect(result.value).toBe(400);
    }
  });

  it("lässt Berechnungen ohne Ergebnisbedingungen unverändert", () => {
    const [result] = buildLinkedFormResultCandidates(
      formId, fields, [calc("eta_nox", "η NOx")], values("300"),
    ).filter((c) => c.kind === "calculation");

    expect(result.label).toBe("η NOx");
    expect(result.instanceContext).toBeNull();
    expect(result.value).toBe(400);
  });

  it("lässt die Bedingung nicht in die Berechnung einfließen", () => {
    const [result] = buildLinkedFormResultCandidates(
      formId, fields, [withCondition("eta_nox", "η NOx")], values("380"),
    ).filter((c) => c.kind === "calculation");
    const [other] = buildLinkedFormResultCandidates(
      formId, fields, [withCondition("eta_nox", "η NOx")], values("300"),
    ).filter((c) => c.kind === "calculation");

    expect(result.value).toBe(other.value);
  });
});

const record = (service: string, label: string, ctx: Record<string, string> | null): ResultRecord =>
  ({
    serviceName: service,
    outputResults: [{ result_name: label, display_label: label, instance_context: ctx }],
  }) as unknown as ResultRecord;

describe("Filter nach Ergebnismerkmal", () => {
  const records = [
    record("NOX-Messung", "η NOx", { Temperatur: "300 °C" }),
    record("NOX-Messung", "η NOx", { Temperatur: "380 °C" }),
    record("NOX-Messung", "K-Wert", { Temperatur: "300 °C" }),
    record("BET", "Oberfläche", null),
  ];

  it("ermittelt Merkmale und Werte aus den gespeicherten Ergebnissen", () => {
    expect(collectConditionDimensions(records)).toEqual([
      { key: "Temperatur", values: ["300 °C", "380 °C"] },
    ]);
  });

  it("findet nur Ergebnisse der gewählten Temperatur", () => {
    expect(records.filter((r) => matchesCondition(r, "Temperatur", "300 °C"))).toHaveLength(2);
    expect(records.filter((r) => matchesCondition(r, "Temperatur", "380 °C"))).toHaveLength(1);
  });

  it("zeigt das Merkmal im Export", () => {
    expect(conditionSummary(records[0])).toBe("Temperatur: 300 °C");
    expect(conditionSummary(records[3])).toBe("");
  });
});
