import { describe, expect, it } from "vitest";
import {
  buildLinkedFormResultCandidates,
  buildServiceResultCandidates,
  collectStaleRepeaterInstanceKeys,
} from "@/lib/officialResults";
import { INSTANCE_ID_KEY } from "@/lib/measurementBlocks";
import type { FormField } from "@/lib/api/formFields";
import { formCalculation, formField, serviceField } from "./fixtures/resultCandidates";

/**
 * Ergänzt officialResults.test.ts, repeaterOfficialResults.test.ts,
 * repeaterCalculationResults.test.ts und die rfa*-Tests um Grenz- und
 * Fehlerfälle: Formular-Präfix, leere Eingaben, Messdatenblock ohne
 * Messfall-Element, Einheiten aus dem Import, doppelte Schlüssel, klassische
 * Formulare mit archivierten und verketteten Feldern.
 */

const FORM = "form-1";
const k = (key: string) => `form:${FORM}:${key}`;

const block = formField({
  id: "block-1",
  field_key: "messungen",
  display_name: "Messungen",
  field_type: "measurement_block",
});
const blockChild = (key: string, over: Partial<FormField> = {}) =>
  formField({ id: `bc-${key}`, field_key: key, parent_field_id: "block-1", ...over });

const repeater = (over: Partial<FormField> = {}) =>
  formField({
    id: "rep-1",
    field_key: "zeilen",
    display_name: "Zeilen",
    field_type: "repeater",
    metadata: { repeater: { item_label: "Zeile" } },
    ...over,
  });

describe("Ergebniskandidaten eines verknüpften Formulars: Grundverhalten", () => {
  it("liest nur Werte mit dem Präfix des eigenen Formulars und ignoriert fremde Formulare", () => {
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [formField({ field_key: "dichte", is_result: true })],
      [],
      { "form:form-2:dichte": 9.9, dichte: 8.8 },
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].key).toBe(k("dichte"));
    expect(candidates[0].value).toBeUndefined();
  });

  it("übernimmt Ergebnisbezeichnung vor Anzeigename, Einheit und offizielle Kennzeichnung je Feld", () => {
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [
        formField({ field_key: "rd", display_name: "Rohdichte", result_label: "Rohdichte (Ergebnis)", unit: "g/cm³", is_result: true }),
        formField({ field_key: "masse", display_name: "Masse", unit: "g" }),
      ],
      [],
      { [k("rd")]: 2.31, [k("masse")]: 12.5 },
    );
    expect(candidates).toEqual([
      expect.objectContaining({ key: k("rd"), label: "Rohdichte (Ergebnis)", unit: "g/cm³", value: 2.31, official: true, kind: "field" }),
      expect.objectContaining({ key: k("masse"), label: "Masse", unit: "g", value: 12.5, official: false, kind: "field" }),
    ]);
  });

  it("meldet einen Formelfehler einer Berechnung ohne Wert statt eines Zahlenwerts", () => {
    const [candidate] = buildLinkedFormResultCandidates(
      FORM,
      [],
      [formCalculation({ calc_key: "kaputt", formula: "1 + * 2", is_result: true })],
      {},
    );
    expect(candidate.kind).toBe("calculation");
    expect(candidate.value).toBeNull();
    expect(candidate.error).toEqual(expect.any(String));
    expect(candidate.error).not.toBe("");
  });

  it("führt doppelte Ergebnisschlüssel zusammen: der Wert gewinnt gegen die leere Position, offiziell bleibt offiziell", () => {
    // Feld und Berechnung mit demselben Schlüssel ergeben denselben Ergebnisnamen.
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [formField({ field_key: "summe", is_result: true })],
      [formCalculation({ calc_key: "summe", formula: "2 * 3", is_result: false })],
      { [k("summe")]: "" },
    );
    expect(candidates.filter((c) => c.key === k("summe"))).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ key: k("summe"), value: 6, official: true, kind: "calculation" });
  });

  it("behält bei doppelten Schlüsseln den ersten Wert, wenn beide Positionen gefüllt sind", () => {
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [formField({ field_key: "summe", is_result: false })],
      [formCalculation({ calc_key: "summe", formula: "2 * 3", is_result: true })],
      { [k("summe")]: 5 },
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ value: 5, official: true, kind: "field" });
  });
});

describe("Ergebniskandidaten eines Messdatenblocks", () => {
  it("erzeugt ohne gespeicherte Messungen weder Block- noch Unterfeld-Kandidaten", () => {
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [block, blockChild("dichte", { is_result: true })],
      [],
      {},
    );
    expect(candidates).toEqual([]);
  });

  it("führt Bezeichnungs-, Kontext- und Importfelder nicht als Ergebnisse, nur Messwertfelder", () => {
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [
        block,
        blockChild("name", { metadata: { block_role: "label" } }),
        blockChild("praep", { metadata: { block_role: "context" } }),
        blockChild("import", { field_type: "measurement_import" }),
        blockChild("dichte", { display_name: "Rohdichte", is_result: true }),
        blockChild("notiz", { display_name: "Notiz", field_type: "text" }),
      ],
      [],
      {
        [k("messungen")]: [
          { [INSTANCE_ID_KEY]: "m1", name: "Probe A", praep: "gemahlen", import: "{}", dichte: 2.4, notiz: "ok" },
        ],
      },
    );
    expect(candidates.map((c) => c.key)).toEqual([
      k("messungen[m1].dichte"),
      k("messungen[m1].notiz"),
    ]);
    expect(candidates[0]).toMatchObject({ official: true, value: 2.4, instanceKey: "m1", instanceLabel: "Probe A" });
    expect(candidates[0].instanceContext).toEqual({ praep: "gemahlen" });
    expect(candidates[1].official).toBe(false);
  });

  describe("mit Ergebnisliste des Messfalls", () => {
    const fields = [
      block,
      blockChild("sio2", { display_name: "SiO2", is_result: true }),
      blockChild("fe2o3", { display_name: "Fe2O3", is_result: true }),
      blockChild("rohdichte", { display_name: "Rohdichte", is_result: true }),
      blockChild("import", { field_type: "measurement_import" }),
    ];
    const entry = (over: Record<string, unknown> = {}) => ({
      [k("messungen")]: [
        {
          [INSTANCE_ID_KEY]: "m1",
          __label: "Messung 1",
          __case_element_spec: [{ key: "SiO2" }, { key: "Al2O3", official: false }],
          fe2o3: 1.2,
          rohdichte: 2.5,
          "element:Al2O3": 12,
          ...over,
        },
      ],
    });
    const byKey = (candidates: ReturnType<typeof buildLinkedFormResultCandidates>, key: string) =>
      candidates.find((c) => c.key === k(`messungen[m1].${key}`));

    it("führt ein Messfall-Element ohne Messwert als leere offizielle Position", () => {
      const sio2 = byKey(buildLinkedFormResultCandidates(FORM, fields, [], entry()), "sio2");
      expect(sio2).toMatchObject({ value: null, official: true, label: "SiO2" });
    });

    it("übernimmt ein Messfall-Element ohne Formularfeld aus dem Wert element:<Key> mit der Kennzeichnung des Messfalls", () => {
      const al2o3 = byKey(buildLinkedFormResultCandidates(FORM, fields, [], entry()), "element:Al2O3");
      expect(al2o3).toMatchObject({ value: 12, official: false });
    });

    it("kennzeichnet ein Elementfeld außerhalb der Messfall-Liste nie als offiziell, auch wenn es als Ergebnis markiert ist", () => {
      const fe2o3 = byKey(buildLinkedFormResultCandidates(FORM, fields, [], entry()), "fe2o3");
      expect(fe2o3).toMatchObject({ value: 1.2, official: false });
    });

    it("lässt Nicht-Element-Felder mit Ergebniskennzeichnung auch neben einem Messfall offiziell", () => {
      const dichte = byKey(buildLinkedFormResultCandidates(FORM, fields, [], entry()), "rohdichte");
      expect(dichte).toMatchObject({ value: 2.5, official: true });
    });

    it("speichert importierte Elementwerte ohne Messfall-Zuordnung als nicht offizielle Werte, leere Werte entfallen", () => {
      const candidates = buildLinkedFormResultCandidates(
        FORM, fields, [], entry({ "element:CaO": 3.1, "element:MgO": "" }),
      );
      expect(byKey(candidates, "element:CaO")).toMatchObject({ value: 3.1, official: false, label: "CaO" });
      expect(byKey(candidates, "element:MgO")).toBeUndefined();
    });

    it("übernimmt die Einheit eines Elements aus dem Messdatenimport", () => {
      const candidates = buildLinkedFormResultCandidates(
        FORM, fields, [], entry({ "element:CaO": 310, import: JSON.stringify({ units: { "element:CaO": "ppm" } }) }),
      );
      expect(byKey(candidates, "element:CaO")?.unit).toBe("ppm");
    });

    it("ignoriert eine unlesbare Importinformation und behält die Standardeinheit des Elements", () => {
      const ohneImport = byKey(
        buildLinkedFormResultCandidates(FORM, fields, [], entry({ "element:CaO": 3.1 })),
        "element:CaO",
      );
      const kaputt = byKey(
        buildLinkedFormResultCandidates(FORM, fields, [], entry({ "element:CaO": 3.1, import: "{kaputt" })),
        "element:CaO",
      );
      expect(kaputt?.value).toBe(3.1);
      expect(kaputt?.unit).toBe(ohneImport?.unit);
    });
  });
});

describe("Ergebniskandidaten eines Wiederholbereichs ohne Zeilen", () => {
  it("erzeugt ohne gespeicherte Zeilen keine Kandidaten für Repeater und Unterfelder", () => {
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [repeater(), formField({ field_key: "wert", parent_field_id: "rep-1", is_result: true })],
      [],
      {},
    );
    expect(candidates).toEqual([]);
  });

  it("behandelt einen ungültigen gespeicherten Wert (kein Array) wie keine Zeilen", () => {
    const candidates = buildLinkedFormResultCandidates(
      FORM,
      [repeater(), formField({ field_key: "wert", parent_field_id: "rep-1", is_result: true })],
      [],
      { [k("zeilen")]: "kaputt" },
    );
    expect(candidates).toEqual([]);
  });
});

describe("Verwaiste Repeater-Ergebnisse erkennen: Grenzfälle", () => {
  const child = formField({ field_key: "wert", parent_field_id: "rep-1", is_result: true });
  const row = (id: string) => ({ [INSTANCE_ID_KEY]: id, wert: 1 });

  it("meldet nichts, wenn das Formular keinen Repeater hat", () => {
    // Der Ergebnisname passt formal zum Feld „wert“, das aber kein Repeater ist.
    const stale = collectStaleRepeaterInstanceKeys(
      FORM,
      [formField({ field_key: "wert" })],
      {},
      [k("wert[m_x].wert")],
    );
    expect(stale.size).toBe(0);
  });

  it("ignoriert verschachtelte Repeater, die selbst in einem Container liegen", () => {
    const stale = collectStaleRepeaterInstanceKeys(
      FORM,
      [repeater({ parent_field_id: "block-1" }), child],
      { [k("zeilen")]: [] },
      [k("zeilen[m_x].wert")],
    );
    expect(stale.size).toBe(0);
  });

  it("meldet alle stabilen Zeilen, wenn keine Zeilen mehr gespeichert sind", () => {
    const stale = collectStaleRepeaterInstanceKeys(
      FORM,
      [repeater(), child],
      {},
      [k("zeilen[m_a].wert"), k("zeilen[m_b].wert"), k("zeilen[idx_1].wert")],
    );
    expect([...stale].sort()).toEqual([k("zeilen[m_a].wert"), k("zeilen[m_b].wert")]);
  });

  it("verwendet den Speicherschlüssel des Repeaters statt des Feldschlüssels", () => {
    const stale = collectStaleRepeaterInstanceKeys(
      FORM,
      [repeater({ metadata: { repeater: { storage_key: "zeilen_v2" } } }), child],
      { [k("zeilen_v2")]: [row("m_bleibt")] },
      [k("zeilen_v2[m_weg].wert"), k("zeilen_v2[m_bleibt].wert"), k("zeilen[m_weg].wert")],
    );
    expect([...stale]).toEqual([k("zeilen_v2[m_weg].wert")]);
  });

  it("behandelt Sonderzeichen in der Formular-ID wörtlich und meldet keine fremden Formulare", () => {
    const formId = "f.1";
    const stale = collectStaleRepeaterInstanceKeys(
      formId,
      [repeater(), child],
      { "form:f.1:zeilen": [] },
      ["form:f.1:zeilen[m_a].wert", "form:fX1:zeilen[m_b].wert"],
    );
    expect([...stale]).toEqual(["form:f.1:zeilen[m_a].wert"]);
  });
});

describe("Ergebniskandidaten eines klassischen Dienstleistungsformulars", () => {
  it("lässt archivierte Felder und archivierte Rechenfelder weg", () => {
    const candidates = buildServiceResultCandidates(
      [
        serviceField({ field_key: "a" }),
        serviceField({ field_key: "alt", archived: true, is_result: true }),
        serviceField({ field_key: "alt_calc", field_type: "computed", archived: true, validation: { formula: "a * 2" } }),
      ],
      { a: 1, alt: 5 },
    );
    expect(candidates.map((c) => c.key)).toEqual(["a"]);
  });

  it("berechnet verkettete Rechenfelder auch dann, wenn das abhängige Feld zuerst steht", () => {
    const candidates = buildServiceResultCandidates(
      [
        serviceField({ field_key: "doppelt", field_type: "computed", validation: { formula: "summe * 2" }, is_result: true }),
        serviceField({ field_key: "summe", field_type: "computed", validation: { formula: "a + b" } }),
        serviceField({ field_key: "a" }),
        serviceField({ field_key: "b" }),
      ],
      { a: 1, b: 2 },
    );
    expect(candidates.find((c) => c.key === "summe")?.value).toBe(3);
    expect(candidates.find((c) => c.key === "doppelt")).toMatchObject({ value: 6, official: true, kind: "calculation", error: null });
  });

  it("rundet Rechenergebnisse auf die eingestellten Nachkommastellen, ohne Einstellung ungerundet", () => {
    const candidates = buildServiceResultCandidates(
      [
        serviceField({ field_key: "a" }),
        serviceField({ field_key: "ganz", field_type: "computed", decimal_places: 0, validation: { formula: "a / 3" } }),
        serviceField({ field_key: "roh", field_type: "computed", validation: { formula: "a / 3" } }),
      ],
      { a: 5 },
    );
    expect(candidates.find((c) => c.key === "ganz")?.value).toBe(2);
    expect(candidates.find((c) => c.key === "roh")?.value).toBeCloseTo(5 / 3, 10);
  });

  it("ersetzt einen gespeicherten, veralteten Rechenwert durch das aktuelle Ergebnis", () => {
    const [, calc] = buildServiceResultCandidates(
      [
        serviceField({ field_key: "a" }),
        serviceField({ field_key: "doppelt", field_type: "computed", validation: { formula: "a * 2" } }),
      ],
      { a: 4, doppelt: 999 },
    );
    expect(calc.value).toBe(8);
  });

  it("meldet einen Formelfehler am Rechenfeld, Eingabefelder haben nie einen Fehler", () => {
    const [eingabe, calc] = buildServiceResultCandidates(
      [
        serviceField({ field_key: "a", display_name: "A", unit: "mm" }),
        serviceField({ field_key: "kaputt", field_type: "computed", validation: { formula: "a + * 2" } }),
      ],
      { a: 4 },
    );
    expect(eingabe).toMatchObject({ key: "a", label: "A", unit: "mm", value: 4, kind: "field", error: null, official: false });
    expect(calc.kind).toBe("calculation");
    expect(calc.error).toEqual(expect.any(String));
    expect(calc.value).toBeUndefined();
  });

  // Fehler F-1 (Issue #3): tasks/Fehler.md#F-1
  it("liefert einen gespeicherten Rechenwert nicht mehr als offizielles Ergebnis, wenn eine Eingabe fehlt", () => {
    const [, , calc] = buildServiceResultCandidates(
      [
        serviceField({ field_key: "a" }),
        serviceField({ field_key: "b" }),
        serviceField({ field_key: "produkt", field_type: "computed", is_result: true, validation: { formula: "a * b" } }),
      ],
      { a: 2, produkt: 99 },
    );
    // Erwartet wie bei verknüpften Formularen: kein Wert bzw. kein offizielles Ergebnis.
    const giltAlsOffiziellesErgebnis = calc.official && calc.value != null;
    expect(giltAlsOffiziellesErgebnis).toBe(false);
  });

  it("F-1: fehlt eine Eingabe, hat das Rechenfeld keinen Wert und keine Fehlermeldung", () => {
    const [, , calc] = buildServiceResultCandidates(
      [
        serviceField({ field_key: "a" }),
        serviceField({ field_key: "b" }),
        serviceField({ field_key: "produkt", field_type: "computed", is_result: true, validation: { formula: "a * b" } }),
      ],
      { a: 2, produkt: 99 },
    );
    expect(calc.kind).toBe("calculation");
    expect(calc.value == null).toBe(true);
  });

  it("F-1: ein Rechenfeld, das auf ein anderes Rechenfeld baut, verliert den alten Wert, wenn die Eingabe fehlt", () => {
    const kandidaten = buildServiceResultCandidates(
      [
        serviceField({ field_key: "a" }),
        serviceField({ field_key: "b", field_type: "computed", validation: { formula: "a * 2" } }),
        serviceField({ field_key: "c", field_type: "computed", is_result: true, validation: { formula: "b + 1" } }),
      ],
      { b: 50, c: 51 },
    );
    expect(kandidaten.find((c) => c.key === "b")?.value == null).toBe(true);
    expect(kandidaten.find((c) => c.key === "c")?.value == null).toBe(true);
  });

  it("F-1: verknüpftes Formular – fehlt eine Eingabe, gilt der alte gespeicherte Rechenwert nicht", () => {
    const kandidaten = buildLinkedFormResultCandidates(
      FORM,
      [formField({ field_key: "a" }), formField({ field_key: "b" })],
      [formCalculation({ calc_key: "produkt", formula: "a * b", is_result: true })],
      { [k("a")]: 2, [k("produkt")]: 99 },
    );
    expect(kandidaten.find((c) => c.key === k("produkt"))?.value == null).toBe(true);
  });

});
