import { describe, it, expect } from "vitest";
import {
  readValueSource, isSameFormLink, numericValue, formatConditionValue,
  readResultConditions, writeResultConditions, collectResultConditions,
  buildConditionLabel, conditionsToContext,
} from "@/lib/fieldLinks";
import { toUnicode } from "@/lib/richText";
import type { FormField } from "@/lib/api/formFields";

const field = (p: Partial<FormField>): FormField => ({
  id: p.id ?? "id", form_id: "f", field_key: p.field_key ?? "k",
  display_name: p.display_name ?? "Feld", description: null,
  field_type: p.field_type ?? "text", category: null, unit: p.unit ?? null,
  is_required: false, default_value: null, validation: {}, min_value: null,
  max_value: null, decimal_places: null, readonly: false, formula: null,
  select_options: [], ref_target: null, parent_field_id: null, sort_order: 0,
  metadata: (p.metadata ?? {}) as any, global_field_id: null, binding_path: null,
  is_result: false, result_label: null, created_at: "", updated_at: "",
  ...(p as any),
});

describe("Wertquelle (Feldverknüpfung)", () => {
  it("erkennt eine Verknüpfung im selben Formular", () => {
    const vs = readValueSource({
      id: "x",
      data_source: { mode: "copy", source: { kind: "form_field", field_key: "temperatur", label: "Temperatur" } },
    } as any);
    expect(isSameFormLink(vs)).toBe(true);
    expect(vs?.source.field_key).toBe("temperatur");
  });

  it("bleibt für bestehende Felder ohne Datenquelle leer", () => {
    expect(readValueSource({ id: "x" } as any)).toBeNull();
    expect(readValueSource({ id: "x", data_source: {} } as any)).toBeNull();
  });

  it("erkennt weiterhin Workflow-Quellen (vorangegangene Dienstleistung)", () => {
    const vs = readValueSource({
      id: "x",
      data_source: { mode: "display", source: { kind: "workflow_step", step_key: "s1", field_key: "temperatur" } },
    } as any);
    expect(vs?.source.kind).toBe("workflow_step");
    expect(isSameFormLink(vs)).toBe(false);
  });
});

describe("Numerik und Einheiten", () => {
  it("rechnet mit 300, nicht mit dem Text 300 °C", () => {
    expect(numericValue("300 °C")).toBe(300);
    expect(numericValue("12,4")).toBe(12.4);
    expect(numericValue(300)).toBe(300);
    expect(numericValue("keine Zahl")).toBeNull();
  });

  it("formatiert Wert und Einheit getrennt", () => {
    expect(formatConditionValue("300", "°C")).toBe("300 °C");
    expect(formatConditionValue("300", null)).toBe("300");
  });
});

describe("Dynamische Ergebnisbezeichnung", () => {
  const fields = [
    field({ id: "1", field_key: "temperatur", display_name: "Temperatur", unit: "°C" }),
    field({ id: "2", field_key: "haltezeit", display_name: "Haltezeit", unit: "min" }),
  ];

  it("erzeugt eine vollständig tiefgestellte Klammer", () => {
    const conds = collectResultConditions(["temperatur"], fields, { temperatur: "300" });
    const label = buildConditionLabel("η-NO_{x}", conds);
    expect(label).toBe("η-NO_{x}_{(300 °C)}");
    expect(toUnicode(label)).toBe("η-NOₓ₍₃₀₀ °C₎");
  });

  it("unterstützt mehrere Bedingungen", () => {
    const conds = collectResultConditions(["temperatur", "haltezeit"], fields, { temperatur: "300", haltezeit: "10" });
    expect(buildConditionLabel("η-NO_{x}", conds)).toBe("η-NO_{x}_{(300 °C, 10 min)}");
  });

  it("bleibt ohne Bedingungen unverändert", () => {
    expect(buildConditionLabel("D", [])).toBe("D");
    expect(buildConditionLabel("D", collectResultConditions(["temperatur"], fields, {}))).toBe("D");
  });

  it("hält die Bedingung strukturiert vor", () => {
    const conds = collectResultConditions(["temperatur"], fields, { temperatur: "300" });
    expect(conds[0]).toMatchObject({ label: "Temperatur", value: "300", unit: "°C", numeric: 300 });
    expect(conditionsToContext(conds)).toEqual({ Temperatur: "300 °C" });
  });

  it("liest und schreibt Bedingungen abwärtskompatibel", () => {
    expect(readResultConditions(field({}))).toEqual([]);
    const meta = writeResultConditions({ other: 1 }, ["temperatur"]);
    expect(meta).toEqual({ other: 1, result_conditions: ["temperatur"] });
    expect(writeResultConditions(meta, [])).toEqual({ other: 1 });
  });
});
