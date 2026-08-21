import { describe, it, expect } from "vitest";
import { readInstances, readMeasurementBlockMeta } from "@/lib/measurementBlocks";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import type { FormField } from "@/lib/api/formFields";

const field = (p: Partial<FormField>): FormField => ({
  id: p.id!, form_id: "f1", field_key: p.field_key!, display_name: p.display_name ?? p.field_key!,
  description: null, field_type: p.field_type ?? "number", category: null, unit: null,
  is_required: false, default_value: null, validation: {}, min_value: null, max_value: null,
  decimal_places: null, readonly: false, formula: null, select_options: [], ref_target: null,
  parent_field_id: p.parent_field_id ?? null, sort_order: 0, metadata: p.metadata ?? {},
  global_field_id: null, binding_path: null, is_result: p.is_result ?? false,
  result_label: p.result_label ?? null, created_at: "", updated_at: "",
});

const block = field({
  id: "b1", field_key: "messungen", display_name: "Messungen", field_type: "measurement_block",
  metadata: { measurement_block: { context_fields: [{ key: "preparation", label: "Präparation", type: "text" }] } },
});
const sio2 = field({ id: "c1", field_key: "sio2", display_name: "SiO2", parent_field_id: "b1", is_result: true });

describe("Messdatenblock", () => {
  it("liest Messungen inkl. Kontext und Bezeichnung", () => {
    const meta = readMeasurementBlockMeta(block);
    const instances = readInstances(
      [
        { __instance_id: "a", __label: "Kalibriert", __context: { preparation: "gemahlen" }, sio2: 12 },
        { __instance_id: "b", __context: { preparation: "Standardlos" }, sio2: 13 },
      ],
      meta
    );
    expect(instances.map((i) => i.label)).toEqual(["Kalibriert", "Standardlos"]);
    expect(instances[0].values.sio2).toBe(12);
  });

  it("erzeugt je Messung eindeutige offizielle Ergebnisse", () => {
    const candidates = buildLinkedFormResultCandidates(
      "f1",
      [block, sio2],
      [],
      {
        "form:f1:messungen": [
          { __instance_id: "a", __label: "Messung 1", __context: {}, sio2: 12 },
          { __instance_id: "b", __label: "Messung 2", __context: {}, sio2: 13 },
        ],
      }
    );
    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(2);
    expect(new Set(official.map((c) => c.key)).size).toBe(2);
    expect(official.map((c) => c.value)).toEqual([12, 13]);
    expect(official.map((c) => c.instanceLabel)).toEqual(["Messung 1", "Messung 2"]);
  });
});
