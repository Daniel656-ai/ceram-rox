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
      { result_name: "y", display_label: "Porenvolumen (Mittelwert)" },
      { result_name: "b", display_label: "Al2O3" },
      { result_name: "a", display_label: "SiO2" },
    ];
    expect(orderElementResults(rows).map((r) => r.display_label)).toEqual([
      "Feuchte", "Porenvolumen (Mittelwert)", "SiO2", "Al2O3",
    ]);
  });

  it("Wert-Prüfung erfolgt numerisch", () => {
    expect(isPositiveMeasurement("0,000")).toBe(false);
    expect(isPositiveMeasurement("0,014")).toBe(true);
    expect(isPositiveMeasurement(452)).toBe(true);
    expect(isPositiveMeasurement(null)).toBe(false);
    expect(isPositiveMeasurement("")).toBe(false);
  });
});

/**
 * Messfälle ohne gepflegten Elementbereich: „Standardlos“/„Oberfläche“ – auch
 * als Messung der Messfallsteuerung „Externe Analyse“ – erzeugen immer die 17
 * Standardelemente und danach die zusätzlich gemessenen Elemente (> 0).
 */
describe("Standardlos/Oberfläche ohne gepflegten Elementbereich", () => {
  const childDefs = [{ field_key: "import", field_type: "measurement_import", role: "value" as const }];
  const run = (c: CaseTemplate, extra: Record<string, unknown>) => {
    const entry = buildEntriesFromCase(c, childDefs as any)[0];
    Object.assign(entry, extra);
    return buildLinkedFormResultCandidates("f1", [block, importField], [], {
      "form:f1:messungen": [entry],
    }).filter((x) => x.official);
  };
  const measured = {
    [elementValueKey("SiO2")]: 8.2,
    [elementValueKey("As")]: 452,
    [elementValueKey("Rb")]: 0.014,
    [elementValueKey("SrO")]: 0.049,
    [elementValueKey("ZrO2")]: 0.31,
    [elementValueKey("Tl")]: 0.002,
    [elementValueKey("Cr2O3")]: 0,
  };
  const first17 = [
    "SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O",
    "SO3", "P2O5", "V2O5", "WO3", "MoO3", "As", "Pb", "Nb",
  ];

  it("Messfall „RFA – Standardlos“ ohne Bereich: 17 fest + zusätzliche > 0", () => {
    const official = run(
      { id: "c1", name: "RFA – Standardlos", element_range: null, elements: [], instances: [{ id: "i1", label: "Messung", context: {} }] },
      measured,
    );
    expect(official.slice(0, 17).map((c) => c.key.split("element:")[1])).toEqual(first17);
    expect(official.slice(17).map((c) => c.label)).toEqual(["Rb", "SrO", "ZrO₂", "Tl"]);
  });

  it("Messfall „RFA – Oberfläche“ ohne Bereich verhält sich gleich", () => {
    const official = run(
      { id: "c2", name: "RFA – Oberfläche", element_range: null, elements: [], instances: [{ id: "i1", label: "Messung", context: {} }] },
      measured,
    );
    expect(official).toHaveLength(21);
  });

  it("„Externe Analyse“: nur die Messung „Standardlos“ ist dynamisch, „Kalibriert“ nicht", () => {
    const externe: CaseTemplate = {
      id: "c3", name: "Externe Analyse", element_range: null,
      elements: [{ element_key: "SiO2", is_official: true }, { element_key: "Al2O3", is_official: true }],
      instances: [
        { id: "i1", label: "Standardlos", context: {} },
        { id: "i2", label: "Kalibriert", context: {} },
      ],
    };
    const entries = buildEntriesFromCase(externe, childDefs as any);
    Object.assign(entries[0], measured);
    Object.assign(entries[1], { [elementValueKey("SiO2")]: 8.2, [elementValueKey("Rb")]: 0.014 });
    const official = buildLinkedFormResultCandidates("f1", [block, importField], [], {
      "form:f1:messungen": entries,
    }).filter((c) => c.official);
    const std = official.filter((c) => c.instanceLabel === "Standardlos");
    const kal = official.filter((c) => c.instanceLabel === "Kalibriert");
    expect(std.slice(0, 17).map((c) => c.key.split("element:")[1])).toEqual(first17);
    expect(std.slice(17).map((c) => c.label)).toEqual(["Rb", "SrO", "ZrO₂", "Tl"]);
    // Kalibriert bleibt bei der konfigurierten Ergebnisliste
    expect(kal.map((c) => c.label)).toEqual(["SiO₂", "Al₂O₃"]);
  });

  it("Qualitätskontrolle bleibt unverändert bei ihrer konfigurierten Liste", () => {
    const official = run(
      {
        id: "c4", name: "RFA – Qualitätskontrolle", element_range: null,
        elements: ["SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "V2O5"].map((k) => ({ element_key: k, is_official: true })),
        instances: [{ id: "i1", label: "Messung", context: {} }],
      },
      measured,
    );
    expect(official).toHaveLength(7);
  });
});
