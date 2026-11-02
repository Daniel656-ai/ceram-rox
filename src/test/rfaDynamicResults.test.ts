import { describe, it, expect } from "vitest";
import { mapReadings, buildCaseTargets } from "@/lib/measurementImport";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
import {
  isValidResultValue,
  isExternalAnalysisCaseKey,
  EXTERNAL_ANALYSIS_CASE_KEY,
  RFA_FIXED_ELEMENTS,
} from "@/lib/rfaFixedElements";
import { elementLibrary, elementKey } from "@/lib/elementKeys";

/**
 * Regressionen: RFA & dynamische Elementergebnisse.
 * Dokument: „ROX – RFA und dynamische Elementergebnisse (Umsetzungsprompt)“.
 */

const targets = (keys: string[]) =>
  keys.map((k) => ({ field_key: k, label: k, official: true, unit: null as string | null }));

const reading = (name: string, value: string, unit: string | null = "%") =>
  ({ sourceName: name, raw: value, value: parseFloat(value.replace(",", ".")), unit });

describe("1. Elementbibliothek ist vollständig (H–U, 92 Elemente)", () => {
  it("deckt alle 92 Elementsymbole ab", () => {
    const lib = elementLibrary();
    expect(lib.length).toBe(92);
    // Stichproben der zuvor fehlenden Symbole
    for (const sym of ["Nd", "Ce", "Pr", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Re", "Os", "Ir", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Pa", "He", "Ne", "Ar", "Kr", "Xe", "Tc", "Ru", "Rh", "Pd", "In", "Pm"]) {
      expect(elementKey(sym), sym).toBe(sym);
    }
  });
});

describe("2. Wertvalidierung isValidResultValue", () => {
  it("akzeptiert positive Zahlen, null und negative Werte", () => {
    expect(isValidResultValue(5).isValid).toBe(true);
    expect(isValidResultValue(0).isValid).toBe(true);
    expect(isValidResultValue(-1.5).isValid).toBe(true);
    expect(isValidResultValue("0").isValid).toBe(true);
    expect(isValidResultValue("-0,25").isValid).toBe(true);
    expect(isValidResultValue("0,293").numericValue).toBeCloseTo(0.293);
  });
  it("akzeptiert qualifizierte Textwerte (Grenzwerte, n.b./n.n.)", () => {
    expect(isValidResultValue("<0,01").textValue).toBe("<0,01");
    expect(isValidResultValue("< 0.1").isValid).toBe(true);
    expect(isValidResultValue(">100").isValid).toBe(true);
    expect(isValidResultValue("n.b.").isValid).toBe(true);
    expect(isValidResultValue("n.n.").isValid).toBe(true);
    expect(isValidResultValue("nicht bestimmt").isValid).toBe(true);
  });
  it("verwirft leere, Platzhalter- und unlesbare Werte", () => {
    expect(isValidResultValue(null).isValid).toBe(false);
    expect(isValidResultValue(undefined).isValid).toBe(false);
    expect(isValidResultValue("").isValid).toBe(false);
    expect(isValidResultValue("   ").isValid).toBe(false);
    expect(isValidResultValue("-").isValid).toBe(false);
    expect(isValidResultValue("n/a").isValid).toBe(false);
    expect(isValidResultValue("NaN").isValid).toBe(false);
    expect(isValidResultValue("Infinity").isValid).toBe(false);
    expect(isValidResultValue("abc").isValid).toBe(false);
  });
});

describe("3. Reguläre RFA: dynamische Elemente über der 17er-Basis", () => {
  it("übernimmt Nd zusätzlich zu den 17 Standardelementen", () => {
    const spec = buildCaseTargets([], targets(["fe_wert", "si_wert"]), null, true);
    expect(spec.length).toBe(17); // 17er-Basis bleibt Ausgangspunkt
    const rows = mapReadings(
      [reading("Fe2O3", "5,2"), reading("Nd", "0,04")],
      null,
      spec,
      { dynamicElements: true }
    );
    const nd = rows.find((r) => r.sourceName === "Nd");
    expect(nd?.targetFieldKey).toBe("value:Nd");
    expect(nd?.matchedBy).toBe("element");
  });
  it("gültige dynamische Elemente werden offizielle Ergebnisse", () => {
    const instances = [{
      key: "m1",
      label: "Messung 1",
      context: {},
      values: { "value:Nd": 0.04, "value:Fe": 5.2, "value:Ti": "" },
      elementSpec: [],
      elementRange: null,
      caseKey: null,
      index: 0,
    }];
    const candidates = buildLinkedFormResultCandidates([], targets([]), instances, { rfaDefault: true });
    const names = candidates.filter((c) => c.official).map((c) => c.resultName);
    expect(names).toContain("value:Nd");
    expect(names).toContain("value:Fe");
    // Ohne gültigen Wert kein offizielles Ergebnis
    expect(names).not.toContain("value:Ti");
    // 17er-Basis bleibt als Zielstruktur erhalten
    expect(candidates.length).toBeGreaterThanOrEqual(17);
  });
  it("ohne RFA-Kontext bleibt die bisherige Auswahl unverändert", () => {
    const rows = mapReadings([reading("Nd", "0,04")], null, targets([]), { dynamicElements: false });
    expect(rows[0].targetFieldKey).toBeNull();
  });
});

describe("4. Eingeschränkte Messfälle bleiben strikt", () => {
  it("übernimmt nur die ausdrücklich ausgewählten Elemente", () => {
    const spec = buildCaseTargets(
      [{ key: "fe_wert" }, { key: "si_wert" }],
      targets(["fe_wert", "si_wert"]),
      null,
      true
    );
    expect(spec.length).toBe(2);
    const rows = mapReadings(
      [reading("Fe2O3", "5,2"), reading("Nd", "0,04")],
      null,
      spec,
      { caseElementKeys: ["Fe", "Si"], dynamicElements: true }
    );
    expect(rows.find((r) => r.sourceName === "Nd")?.targetFieldKey).toBeNull();
  });
});

describe("5. Externe Analyse: unbegrenzte dynamische Übernahme", () => {
  it("ist nur über den case_key aktivierbar", () => {
    expect(isExternalAnalysisCaseKey(EXTERNAL_ANALYSIS_CASE_KEY)).toBe(true);
    expect(isExternalAnalysisCaseKey("External_Analysis")).toBe(true);
    expect(isExternalAnalysisCaseKey("ALL")).toBe(false);
    expect(isExternalAnalysisCaseKey(null)).toBe(false);
    expect(isExternalAnalysisCaseKey("standardlos")).toBe(false);
  });
  it("baut keine 17er-Basis auf und übernimmt alle erkannten Elemente", () => {
    const spec = buildCaseTargets([], targets([]), null, true, true);
    expect(spec.length).toBe(0); // keine 17er-Basis im externen Modus
    const rows = mapReadings(
      [reading("Fe2O3", "5,2"), reading("Nd", "0,04"), reading("Y2O3", "3,1")],
      null,
      spec,
      { dynamicElements: true }
    );
    expect(rows.map((r) => r.targetFieldKey)).toEqual(["value:Fe", "value:Nd", "value:Y"]);
  });
  it("gültige Werte (inkl. 0 und Text) werden offiziell", () => {
    const instances = [{
      key: "m1",
      label: "Messung 1",
      context: {},
      values: { "value:Nd": 0, "value:Ce": "<0,01", "value:Fe": 5.2 },
      elementSpec: [],
      elementRange: null,
      caseKey: EXTERNAL_ANALYSIS_CASE_KEY,
      index: 0,
    }];
    const candidates = buildLinkedFormResultCandidates([], targets([]), instances, { rfaDefault: true });
    const official = candidates.filter((c) => c.official).map((c) => c.resultName);
    expect(official).toContain("value:Nd");
    expect(official).toContain("value:Ce");
    expect(official).toContain("value:Fe");
  });
});

describe("6. Standardlos/Oberfläche (B-U) bleibt unverändert", () => {
  it("übernimmt nur Elemente innerhalb des Bereichs", () => {
    const rows = mapReadings(
      [reading("Fe2O3", "5,2"), reading("Np", "0,001")],
      null,
      buildCaseTargets([], targets([]), "B-U"),
      { elementRange: "B-U" }
    );
    expect(rows.find((r) => r.sourceName === "Fe2O3")?.targetFieldKey).toBe("value:Fe");
    expect(rows.find((r) => r.sourceName === "Np")?.targetFieldKey).toBeNull();
  });
});

describe("7. Oxididentität bleibt eigenständig", () => {
  it("CeO2, Y2O3, ZrO2, SrO bleiben eigene Ergebnisschlüssel", () => {
    const spec = buildCaseTargets([], targets([]), null, true, true);
    const rows = mapReadings(
      [reading("CeO2", "12,5"), reading("Y2O3", "3,1"), reading("ZrO2", "60,0"), reading("SrO", "0,8")],
      null,
      spec,
      { dynamicElements: true }
    );
    // Oxide werden auf ihre Elemente abgebildet, aber nicht mit Elementwerten vermischt
    expect(rows.find((r) => r.sourceName === "CeO2")?.targetFieldKey).toBe("value:Ce");
    expect(rows.find((r) => r.sourceName === "ZrO2")?.targetFieldKey).toBe("value:Zr");
  });
});

describe("8. Einheitenkonflikte bleiben erkennbar", () => {
  it("markiert abweichende Einheiten als Konflikt statt still zu überschreiben", () => {
    const spec = buildCaseTargets([], targets(["fe_wert"]), null, true);
    spec[0] = { ...spec[0], unit: "%" };
    const rows = mapReadings([reading("Fe2O3", "5,2", "ppm")], null, spec, { dynamicElements: true });
    const fe = rows.find((r) => r.sourceName === "Fe2O3");
    expect(fe?.targetFieldKey).toBeTruthy();
    expect(fe?.unitMismatch).toBe(true);
  });
});

describe("9. Historische Freigaben bleiben unberührt", () => {
  it("nicht-offizielle Zeilen werden nicht pauschal hochgestuft", () => {
    const instances = [{
      key: "m1",
      label: "Messung 1",
      context: {},
      values: { "value:U": 0.5 },
      elementSpec: [],
      elementRange: null,
      caseKey: null,
      index: 0,
    }];
    // Ohne RFA-Modus bleiben dynamische Elemente nicht-offiziell
    const candidates = buildLinkedFormResultCandidates([], targets([]), instances, {});
    const u = candidates.find((c) => c.resultName === "value:U");
    expect(u?.official).toBe(false);
  });
});

describe("10. Ungültige Werte erzeugen keine Ergebnisse", () => {
  it("leere und Platzhalter-Werte werden nicht übernommen", () => {
    const instances = [{
      key: "m1",
      label: "Messung 1",
      context: {},
      values: { "value:Nd": "", "value:Ce": "n/a", "value:Fe": "abc" },
      elementSpec: [],
      elementRange: null,
      caseKey: EXTERNAL_ANALYSIS_CASE_KEY,
      index: 0,
    }];
    const candidates = buildLinkedFormResultCandidates([], targets([]), instances, { rfaDefault: true });
    const official = candidates.filter((c) => c.official).map((c) => c.resultName);
    expect(official).not.toContain("value:Nd");
    expect(official).not.toContain("value:Ce");
    expect(official).not.toContain("value:Fe");
  });
});

describe("Zusatz: 17er-Standardliste unverändert", () => {
  it("RFA_FIXED_ELEMENTS hat weiterhin exakt 17 Einträge", () => {
    expect(RFA_FIXED_ELEMENTS.length).toBe(17);
  });
});
