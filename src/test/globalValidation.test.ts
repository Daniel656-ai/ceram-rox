/**
 * Globale Validierungsregeln (lib/globalValidation.ts).
 */
import { describe, it, expect } from "vitest";
import { evaluateValidation, evaluateValidations, validationIdsFromMetadata } from "@/lib/globalValidation";
import type { GlobalValidation } from "@/lib/api/globalLibrary";

const regel = (over: Partial<GlobalValidation> & Pick<GlobalValidation, "rule_type">): GlobalValidation => ({
  id: "v-1",
  validation_key: "regel_1",
  display_name: "Regel 1",
  description: null,
  category: null,
  min_value: null,
  max_value: null,
  unit: null,
  pattern: null,
  expression: null,
  severity: "error",
  error_message: null,
  is_system: false,
  archived_at: null,
  created_by: null,
  created_at: "",
  updated_at: "",
  ...over,
});

describe("Globale Validierung: Pflichtangabe", () => {
  const pflicht = regel({ rule_type: "required" });

  it("meldet leere Werte (null, undefined, leerer Text, leere Liste)", () => {
    for (const leer of [null, undefined, "", []]) {
      expect(evaluateValidation(leer, pflicht)).toEqual({
        severity: "error",
        message: "Pflichtangabe.",
        validationKey: "regel_1",
      });
    }
  });

  it("akzeptiert 0, false und gefüllte Listen als Angabe", () => {
    expect(evaluateValidation(0, pflicht)).toBeNull();
    expect(evaluateValidation(false, pflicht)).toBeNull();
    expect(evaluateValidation(["a"], pflicht)).toBeNull();
    expect(evaluateValidation("x", pflicht)).toBeNull();
  });
});

describe("Globale Validierung: Bereich, Minimum, Maximum", () => {
  const bereich = regel({ rule_type: "range", min_value: 1, max_value: 5, unit: "mm" });

  it("akzeptiert Werte im Bereich einschließlich der Grenzen", () => {
    for (const v of [1, 3, 5, "1", "5,0"]) expect(evaluateValidation(v, bereich)).toBeNull();
  });

  it("meldet Werte unter- und oberhalb mit Standardtext inkl. Einheit", () => {
    const erwartet = { severity: "error", message: "Wert muss zwischen 1 und 5 mm liegen.", validationKey: "regel_1" };
    expect(evaluateValidation(0.99, bereich)).toEqual(erwartet);
    expect(evaluateValidation("5,01", bereich)).toEqual(erwartet);
    expect(evaluateValidation(-3, bereich)).toEqual(erwartet);
  });

  it("prüft bei „min“ nur die Untergrenze und bei „max“ nur die Obergrenze", () => {
    const min = regel({ rule_type: "min", min_value: 10, max_value: 20 });
    const max = regel({ rule_type: "max", min_value: 10, max_value: 20 });
    expect(evaluateValidation(9, min)?.message).toBe("Wert muss mindestens 10 betragen.");
    expect(evaluateValidation(100, min)).toBeNull();
    expect(evaluateValidation(21, max)?.message).toBe("Wert darf höchstens 20 betragen.");
    expect(evaluateValidation(-100, max)).toBeNull();
  });

  it("prüft bei offenem Bereich nur die gesetzte Grenze und zeigt „?“ für die fehlende", () => {
    const nurMin = regel({ rule_type: "range", min_value: 0 });
    expect(evaluateValidation(1e9, nurMin)).toBeNull();
    expect(evaluateValidation(-1, nurMin)?.message).toBe("Wert muss zwischen 0 und ? liegen.");
    const nurMax = regel({ rule_type: "range", max_value: 5 });
    expect(evaluateValidation(-100, nurMax)).toBeNull();
    expect(evaluateValidation(6, nurMax)?.message).toBe("Wert muss zwischen ? und 5 liegen.");
  });

  it("toleriert leere und nicht numerische Werte (Pflicht steuert das Formular)", () => {
    for (const v of [null, "", [], "abc"]) expect(evaluateValidation(v, bereich)).toBeNull();
  });
});

describe("Globale Validierung: Muster", () => {
  it("prüft den Text gegen das Muster", () => {
    const muster = regel({ rule_type: "pattern", pattern: "^L\\d{7}$" });
    expect(evaluateValidation("L2500123", muster)).toBeNull();
    expect(evaluateValidation("X2500123", muster)?.message).toBe("Eingabe entspricht nicht dem erwarteten Format.");
    expect(evaluateValidation(12, regel({ rule_type: "pattern", pattern: "^\\d+$" }))).toBeNull();
  });

  it("blockiert die Eingabe nicht bei fehlendem oder ungültigem Muster", () => {
    expect(evaluateValidation("x", regel({ rule_type: "pattern", pattern: null }))).toBeNull();
    expect(evaluateValidation("x", regel({ rule_type: "pattern", pattern: "([" }))).toBeNull();
  });
});

describe("Globale Validierung: Meldung, Schweregrad, Ausdrucksregeln", () => {
  it("verwendet die eigene Fehlermeldung (getrimmt) und den Schweregrad der Regel", () => {
    const r = regel({ rule_type: "max", max_value: 1, error_message: "  Zu hoch!  ", severity: "warning" });
    expect(evaluateValidation(2, r)).toEqual({ severity: "warning", message: "Zu hoch!", validationKey: "regel_1" });
  });

  it("nimmt bei leerer eigener Meldung den Standardtext", () => {
    const r = regel({ rule_type: "max", max_value: 1, error_message: "   " });
    expect(evaluateValidation(2, r)?.message).toBe("Wert darf höchstens 1 betragen.");
  });

  it("wertet Ausdrucksregeln hier nicht aus (übernimmt die Formel-Engine)", () => {
    expect(evaluateValidation(999, regel({ rule_type: "expression", expression: "x < 1" }))).toBeNull();
  });
});

describe("Globale Validierung: mehrere Regeln", () => {
  it("liefert alle Verstöße in Regelreihenfolge und keine für erfüllte Regeln", () => {
    const regeln = [
      regel({ rule_type: "min", min_value: 10, validation_key: "min10" }),
      regel({ rule_type: "max", max_value: 100, validation_key: "max100" }),
      regel({ rule_type: "pattern", pattern: "^\\d+$", validation_key: "ganzzahl" }),
    ];
    expect(evaluateValidations("5,5", regeln).map((i) => i.validationKey)).toEqual(["min10", "ganzzahl"]);
    expect(evaluateValidations("50", regeln)).toEqual([]);
    expect(evaluateValidations("50", [])).toEqual([]);
  });
});

describe("Globale Validierung: Regel-IDs aus Feld-Metadaten", () => {
  it("liest nur Texteinträge aus validation_ids", () => {
    expect(validationIdsFromMetadata({ validation_ids: ["a", 3, null, "b"] })).toEqual(["a", "b"]);
  });

  it("liefert eine leere Liste ohne Metadaten oder ohne Liste", () => {
    expect(validationIdsFromMetadata(null)).toEqual([]);
    expect(validationIdsFromMetadata(undefined)).toEqual([]);
    expect(validationIdsFromMetadata({})).toEqual([]);
    expect(validationIdsFromMetadata({ validation_ids: "a" })).toEqual([]);
  });
});
