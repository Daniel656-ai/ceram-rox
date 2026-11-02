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
  ({
    sourceName: name,
    raw: value,
    value: parseFloat(value.replace(",", ".")),
    unit,
    belowDetection: value.trim().startsWith("<"),
  });

/** Messdatenblock-Formular mit einem Wertfeld und serialisierten Instanzen. */
const blockFixture = (entries: Array<Record<string, unknown>>) => {
  const fields = [
    { id: "b1", field_key: "messblock", field_type: "measurement_block", parent_field_id: null },
    { id: "c1", field_key: "fe_wert", field_type: "number", parent_field_id: "b1" },
  ] as any[];
  const taskValues = { "form:F1:messblock": entries };
  return { fields, taskValues };
};

describe("1. Elementbibliothek ist vollständig (H–U, 92 Elemente)", () => {
  it("deckt alle 92 Elementsymbole ab", () => {
    // Die Bibliothek enthält neben den 92 reinen Elementsymbolen auch
    // Oxide/Verbindungen – maßgeblich ist die vollständige Symbolabdeckung.
    const libKeys = new Set(elementLibrary.map((e) => e.key));
    const symbols92 = ["H","He","Li","Be","B","C","N","O","F","Ne","Na","Mg","Al","Si","P","S","Cl","Ar","K","Ca","Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn","Ga","Ge","As","Se","Br","Kr","Rb","Sr","Y","Zr","Nb","Mo","Tc","Ru","Rh","Pd","Ag","Cd","In","Sn","Sb","Te","I","Xe","Cs","Ba","La","Ce","Pr","Nd","Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb","Lu","Hf","Ta","W","Re","Os","Ir","Pt","Au","Hg","Tl","Pb","Bi","Po","At","Rn","Fr","Ra","Ac","Th","Pa","U"];
    for (const sym of symbols92) expect(libKeys.has(sym), sym).toBe(true);
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
    expect(isValidResultValue("nicht bestimmbar").isValid).toBe(true);
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
    // 17er-Basis bleibt Ausgangspunkt; Formularfelder bleiben erhalten
    expect(spec.filter((s) => RFA_FIXED_ELEMENTS.some((f) => f.key === s.field_key)).length).toBe(17);
    const rows = mapReadings(
      [reading("Fe2O3", "5,2"), reading("Nd", "0,04")],
      null,
      spec,
      { dynamicElements: true }
    );
    const nd = rows.find((r) => r.sourceName === "Nd");
    expect(nd?.targetFieldKey).toBe("element:Nd");
    expect(nd?.matchedBy).toBe("element");
  });
  it("gültige dynamische Elemente werden offizielle Ergebnisse", () => {
    const { fields, taskValues } = blockFixture([
      { __instance_id: "i1", "element:Nd": 0.04, fe_wert: 5.2, "element:Ti": "" },
    ]);
    const candidates = buildLinkedFormResultCandidates("F1", fields, [], taskValues, [], { rfaDefault: true });
    const official = candidates.filter((c) => c.official).map((c) => c.key);
    expect(official.some((k) => k.endsWith("element:Nd"))).toBe(true);
    // Ohne gültigen Wert kein offizielles Ergebnis
    expect(official.some((k) => k.endsWith("element:Ti"))).toBe(false);
  });
  it("ohne RFA-Kontext bleibt die bisherige Auswahl unverändert", () => {
    const rows = mapReadings([reading("Nd", "0,04")], null, targets([]), { dynamicElements: false });
    expect(rows[0].targetFieldKey).toBeNull();
  });
});

describe("4. Eingeschränkte Messfälle bleiben strikt", () => {
  it("übernimmt nur die ausdrücklich ausgewählten Elemente", () => {
    const spec = buildCaseTargets(
      [{ key: "Fe" }, { key: "Si" }],
      targets(["fe_wert", "si_wert"]),
      null,
      true
    );
    // Nur die beiden Messfall-Elemente plus die Formularfelder – keine 17er-Basis
    expect(spec.length).toBe(4);
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
  it("ist nur über den exakten case_key aktivierbar", () => {
    expect(isExternalAnalysisCaseKey(EXTERNAL_ANALYSIS_CASE_KEY)).toBe(true);
    expect(isExternalAnalysisCaseKey("external_analysis")).toBe(true);
    expect(isExternalAnalysisCaseKey("External_Analysis")).toBe(false);
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
    // Oxididentität bleibt erhalten: Fe2O3/Y2O3 sind eigene Schlüssel
    expect(rows.map((r) => r.targetFieldKey)).toEqual(["element:Fe2O3", "element:Nd", "element:Y2O3"]);
  });
  it("gültige Werte (inkl. 0 und Text) werden offiziell", () => {
    const { fields, taskValues } = blockFixture([
      {
        __instance_id: "i1",
        __case_key: EXTERNAL_ANALYSIS_CASE_KEY,
        "element:Nd": 0,
        "element:Ce": "<0,01",
        fe_wert: 5.2,
      },
    ]);
    const candidates = buildLinkedFormResultCandidates("F1", fields, [], taskValues, [], { rfaDefault: true });
    const official = candidates.filter((c) => c.official).map((c) => c.key);
    expect(official.some((k) => k.endsWith("element:Nd"))).toBe(true);
    expect(official.some((k) => k.endsWith("element:Ce"))).toBe(true);
  });
});

describe("6. Standardlos/Oberfläche (B-U) bleibt unverändert", () => {
  it("übernimmt nur Elemente innerhalb des Bereichs", () => {
    const rows = mapReadings(
      [reading("Fe2O3", "5,2"), reading("He", "0,001")],
      null,
      buildCaseTargets([], targets([]), "B-U"),
      { elementRange: "B-U" }
    );
    expect(rows.find((r) => r.sourceName === "Fe2O3")?.targetFieldKey).toBe("element:Fe2O3");
    // Helium (Z=2) liegt vor dem Bereich B-U und wird nicht übernommen
    expect(rows.find((r) => r.sourceName === "He")?.targetFieldKey).toBeNull();
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
    expect(rows.find((r) => r.sourceName === "CeO2")?.targetFieldKey).toBe("element:CeO2");
    expect(rows.find((r) => r.sourceName === "ZrO2")?.targetFieldKey).toBe("element:ZrO2");
    expect(rows.find((r) => r.sourceName === "SrO")?.targetFieldKey).toBe("element:SrO");
  });
});

describe("8. Einheitenkonflikte bleiben erkennbar", () => {
  it("markiert abweichende Einheiten als Konflikt statt still zu überschreiben", () => {
    const spec = buildCaseTargets([], targets(["fe_wert"]), null, true);
    const feTarget = spec.find((s) => s.key === "fe_wert");
    if (feTarget) feTarget.unit = "%";
    const rows = mapReadings([reading("fe_wert", "5,2", "ppm")], null, spec, { dynamicElements: true });
    const fe = rows.find((r) => r.sourceName === "fe_wert");
    expect(fe?.targetFieldKey).toBe("fe_wert");
    expect(fe?.unitMismatch).toBe(true);
  });
});

describe("9. Historische Freigaben bleiben unberührt", () => {
  it("nicht-offizielle Zeilen werden ohne RFA-Modus nicht pauschal hochgestuft", () => {
    const { fields, taskValues } = blockFixture([
      { __instance_id: "i1", "element:U": 0.5 },
    ]);
    const candidates = buildLinkedFormResultCandidates("F1", fields, [], taskValues, [], {});
    const u = candidates.find((c) => c.key.endsWith("element:U"));
    expect(u).toBeDefined();
    expect(u?.official).toBe(false);
  });
});

describe("10. Ungültige Werte erzeugen keine Ergebnisse", () => {
  it("leere und Platzhalter-Werte werden nicht übernommen", () => {
    const { fields, taskValues } = blockFixture([
      {
        __instance_id: "i1",
        __case_key: EXTERNAL_ANALYSIS_CASE_KEY,
        "element:Nd": "",
        "element:Ce": "n/a",
        "element:Dy": "abc",
      },
    ]);
    const candidates = buildLinkedFormResultCandidates("F1", fields, [], taskValues, [], { rfaDefault: true });
    const official = candidates.filter((c) => c.official).map((c) => c.key);
    expect(official.some((k) => k.endsWith("element:Nd"))).toBe(false);
    expect(official.some((k) => k.endsWith("element:Ce"))).toBe(false);
    expect(official.some((k) => k.endsWith("element:Dy"))).toBe(false);
  });
});

describe("Zusatz: 17er-Standardliste unverändert", () => {
  it("RFA_FIXED_ELEMENTS hat weiterhin exakt 17 Einträge", () => {
    expect(RFA_FIXED_ELEMENTS.length).toBe(17);
  });
});
