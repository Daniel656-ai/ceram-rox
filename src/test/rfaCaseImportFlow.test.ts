import { describe, expect, it } from "vitest";
import {
  buildEntriesFromCase, elementValueKey, type CaseTemplate,
} from "@/lib/measurementBlocks";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import {
  buildCaseTargets, mapReadings, outputValue, openTargets, rowStatus, withDynamicTargets,
  type TargetCandidate,
} from "@/lib/measurementImport";
import { parseElementRange, elementInRange } from "@/lib/elementKeys";
import type { FormField } from "@/lib/api/formFields";

/**
 * Durchgängiger Ablauf: Messfall → Ergebnis-Elemente → Zielliste → Import →
 * Übernahme in die Messung → Ergebnis-Kandidaten (Speicherung).
 * Der Import besitzt KEINE eigene Elementliste; nur die Messfall-
 * Konfiguration bestimmt Anzahl und Reihenfolge der offiziellen Ergebnisse.
 */

const QK = ["SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "K2O"];
const KAL = [
  "SiO2", "Al2O3", "Fe2O3", "TiO2", "CaO", "MgO", "BaO", "Na2O", "K2O",
  "SO3", "P2O5", "V2O5", "WO3", "MoO3", "As", "Pb", "Nb",
];
const IMPORT20 = [...KAL, "ZrO2", "Cr2O3", "MnO"];

const field = (p: Partial<FormField>): FormField => ({
  id: p.id!, form_id: "f1", field_key: p.field_key!, display_name: p.display_name ?? p.field_key!,
  description: null, field_type: p.field_type ?? "number", category: null, unit: p.unit ?? null,
  is_required: false, default_value: null, validation: {}, min_value: null, max_value: null,
  decimal_places: null, readonly: false, formula: null, select_options: [], ref_target: null,
  parent_field_id: p.parent_field_id ?? null, sort_order: 0, metadata: p.metadata ?? {},
  global_field_id: null, binding_path: null, is_result: p.is_result ?? false,
  result_label: p.result_label ?? null, created_at: "", updated_at: "",
});

const block = field({ id: "b1", field_key: "messungen", field_type: "measurement_block", metadata: {} });
/** Das Formular besitzt bewusst NUR 3 Elementfelder – der Messfall darf mehr fordern. */
const formChildren = ["SiO2", "Al2O3", "Fe2O3"].map((k, i) =>
  field({
    id: `c${i}`, field_key: `${k.toLowerCase()}_percent`, display_name: k, unit: "%",
    parent_field_id: "b1", metadata: { block_role: "value", element_key: k },
  })
);
const importField = field({ id: "imp", field_key: "import", field_type: "measurement_import", parent_field_id: "b1", metadata: { block_role: "value" } });
const childDefs = [...formChildren, importField].map((c) => ({
  field_key: c.field_key, field_type: c.field_type, role: "value" as const,
}));
const formTargets: TargetCandidate[] = formChildren.map((c) => ({
  field_key: c.field_key, display_name: c.display_name, unit: c.unit, element_key: (c.metadata as any).element_key,
}));

const makeCase = (elements: string[], range: string | null = null): CaseTemplate => ({
  id: "case-1", name: "Messfall", element_range: range,
  elements: elements.map((k) => ({ element_key: k, is_official: true })),
  instances: [{ id: "i1", label: "Messung", context: { messmethode: "RFA" } }],
});

const reading = (name: string, i: number) => ({
  sourceName: `${name} (%)`, raw: `${i + 1},5`, value: i + 1.5, unit: null, belowDetection: false,
});

/** Simuliert den vollständigen Ablauf wie im Formular (MeasurementImportControl + onApply). */
function runFlow(caseElements: string[], imported: string[], range: string | null = null) {
  const caseDef = makeCase(caseElements, range);
  const entries = buildEntriesFromCase(caseDef, childDefs);
  const entry = entries[0];
  const spec = (entry.__case_element_spec as Array<{ key: string; label: string }>) ?? [];
  const targets = buildCaseTargets(spec, formTargets, range);
  const rows = mapReadings(imported.map(reading), null, targets, {
    caseElementKeys: spec.map((s) => s.key), elementRange: range,
  });
  const allTargets = withDynamicTargets(rows, targets);
  // onApply: zugeordnete Werte in die Messung schreiben
  for (const r of rows) {
    if (!r.targetFieldKey) continue;
    const v = outputValue(r);
    if (v != null) entry[r.targetFieldKey] = v;
  }
  const candidates = buildLinkedFormResultCandidates("f1", [block, ...formChildren, importField], [], {
    "form:f1:messungen": entries,
  });
  return { rows, targets, allTargets, entry, candidates, official: candidates.filter((c) => c.official) };
}

describe("RFA: Messfall → Import → Ergebnis (Akzeptanztests)", () => {
  it("Test A: Qualitätskontrolle 7 Elemente, Import 17 → 7 Ergebnisse in Messfall-Reihenfolge", () => {
    const { rows, official } = runFlow(QK, KAL);
    expect(rows.filter((r) => rowStatus(r) === "assigned")).toHaveLength(7);
    expect(rows.filter((r) => rowStatus(r) === "not_needed")).toHaveLength(10);
    expect(official).toHaveLength(7);
    expect(official.map((c) => c.label)).toEqual(QK);
    expect(official.every((c) => c.value != null)).toBe(true);
    // Elemente ohne Formularfeld werden trotzdem gespeichert (element:<Key>)
    expect(official.find((c) => c.label === "K2O")!.key).toContain(elementValueKey("K2O"));
  });

  it("Test B: Kalibrierte Elemente 17, Import 17 → 17 Ergebnisse", () => {
    const { official } = runFlow(KAL, KAL);
    expect(official).toHaveLength(17);
    expect(official.map((c) => c.label)).toEqual(KAL);
    expect(official.every((c) => c.value != null)).toBe(true);
  });

  it("Test C: Standardlos „B-U“ ohne feste Liste → alle Bereichs-Elemente des Imports", () => {
    const imported = ["B2O3", "Na2O", "SiO2", "Fe2O3", "As", "Pb", "U", "LOI", "H2O"];
    const { rows, official, allTargets } = runFlow([], imported, "B-U");
    // Bereichszuordnung dynamisch (kein Formularfeld nötig)
    expect(rows.find((r) => r.sourceName.startsWith("Pb"))!.targetFieldKey).toBe(elementValueKey("Pb"));
    expect(allTargets.some((t) => t.field_key === elementValueKey("Pb"))).toBe(true);
    // LOI (kein Element) und H2O (Leitelement H, Z=1) liegen außerhalb
    expect(rows.find((r) => r.sourceName.startsWith("LOI"))!.targetFieldKey).toBeNull();
    expect(rows.find((r) => r.sourceName.startsWith("H2O"))!.targetFieldKey).toBeNull();
    // Importierte Bereichs-Elemente nach Ordnungszahl; das (leere) Formularfeld
    // Al2O3 bleibt als Position erhalten, wird ohne Wert aber nicht gespeichert.
    expect(official.map((c) => c.label)).toEqual(["B₂O₃", "Na₂O", "Al2O3", "SiO2", "Fe2O3", "As", "Pb", "U"]);
    expect(official.filter((c) => c.value != null).map((c) => c.label))
      .toEqual(["B₂O₃", "Na₂O", "SiO2", "Fe2O3", "As", "Pb", "U"]);
  });

  it("Test D: Messfall 17, Import 16 → 16 gespeichert, 1 leere Position, kein Abbruch", () => {
    const imported = KAL.filter((k) => k !== "Nb");
    const { rows, targets, official } = runFlow(KAL, imported);
    expect(openTargets(rows, targets).map((t) => t.element_key)).toEqual(["Nb"]);
    expect(official).toHaveLength(17);
    expect(official.filter((c) => c.value != null)).toHaveLength(16);
    const nb = official.find((c) => c.label === "Nb")!;
    expect(nb.value).toBeNull();
  });

  it("Test E: Messfall 7, Import 20 → nur 7 offizielle Ergebnisse, keine neuen Felder", () => {
    const { official, candidates, entry } = runFlow(QK, IMPORT20);
    expect(official).toHaveLength(7);
    // Nicht konfigurierte Elemente erzeugen keine Ergebnisse
    expect(candidates.some((c) => c.label === "ZrO2" || c.label === "ZrO₂")).toBe(false);
    expect(Object.keys(entry).filter((k) => k.startsWith("element:"))).toHaveLength(4); // QK ohne SiO2/Al2O3/Fe2O3
  });

  it("Wiederholter Import derselben Messung aktualisiert bestehende Schlüssel (keine Duplikate)", () => {
    const a = runFlow(QK, KAL);
    const keys = a.official.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    // zweiter Import in dieselbe Messung
    const spec = a.entry.__case_element_spec as Array<{ key: string; label: string }>;
    const rows = mapReadings(KAL.map((k, i) => reading(k, i + 10)), null, buildCaseTargets(spec, formTargets), {
      caseElementKeys: QK,
    });
    for (const r of rows) if (r.targetFieldKey) a.entry[r.targetFieldKey] = outputValue(r);
    const again = buildLinkedFormResultCandidates("f1", [block, ...formChildren, importField], [], {
      "form:f1:messungen": [a.entry],
    }).filter((c) => c.official);
    expect(again.map((c) => c.key)).toEqual(keys);
    expect(again.find((c) => c.label === "SiO2")!.value).toBe(11.5);
  });

  it("Änderung im Messfall (7 → 8 Elemente) wirkt ohne Code-Änderung am Import", () => {
    const { official } = runFlow([...QK, "V2O5"], KAL);
    expect(official).toHaveLength(8);
    expect(official.at(-1)!.label).toBe("V2O5");
  });

  it("Elementbereich: Leitelement entscheidet, Formate werden toleriert", () => {
    const r = parseElementRange("B – U")!;
    expect([r.fromSymbol, r.toSymbol]).toEqual(["B", "U"]);
    expect(elementInRange("V2O5", r)).toBe(true);
    expect(elementInRange("Na2O", r)).toBe(true);
    expect(elementInRange("Li", r)).toBe(false);
    expect(parseElementRange("xyz")).toBeNull();
  });
});
