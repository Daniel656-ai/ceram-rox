import { describe, expect, it } from "vitest";
import {
  INSTANCE_ID_KEY, INSTANCE_LABEL_KEY, CASE_ELEMENT_SPEC_KEY, elementValueKey,
} from "@/lib/measurementBlocks";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import {
  buildCaseTargets, mapReadings, outputValue, rowStatus, type TargetCandidate,
} from "@/lib/measurementImport";
import { isRfaService, RFA_FIXED_ELEMENTS } from "@/lib/rfaFixedElements";
import type { FormField } from "@/lib/api/formFields";

/**
 * Reguläre RFA ohne ausdrücklichen Messfall: die vollständige 17er-
 * Standardliste gilt automatisch (Freigabe „Vollständige Übernahme der 17
 * RFA-Ergebnisse“). Explizite Messfälle und Bereiche behalten Vorrang.
 */

const KAL = RFA_FIXED_ELEMENTS.map((e) => e.key);

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
/** Wie im Produktivformular: nur 3 physische Elementfelder. */
const formChildren = ["SiO2", "Al2O3", "Fe2O3"].map((k, i) =>
  field({
    id: `c${i}`, field_key: `${k.toLowerCase()}_percent`, display_name: k, unit: "%",
    parent_field_id: "b1", metadata: { block_role: "value", element_key: k },
  })
);
const importField = field({ id: "imp", field_key: "import", field_type: "measurement_import", parent_field_id: "b1", metadata: { block_role: "value" } });
const formTargets: TargetCandidate[] = formChildren.map((c) => ({
  field_key: c.field_key, display_name: c.display_name, unit: c.unit, element_key: (c.metadata as any).element_key,
}));

const reading = (name: string, value: number) => ({
  sourceName: `${name} (%)`, raw: String(value).replace(".", ","), value, unit: null, belowDetection: false,
});

/** Reguläre RFA-Messung ohne Messfall: Import → Übernahme → Ergebniskandidaten. */
function runRegularRfa(imported: Array<{ key: string; value: number }>, instanceId = "m1") {
  const targets = buildCaseTargets([], formTargets, null, true);
  const rows = mapReadings(imported.map((r) => reading(r.key, r.value)), null, targets, {});
  const entry: Record<string, unknown> = { [INSTANCE_ID_KEY]: instanceId, [INSTANCE_LABEL_KEY]: "Messung 1" };
  for (const r of rows) {
    if (!r.targetFieldKey) continue;
    const v = outputValue(r);
    if (v != null) entry[r.targetFieldKey] = v;
  }
  const candidates = buildLinkedFormResultCandidates(
    "f1", [block, ...formChildren, importField], [],
    { "form:f1:messungen": [entry] }, [],
    { rfaDefault: true },
  );
  return { targets, rows, entry, candidates, official: candidates.filter((c) => c.official) };
}

describe("RFA-Standardfallback: reguläre RFA ohne Messfall", () => {
  it("erkennt RFA über die zentrale Dienstleistungsklassifizierung", () => {
    expect(isRfaService("RFA")).toBe(true);
    expect(isRfaService("Röntgenfluoreszenzanalyse")).toBe(true);
    expect(isRfaService("XRF")).toBe(true);
    expect(isRfaService("BET-Oberfläche")).toBe(false);
    expect(isRfaService("NOx-Messung")).toBe(false);
    expect(isRfaService(null)).toBe(false);
    expect(isRfaService(undefined)).toBe(false);
  });

  it("Test 1+2: importiert alle 17 Elemente, keines landet in unassigned", () => {
    const { targets, rows, official } = runRegularRfa(KAL.map((key, i) => ({ key, value: i + 1.5 })));
    expect(targets).toHaveLength(17);
    expect(rows.filter((r) => rowStatus(r) === "assigned")).toHaveLength(17);
    expect(rows.filter((r) => rowStatus(r) === "not_needed")).toHaveLength(0);
    expect(rows.every((r) => r.targetFieldKey)).toBe(true);
    expect(official).toHaveLength(17);
    expect(official.every((c) => c.value != null)).toBe(true);
  });

  it("Test 8: die drei physischen Formularfelder bleiben Ziele und behalten ihren Schlüssel", () => {
    const { targets, rows, entry } = runRegularRfa(KAL.map((key, i) => ({ key, value: i + 1.5 })));
    for (const k of ["sio2_percent", "al2o3_percent", "fe2o3_percent"]) {
      expect(targets.some((t) => t.field_key === k)).toBe(true);
      expect(typeof entry[k]).toBe("number");
    }
    expect(rows.find((r) => r.sourceName.startsWith("SiO2"))!.targetFieldKey).toBe("sio2_percent");
    expect(rows.find((r) => r.sourceName.startsWith("Al2O3"))!.targetFieldKey).toBe("al2o3_percent");
    expect(rows.find((r) => r.sourceName.startsWith("Fe2O3"))!.targetFieldKey).toBe("fe2o3_percent");
  });

  it("Test 9: die übrigen 14 Elemente werden als virtuelle element:<Key>-Werte gespeichert und angezeigt", () => {
    const virtual = KAL.filter((k) => !["SiO2", "Al2O3", "Fe2O3"].includes(k));
    const { entry, official } = runRegularRfa(KAL.map((key, i) => ({ key, value: i + 1.5 })));
    for (const k of virtual) expect(typeof entry[elementValueKey(k)]).toBe("number");
    const labels = official.map((c) => c.label);
    for (const k of virtual) expect(labels.some((l) => l.replace(/[₀-₉]/g, "").includes(k.replace(/[0-9]/g, "")))).toBe(true);
    // Einheiten der festen Struktur bleiben erhalten (As/Pb in ppm)
    expect(official.find((c) => c.label === "As")!.unit).toBe("ppm");
    expect(official.find((c) => c.label === "Pb")!.unit).toBe("ppm");
  });

  it("Test 3: ein ausdrücklich eingeschränkter Messfall bleibt eingeschränkt (Vorrang vor dem Fallback)", () => {
    const spec = ["SiO2", "Al2O3", "Fe3O4"].map((k) => ({ key: k, label: k }));
    const targets = buildCaseTargets(spec, formTargets, null, true);
    expect(targets.map((t) => t.element_key ?? t.field_key)).toEqual(["SiO2", "Al2O3", "Fe3O4"]);
    const rows = mapReadings(KAL.map((k, i) => reading(k, i + 1.5)), null, targets, {});
    expect(rows.filter((r) => rowStatus(r) === "assigned")).toHaveLength(2); // SiO2, Al2O3
    expect(rows.filter((r) => rowStatus(r) === "not_needed")).toHaveLength(15);
  });

  it("Test 4: Bereichs-Messfall („Standardlos“) behält sein bisheriges Verhalten", () => {
    const targets = buildCaseTargets([], formTargets, "B-U", true);
    // Feste 17er-Struktur wie bisher
    expect(targets.slice(0, 17).map((t) => t.element_key)).toEqual(KAL);
    const rows = mapReadings([reading("ZrO2", 1.2), reading("SiO2", 55)], null, targets, { elementRange: "B-U" });
    expect(rows.find((r) => r.sourceName.startsWith("ZrO2"))!.targetFieldKey).toBe(elementValueKey("ZrO2"));
    expect(rows.find((r) => r.sourceName.startsWith("SiO2"))!.targetFieldKey).toBe("sio2_percent");
  });

  it("Test 5: Zahlenwert 0 ist ein gültiger Messwert und wird übernommen", () => {
    const { official } = runRegularRfa([
      ...KAL.filter((k) => k !== "TiO2").map((key, i) => ({ key, value: i + 1.5 })),
      { key: "TiO2", value: 0 },
    ]);
    const tio2 = official.find((c) => c.key.includes(elementValueKey("TiO2")))!;
    expect(tio2.value).toBe(0);
    expect(tio2.official).toBe(true);
  });

  it("Test 6: fehlende Importwerte erzeugen keine künstlichen Nullwerte", () => {
    const imported = KAL.filter((k) => k !== "Nb" && k !== "Pb").map((key, i) => ({ key, value: i + 1.5 }));
    const { entry, official } = runRegularRfa(imported);
    expect(entry[elementValueKey("Nb")]).toBeUndefined();
    expect(entry[elementValueKey("Pb")]).toBeUndefined();
    const nb = official.find((c) => c.key.includes(elementValueKey("Nb")))!;
    const pb = official.find((c) => c.key.includes(elementValueKey("Pb")))!;
    expect(nb.value).toBeNull();
    expect(pb.value).toBeNull();
    expect(official.filter((c) => c.value != null)).toHaveLength(15);
  });

  it("Test 7: mehrere Messinstanzen überschreiben sich nicht gegenseitig", () => {
    const a = runRegularRfa(KAL.map((key, i) => ({ key, value: i + 1 })), "m1");
    const b = runRegularRfa(KAL.map((key, i) => ({ key, value: i + 101 })), "m2");
    const candidates = buildLinkedFormResultCandidates(
      "f1", [block, ...formChildren, importField], [],
      { "form:f1:messungen": [a.entry, b.entry] }, [],
      { rfaDefault: true },
    );
    const official = candidates.filter((c) => c.official);
    expect(official).toHaveLength(34);
    const keys = official.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    const sio2M1 = official.find((c) => c.instanceKey === "m1" && c.label === "SiO2")!;
    const sio2M2 = official.find((c) => c.instanceKey === "m2" && c.label === "SiO2")!;
    expect(sio2M1.value).toBe(1);
    expect(sio2M2.value).toBe(101);
  });

  it("Test 10: alle tatsächlich vorhandenen offiziellen RFA-Ergebnisse sind für die Ergebnisdatenbank sichtbar", () => {
    const { candidates } = runRegularRfa(KAL.map((key, i) => ({ key, value: i + 1.5 })));
    // Die Ergebnisdatenbank filtert is_official === true: alle 17 Werte passieren.
    const visible = candidates.filter((c) => c.official && c.value != null);
    expect(visible).toHaveLength(17);
    // Kein inoffizielles Duplikat desselben Elements
    const names = visible.map((c) => c.key);
    expect(new Set(names).size).toBe(17);
  });

  it("ohne rfaDefault bleibt das bisherige Verhalten unverändert (nur Formularfelder)", () => {
    const targets = buildCaseTargets([], formTargets, null, false);
    expect(targets).toHaveLength(3);
    const rows = mapReadings(KAL.map((k, i) => reading(k, i + 1.5)), null, targets, {});
    expect(rows.filter((r) => rowStatus(r) === "assigned")).toHaveLength(3);
    // Ohne Fallback erzeugt derselbe Datenstand nur 3 offizielle Ergebnisse.
    const entry: Record<string, unknown> = {
      [INSTANCE_ID_KEY]: "m1", [INSTANCE_LABEL_KEY]: "Messung 1",
      sio2_percent: 1.5, al2o3_percent: 2.5, fe2o3_percent: 3.5,
    };
    const official = buildLinkedFormResultCandidates(
      "f1", [block, ...formChildren, importField], [],
      { "form:f1:messungen": [entry] },
    ).filter((c) => c.official);
    expect(official).toHaveLength(0); // Felder ohne is_result/Messfall sind nicht offiziell
  });

  it("explizite Messfall-Spezifikation am Eintrag hat Vorrang vor dem Fallback", () => {
    const entry: Record<string, unknown> = {
      [INSTANCE_ID_KEY]: "m1", [INSTANCE_LABEL_KEY]: "Messung 1",
      [CASE_ELEMENT_SPEC_KEY]: [{ key: "SiO2", label: "SiO2", official: true }],
      sio2_percent: 55.2,
      [elementValueKey("TiO2")]: 0.8,
    };
    const official = buildLinkedFormResultCandidates(
      "f1", [block, ...formChildren, importField], [],
      { "form:f1:messungen": [entry] }, [],
      { rfaDefault: true },
    ).filter((c) => c.official);
    expect(official.map((c) => c.label)).toEqual(["SiO2"]);
  });
});
