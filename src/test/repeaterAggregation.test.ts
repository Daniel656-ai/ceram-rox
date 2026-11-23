/**
 * Aggregation über Wiederholbereiche (lib/repeaterAggregation.ts).
 */
import { describe, it, expect } from "vitest";
import { aggregateKey, repeaterAggregateRefs, repeaterAggregateScope } from "@/lib/repeaterAggregation";
import { evaluateFormula } from "@/lib/formulaEngine";
import { formField } from "./fixtures/resultCandidates";

const felder = () => [
  formField({ field_key: "vorgaben", field_type: "repeater", display_name: "Vorgaben" }),
  formField({ field_key: "temp", parent_field_id: "field-vorgaben", display_name: "Temperatur", unit: "°C", sort_order: 2 }),
  formField({ field_key: "anzahl", parent_field_id: "field-vorgaben", display_name: "Anzahl", sort_order: 1 }),
  formField({ field_key: "einzel", display_name: "Einzelfeld" }),
  formField({ field_key: "messung", field_type: "repeater", display_name: "Messung" }),
];

describe("Repeater-Aggregation: Referenzschlüssel", () => {
  it("bildet den Schlüssel als bereich.unterfeld", () => {
    expect(aggregateKey("vorgaben", "anzahl")).toBe("vorgaben.anzahl");
  });

  it("listet je Unterfeld eines Repeaters Schlüssel, Bezeichnung und Einheit in Reihenfolge der Unterfelder", () => {
    expect(repeaterAggregateRefs(felder())).toEqual([
      { key: "vorgaben.anzahl", repeaterKey: "vorgaben", childKey: "anzahl", label: "Vorgaben › Anzahl", unit: null },
      { key: "vorgaben.temp", repeaterKey: "vorgaben", childKey: "temp", label: "Vorgaben › Temperatur", unit: "°C" },
    ]);
  });

  it("liefert ohne Repeater oder für Repeater ohne Unterfelder keine Einträge", () => {
    expect(repeaterAggregateRefs([formField({ field_key: "x" })])).toEqual([]);
    expect(repeaterAggregateRefs([formField({ field_key: "r", field_type: "repeater" })])).toEqual([]);
    expect(repeaterAggregateRefs([])).toEqual([]);
  });

  it("nimmt Unterfelder anderer Felder als Repeater nicht auf", () => {
    const fs = [
      formField({ field_key: "block", field_type: "measurement_block" }),
      formField({ field_key: "kind", parent_field_id: "field-block" }),
    ];
    expect(repeaterAggregateRefs(fs)).toEqual([]);
  });
});

describe("Repeater-Aggregation: Werte-Listen für den Rechen-Scope", () => {
  it("sammelt die Zahlenwerte je Unterfeld über alle Einträge", () => {
    const values = {
      vorgaben: [
        { anzahl: 3, temp: "550" },
        { anzahl: "4", temp: "600,5 °C" },
      ],
    };
    expect(repeaterAggregateScope(felder(), values)).toEqual({
      "vorgaben.anzahl": [3, 4],
      "vorgaben.temp": [550, 600.5],
    });
  });

  it("lässt leere und nicht numerische Eingaben aus, statt sie als 0 zu zählen", () => {
    const values = { vorgaben: [{ anzahl: "" }, { anzahl: null }, { anzahl: "abc" }, { anzahl: 0 }, null, { anzahl: "  " }] };
    expect(repeaterAggregateScope(felder(), values)["vorgaben.anzahl"]).toEqual([0]);
  });

  it("liefert leere Listen, wenn der Repeater keine Einträge oder keine Liste hat", () => {
    expect(repeaterAggregateScope(felder(), { vorgaben: [] })["vorgaben.anzahl"]).toEqual([]);
    expect(repeaterAggregateScope(felder(), { vorgaben: "kaputt" })["vorgaben.temp"]).toEqual([]);
    expect(repeaterAggregateScope(felder(), { vorgaben: { anzahl: 3 } })["vorgaben.anzahl"]).toEqual([]);
    expect(repeaterAggregateScope(felder(), {})).toEqual({ "vorgaben.anzahl": [], "vorgaben.temp": [] });
  });

  it("spiegelt nur Repeater, keine Unterfelder anderer Containerfelder", () => {
    const fs = [
      formField({ field_key: "block", field_type: "measurement_block" }),
      formField({ field_key: "kind", parent_field_id: "field-block" }),
    ];
    expect(repeaterAggregateScope(fs, { block: [{ kind: 1 }] })).toEqual({});
  });

  it("liefert ohne Formularwerte einen leeren Scope", () => {
    expect(repeaterAggregateScope(felder(), undefined)).toEqual({});
  });

  it("die Listen lassen sich direkt mit den Aggregatfunktionen der Formel-Engine auswerten", () => {
    const scope = repeaterAggregateScope(felder(), { vorgaben: [{ anzahl: 3 }, { anzahl: "" }, { anzahl: 5 }] });
    expect(evaluateFormula("SUM(vorgaben.anzahl)", scope).value).toBe(8);
    expect(evaluateFormula("COUNT(vorgaben.anzahl)", scope).value).toBe(2);
    expect(evaluateFormula("AVERAGE(vorgaben.anzahl)", scope).value).toBe(4);
  });
});
