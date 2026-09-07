import { describe, expect, it } from "vitest";
import { buildEntriesFromCase, type CaseTemplate } from "@/lib/measurementBlocks";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import type { FormField } from "@/lib/api/formFields";

const QK = ["SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "V2O5"];
const KAL = [
  "SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O",
  "SO3", "P2O5", "V2O5", "WO3", "MoO3", "As", "Pb", "Nb",
];
/** Unterkategorie des Messdatenimports – darf die Ergebnisanzahl NICHT bestimmen. */
const SUBCATEGORY = ["SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O", "SO3"];

const field = (p: Partial<FormField>): FormField => ({
  id: p.id!, form_id: "f1", field_key: p.field_key!, display_name: p.display_name ?? p.field_key!,
  description: null, field_type: p.field_type ?? "number", category: null, unit: null,
  is_required: false, default_value: null, validation: {}, min_value: null, max_value: null,
  decimal_places: null, readonly: false, formula: null, select_options: [], ref_target: null,
  parent_field_id: p.parent_field_id ?? null, sort_order: 0, metadata: p.metadata ?? {},
  global_field_id: null, binding_path: null, is_result: p.is_result ?? false,
  result_label: p.result_label ?? null, created_at: "", updated_at: "",
});

const block = field({ id: "b1", field_key: "messungen", field_type: "measurement_block", metadata: {} });

/** Ergebnisfelder des Formulars: bewusst alle Elemente der Importdatei. */
const children = KAL.map((k, i) =>
  field({
    id: `c${i}`, field_key: `${k.toLowerCase()}_percent`, display_name: k,
    parent_field_id: "b1", metadata: { block_role: "value", element_key: k },
  })
);

const makeCase = (elements: string[]): CaseTemplate => ({
  id: "case-1",
  name: "Messfall",
  elements: elements.map((k) => ({ element_key: k, is_official: true })),
  instances: [
    { id: "i1", label: "Kalibriert", context: Object.fromEntries(SUBCATEGORY.map((k) => [k, ""])) },
  ],
});

/** Erzeugt die Messungen aus dem Messfall und füllt alle importierten Werte. */
const run = (caseElements: string[], imported: string[]) => {
  const entries = buildEntriesFromCase(makeCase(caseElements), children.map((c) => ({
    field_key: c.field_key, field_type: c.field_type, role: "value" as const,
  })));
  for (const k of imported) entries[0][`${k.toLowerCase()}_percent`] = 1.23;
  return buildLinkedFormResultCandidates("f1", [block, ...children], [], {
    "form:f1:messungen": entries,
  });
};

describe("Anzahl offizieller Ergebnisse = Ergebnis-Elemente des Messfalls", () => {
  it("Test A: Messfall 7 Elemente, Unterkategorie 10 → 7 Ergebnisse", () => {
    const official = run(QK, KAL).filter((c) => c.official);
    expect(official).toHaveLength(7);
    expect(official.map((c) => c.label)).toEqual(QK);
  });

  it("Test B: Messfall 17 Elemente, Unterkategorie 10 → 17 Ergebnisse", () => {
    const official = run(KAL, KAL).filter((c) => c.official);
    expect(official).toHaveLength(17);
    expect(official.map((c) => c.label)).toEqual(KAL);
  });

  it("Test C: 17 importierte Elemente, Messfall 7 → 7 offizielle Ergebnisse", () => {
    const all = run(QK, KAL);
    expect(all.filter((c) => c.value != null)).toHaveLength(17);
    expect(all.filter((c) => c.official)).toHaveLength(7);
  });

  it("Test E: geänderte Reihenfolge im Messfall wirkt direkt in der Anzeige", () => {
    const order = ["V2O5", ...QK.filter((k) => k !== "V2O5")];
    expect(run(order, KAL).filter((c) => c.official).map((c) => c.label)).toEqual(order);
  });
});
