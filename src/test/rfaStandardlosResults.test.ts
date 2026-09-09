import { describe, expect, it } from "vitest";
import { buildEntriesFromCase, elementValueKey, type CaseTemplate } from "@/lib/measurementBlocks";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import { orderElementResults, isPositiveMeasurement } from "@/lib/rfaFixedElements";
import type { FormField } from "@/lib/api/formFields";

const field = (p: Partial<FormField>): FormField => ({
  id: p.id!, form_id: "f1", field_key: p.field_key!, display_name: p.display_name ?? p.field_key!,
  description: null, field_type: p.field_type ?? "number", category: null, unit: p.unit ?? null,
  is_required: false, default_value: null, validation: {}, min_value: null, max_value: null,
  decimal_places: null, readonly: false, formula: null, select_options: [], ref_target: null,
  parent_field_id: p.parent_field_id ?? null, sort_order: 0, metadata: p.metadata ?? {},
  global_field_id: null, binding_path: null, is_result: p.is_result ?? false,
  result_label: p.result_label ?? null, created_at: "", updated_at: "",
});

const block = field({ id: "b1", field_key: "messungen", field_type: "measurement_block" });
const importField = field({ id: "imp", field_key: "import", field_type: "measurement_import", parent_field_id: "b1", metadata: { block_role: "value" } });

const standardlos: CaseTemplate = {
  id: "c-standardlos", name: "Standardlos", element_range: "B-U",
  elements: [], instances: [{ id: "i1", label: "Messung", context: {} }],
};

describe("Standardlos/Oberfläche: Ergebnisse speichern und anzeigen", () => {
  it("dynamische Elemente > 0 werden zu echten Ergebnissen mit originaler Einheit", () => {
    const entry = buildEntriesFromCase(standardlos, [
      { field_key: "import", field_type: "measurement_import", role: "value" } as any,
    ])[0];
    entry[elementValueKey("SiO2")] = 8.2;
    entry[elementValueKey("As")] = 452;
    entry[elementValueKey("Rb")] = 0.014;
    entry[elementValueKey("ZrO2")] = 0;
    entry.import = JSON.stringify({
      imported_at: "2026-09-09T06:00:00.000Z",
      units: { [elementValueKey("SiO2")]: "%", [elementValueKey("As")]: "ppm", [elementValueKey("Rb")]: "%" },
    });

    const official = buildLinkedFormResultCandidates("f1", [block, importField], [], {
      "form:f1:messungen": [entry],
    }).filter((c) => c.official);

    expect(official.slice(0, 17).map((c) => c.key.split("element:")[1])).toEqual([
      "SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O",
      "SO3", "P2O5", "V2O5", "WO3", "MoO3", "As", "Pb", "Nb",
    ]);
    expect(official.slice(17).map((c) => c.label)).toEqual(["Rb"]);
    expect(official.find((c) => c.label === "As")!.unit).toBe("ppm");
    expect(official.find((c) => c.label === "Rb")!.unit).toBe("%");
    expect(official.find((c) => c.key.endsWith("element:SiO2"))!.value).toBe(8.2);
    // Werte, die gespeichert werden (nicht leer)
    expect(official.filter((c) => c.value != null).length).toBe(3);
  });

  it("Ergebnisdatenbank sortiert Elemente: 17 Standard zuerst, danach Ordnungszahl", () => {
    const rows = [
      { result_name: "a", display_label: "Rb" },
      { result_name: "b", display_label: "SiO2" },
      { result_name: "c", display_label: "Tl" },
      { result_name: "d", display_label: "As" },
      { result_name: "e", display_label: "SrO" },
    ];
    expect(orderElementResults(rows).map((r) => r.display_label)).toEqual(["SiO2", "As", "Rb", "SrO", "Tl"]);
  });

  it("Nicht-chemische Ergebnisse bleiben an ihrer Position", () => {
    const rows = [
      { result_name: "x", display_label: "Feuchte" },
      { result_name: "b", display_label: "Al2O3" },
      { result_name: "a", display_label: "SiO2" },
    ];
    expect(orderElementResults(rows).map((r) => r.display_label)).toEqual(["Feuchte", "SiO2", "Al2O3"]);
  });

  it("Wert-Prüfung erfolgt numerisch", () => {
    expect(isPositiveMeasurement("0,000")).toBe(false);
    expect(isPositiveMeasurement("0,014")).toBe(true);
    expect(isPositiveMeasurement(452)).toBe(true);
    expect(isPositiveMeasurement(null)).toBe(false);
    expect(isPositiveMeasurement("")).toBe(false);
  });
});
