import { describe, it, expect } from "vitest";
import {
  laborKat, laborKatSpecialCount, formatElementNumber, parseToleranceInput, freeTolerance,
  excelRoundUp, type M3Constants,
} from "../calculations";
import { deriveM3Values, stripDerivedValues } from "../derive";
import { canUseTestMarking, readTestMarkingIndex } from "../testMarking";
import {
  serviceNamesForCode, toggleSamplingCode, benchExtraTestPieces, matchSamplingCodes,
  selectableSamplingCodes, NO_MEASUREMENT_CODE,
} from "@/lib/samplingCodeMap";

const C: M3Constants = { crossSectionM: 0.15, pressureTestMm: 150, rsmMaxMm: 350, laborKatAddMm: 50, elementRounding: 10 };

describe("Labor-KAT – Sonderregeln auf L + 50 mm", () => {
  it.each([
    [99, 4], [100, 3], [150, 3], [299, 3], [300, 2], [301, 2], [599, 2],
  ])("Labor-KAT-Länge %i mm → %i Stück", (lk, n) => {
    expect(laborKatSpecialCount(lk)).toBe(n);
  });
  it("ab 600 mm keine Sonderregel", () => {
    expect(laborKatSpecialCount(600)).toBeNull();
    expect(laborKatSpecialCount(601)).toBeNull();
  });
  it.each([
    // L → Labor-KAT-Länge L+50 → erwartete Stückzahl
    [49, 4], [50, 3], [249, 3], [250, 2], [549, 2],
  ])("Elementlänge %i mm → %i Stück", (L, n) => {
    const k = laborKat(L, C)!;
    expect(k.laborKatLengthMm).toBe(L + 50);
    expect(k.count).toBe(n);
  });
  it("ab Labor-KAT-Länge 600 mm bisherige Formel", () => {
    for (const L of [550, 551, 800]) {
      const k = laborKat(L, C)!;
      expect(k.count).toBe(excelRoundUp(k.requiredLengthMm / L));
    }
  });
});

describe("Elementnummer fünfstellig (nur Anzeige)", () => {
  it("formatiert ohne den Zahlenwert zu ändern", () => {
    expect(formatElementNumber(350)).toBe("00350");
    expect(formatElementNumber(12345)).toBe("12345");
    expect(formatElementNumber(0)).toBe("00000");
    expect(formatElementNumber(null)).toBe("—");
  });
  it("berechneter Wert in der Ableitung bleibt numerisch", () => {
    const r = deriveM3Values({
      release: { length_mm: 520 }, orderNumber: null, constants: C,
      stored: { m3_rows: [{ volume_m3: 4 }] },
    });
    expect((r.values.m3_rows as any[])[0].element_count).toBe(340);
  });
});

describe("TEST-Kennzeichnung (UI-Berechtigung)", () => {
  it("nur die vier Rollen", () => {
    for (const n of ["Administrator", "Messdienstleister", "Teamleiter", "PMO"]) expect(canUseTestMarking([n])).toBe(true);
    expect(canUseTestMarking(["Auftraggeber"])).toBe(false);
    expect(canUseTestMarking(["PO", "Externer Auftraggeber"])).toBe(false);
    expect(canUseTestMarking([])).toBe(false);
  });
  it("liest gespeicherte Zeile robust", () => {
    expect(readTestMarkingIndex({ test_charge_row_index: 2 })).toBe(2);
    expect(readTestMarkingIndex({ test_charge_row_index: null })).toBeNull();
    expect(readTestMarkingIndex({ test_charge_row_index: "x" })).toBeNull();
  });
});

describe("Bench und „Keine Messung notwendig“", () => {
  it("Bench NOx / SOx getrennt, Alt-Bench lesbar", () => {
    expect(serviceNamesForCode("Bench NOx")).toEqual(["BENCH NOx"]);
    expect(serviceNamesForCode("Bench SOx")).toEqual(["BENCH SOx"]);
    expect(serviceNamesForCode("Bench")).toEqual(["BENCH NOx", "BENCH SOx"]);
  });
  it("genau ein Teststück bei einer oder beiden Bench-Auswahlen", () => {
    expect(benchExtraTestPieces(["Bench NOx"])).toBe(1);
    expect(benchExtraTestPieces(["Bench SOx"])).toBe(1);
    expect(benchExtraTestPieces(["Bench NOx", "Bench SOx"])).toBe(1);
    expect(benchExtraTestPieces(["Bench"])).toBe(1);
    expect(benchExtraTestPieces(["Geo"])).toBe(0);
  });
  it("Alt-„Bench“ nur auswählbar, wenn bereits gespeichert", () => {
    expect(selectableSamplingCodes(["Geo"])).not.toContain("Bench");
    expect(selectableSamplingCodes(["Bench"])).toContain("Bench");
  });
  it("„Keine Messung notwendig“ ist exklusiv", () => {
    expect(toggleSamplingCode(["Geo", "NOx"], NO_MEASUREMENT_CODE, true)).toEqual([NO_MEASUREMENT_CODE]);
    expect(toggleSamplingCode([NO_MEASUREMENT_CODE], "Geo", true)).toEqual(["Geo"]);
    expect(toggleSamplingCode(["Geo", "NOx"], "NOx", false)).toEqual(["Geo"]);
  });
  it("„Keine Messung notwendig“ erzeugt keine Dienstleistung und keinen Fehlhinweis", () => {
    const r = matchSamplingCodes([NO_MEASUREMENT_CODE], [{ id: "1", service_name: "BENCH NOx" }]);
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual([]);
  });
  it("Bench NOx ordnet nur BENCH NOx zu", () => {
    const r = matchSamplingCodes(["Bench NOx"], [
      { id: "n", service_name: "BENCH NOx" }, { id: "s", service_name: "BENCH SOx" },
    ]);
    expect(r.matched.map((m) => m.id)).toEqual(["n"]);
  });
});

describe("Freie Toleranzen", () => {
  it("Dezimalkomma und Vorzeichen", () => {
    expect(parseToleranceInput("1,5")).toBe(1.5);
    expect(parseToleranceInput("+1")).toBe(1);
    expect(parseToleranceInput("-3")).toBe(-3);
    expect(parseToleranceInput("3 mm")).toBe(3);
    expect(parseToleranceInput("abc")).toBeNull();
  });
  it("asymmetrisch", () => {
    expect(freeTolerance("1", "3")).toBe("(+1/-3) [mm]");
    expect(freeTolerance("0,5", "-1,5")).toBe("(+0,5/-1,5) [mm]");
    expect(freeTolerance("", "3")).toBeNull();
  });
  it("Varianten 1/2 bleiben, freie Werte haben Vorrang nur wenn aktiviert", () => {
    const base = { release: null, orderNumber: null, constants: null };
    expect(deriveM3Values({ ...base, stored: { tolerance_variant: 2 } }).values.length_tolerance).toBe("(+0/-3) [mm]");
    const r = deriveM3Values({ ...base, stored: { tolerance_variant: 1, tolerance_free: true, tol_length_plus: "1", tol_length_minus: "3" } });
    expect(r.values.length_tolerance).toBe("(+1/-3) [mm]");
    expect(r.values.diameter_tolerance).toBe("(+/-2) [mm]");
    const off = deriveM3Values({ ...base, stored: { tolerance_free: false, tol_length_plus: "1", tol_length_minus: "3" } });
    expect(off.values.length_tolerance).toBe("(+3/-3) [mm]");
  });
});

import { resolveTestMarking, applyTestMarking, M3_ROW_ID_FIELD } from "../testMarking";

describe("Elementnummer – freigegebene reine Anzeige", () => {
  it("Stückzahl bleibt numerisch und erhält eine separat abgeleitete Anzeige", () => {
    const r = deriveM3Values({ release: { length_mm: 520 }, orderNumber: null, constants: C, stored: { m3_rows: [{ volume_m3: 4 }] } });
    const row = (r.values.m3_rows as any[])[0];
    expect(row.element_number).toBe("00340");
    expect(row.element_count).toBe(340);
  });
  it("Formatierung: führende Nullen, über fünf Stellen ohne Abschneiden", () => {
    expect(formatElementNumber(99999)).toBe("99999");
    expect(formatElementNumber(123456)).toBe("123456");
  });
});

describe("TEST-Kennzeichnung – stabile Zeilen-ID", () => {
  let n = 0; const id = () => `id-${++n}`;
  it("bleibt bei Verschieben/Löschen anderer Zeilen an derselben Zeile", () => {
    let s: Record<string, unknown> = { m3_rows: [{ volume_m3: 1 }, { volume_m3: 2 }, { volume_m3: 3 }] };
    s = applyTestMarking(s, "m3_rows", 1, id);
    const rows = s.m3_rows as any[];
    const moved = { ...s, m3_rows: [rows[1], rows[2]] }; // Zeile 0 gelöscht
    const res = resolveTestMarking(moved, moved.m3_rows as any[]);
    expect(res).toEqual({ rowIndex: 0, status: "ok" });
    expect((moved.m3_rows as any[])[0].volume_m3).toBe(2);
  });
  it("alte Positions-Kennzeichnung wird nicht geraten", () => {
    expect(resolveTestMarking({ test_charge_row_index: 1 }, [{}, {}])).toEqual({ rowIndex: null, status: "legacy_index" });
  });
  it("duplizierte ID ist mehrdeutig und erhält beim Neumarkieren eine neue ID", () => {
    const rows = [{ [M3_ROW_ID_FIELD]: "x" }, { [M3_ROW_ID_FIELD]: "x" }];
    expect(resolveTestMarking({ test_charge_row_id: "x" }, rows).status).toBe("ambiguous");
    const s = applyTestMarking({ m3_rows: rows }, "m3_rows", 1, () => "neu");
    expect(resolveTestMarking(s, s.m3_rows as any[])).toEqual({ rowIndex: 1, status: "ok" });
  });
  it("Entfernen löscht Altwert und ID-Verweis", () => {
    const s = applyTestMarking({ test_charge_row_index: 0, m3_rows: [{}] }, "m3_rows", null, id);
    expect(s.test_charge_row_index).toBeUndefined();
    expect(s.test_charge_row_id).toBeNull();
  });
});

describe("Bench-Zusatz in der Gesamtmenge", () => {
  const base = { release: { length_mm: 520 }, orderNumber: null, constants: C };
  const rows = [{ volume_m3: 4 }, { volume_m3: 1 }];
  const run = (sel: string[]) => deriveM3Values({ ...base, stored: { m3_rows: rows, lab_tests_selected: sel } }).values;
  it.each([
    [["Geo"], 0], [["Bench NOx"], 1], [["Bench SOx"], 1], [["Bench NOx", "Bench SOx"], 1], [["Bench"], 1],
  ])("%j → Zusatz %i, Gesamt = regulär + Zusatz", (sel, extra) => {
    const v = run(sel as string[]);
    expect(v.bench_extra_pieces).toBe(extra);
    expect(v.regular_element_total).toBe(340 + 90);
    expect(v.total_element_count).toBe(430 + (extra as number));
  });
  it("Speichern und erneutes Öffnen addiert nicht doppelt", () => {
    const v1 = run(["Bench NOx", "Bench SOx"]);
    const stored = stripDerivedValues(v1);
    expect(stored.total_element_count).toBeUndefined();
    expect(stored.bench_extra_pieces).toBeUndefined();
    const v2 = deriveM3Values({ ...base, stored }).values;
    expect(v2.total_element_count).toBe(431);
    expect(stored.lab_tests_selected).toEqual(["Bench NOx", "Bench SOx"]);
  });
});
