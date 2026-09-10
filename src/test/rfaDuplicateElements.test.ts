import { describe, expect, it } from "vitest";
import { buildEntriesFromCase, elementValueKey, readCaseElementSpec, type CaseTemplate } from "@/lib/measurementBlocks";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import { buildCaseTargets, mapReadings, outputValue, type TargetCandidate } from "@/lib/measurementImport";
import type { FormField } from "@/lib/api/formFields";

/**
 * Derselbe chemische Parameter darf – unabhängig von der Schreibweise in der
 * RFA-Datei oder im Messfall – nur EIN Ergebnis erzeugen und muss mit seinem
 * Wert in die Ergebnisspeicherung gelangen.
 */

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
const importField = field({
  id: "imp", field_key: "import", field_type: "measurement_import",
  parent_field_id: "b1", metadata: { block_role: "value" },
});
const childDefs = [importField].map((c) => ({
  field_key: c.field_key, field_type: c.field_type, role: "value" as const,
}));

/** Messfall „Qualitätskontrolle“ – bewusst mit gemischten Schreibweisen. */
const caseDef: CaseTemplate = {
  id: "c1", name: "Qualitätskontrolle", element_range: null,
  elements: [
    { element_key: "K2O", is_official: true },
    { element_key: "K₂O", is_official: true },
    { element_key: "Na₂O", is_official: true },
    { element_key: "Na2O", is_official: true },
    { element_key: "WO3", is_official: true },
    { element_key: "P2O5", is_official: true },
  ],
  instances: [{ id: "i1", label: "Messung", context: { messmethode: "RFA" } }],
};

const reading = (name: string, raw: string) => ({
  sourceName: name, raw, value: Number(raw.replace(",", ".")), unit: "%", belowDetection: false,
});

describe("RFA: identische Parameter unterschiedlicher Schreibweise", () => {
  it("führt K2O und K₂O zu einem kanonischen Parameter zusammen", () => {
    const spec = readCaseElementSpec(
      (caseDef.elements ?? []).map((e) => ({ key: e.element_key, official: true }))
    );
    expect(spec.map((s) => s.key)).toEqual(["K2O", "Na2O", "WO3", "P2O5"]);
    expect(spec.map((s) => s.label)).toEqual(["K₂O", "Na₂O", "WO₃", "P₂O₅"]);
  });

  it("erzeugt je Parameter genau ein Ergebnis mit Wert und Einheit", () => {
    const entry = buildEntriesFromCase(caseDef, childDefs)[0];
    const spec = entry.__case_element_spec as Array<{ key: string; label: string }>;
    const formTargets: TargetCandidate[] = [];
    const targets = buildCaseTargets(spec, formTargets);
    expect(targets).toHaveLength(4);

    const rows = mapReadings(
      [reading("K2O (%)", "0,293"), reading("Na2O", "0,142"),
       reading("WO3", "4,87"), reading("P2O5", "0,034")],
      null, targets, { caseElementKeys: spec.map((s) => s.key) }
    );
    for (const r of rows) if (r.targetFieldKey) entry[r.targetFieldKey] = outputValue(r);

    expect(entry[elementValueKey("K2O")]).toBe(0.293);
    expect(entry[elementValueKey("Na2O")]).toBe(0.142);

    const official = buildLinkedFormResultCandidates("f1", [block, importField], [], {
      "form:f1:messungen": [entry],
    }).filter((c) => c.official);

    expect(official.map((c) => c.label)).toEqual(["K₂O", "Na₂O", "WO₃", "P₂O₅"]);
    expect(official.map((c) => c.value)).toEqual([0.293, 0.142, 4.87, 0.034]);
    expect(new Set(official.map((c) => c.key)).size).toBe(4);
  });
});
