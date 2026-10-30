import { describe, it, expect } from "vitest";
import { deriveM3Values, stripDerivedValues } from "../derive";
import type { M3Constants } from "../calculations";
import { formatElementNumber } from "../calculations";

const constants: M3Constants = {
  crossSectionM: 0.15,
  pressureTestMm: 150,
  rsmMaxMm: 350,
  laborKatAddMm: 50,
  elementRounding: 10,
};

const release = {
  id: "rel-1",
  release_number: "FF-2024-001",
  revision_number: 2,
  project_name: "Projekt A",
  customer_name: "Kunde A",
  end_customer: "Endkunde A",
  article_number: "ART-1",
  length_mm: 520,
  piece_count: 100,
  inner_wall_thickness_mm: 0.6,
  cross_section_mm: 150,
  v2o5_percent: 1.2,
  cell_configuration: "20 Zellen",
};

describe("m³-Liste – Ableitung der Formularwerte", () => {
  it("übernimmt graue Werte nur aus der übergebenen Revision und berechnet die Zeilen", () => {
    const r = deriveM3Values({
      release,
      orderNumber: "0020-5436",
      stored: {
        delivery_volume_m3: 8.47,
        sox_required: true,
        av_nox: 25,
        av_sox: 10,
        spare_elements: 4,
        mounting_frames: 4,
        tolerance_variant: 1,
        m3_rows: [{ volume_m3: 4 }, { volume_m3: 4.47 }],
      },
      constants,
    });

    expect(r.values.project_name).toBe("Projekt A");
    expect(r.values.release_label).toBe("FF-2024-001 · Rev2");
    expect(r.cellCount).toBe(20);
    expect(r.values.labor_kat_count).toBe(2);
    expect(r.values.marking_elements).toBe(9);
    expect(r.values.lab_tests).toBe("Geo, NOx, SOx, BET, PV, DP, A, CA");
    const rows = r.values.m3_rows as Record<string, unknown>[];
    expect(rows[0].element_count).toBe(340);
    expect(rows[1].element_count).toBe(380);
  });

  it("meldet SOx-Entfall über 20 m³ als Hinweis", () => {
    const r = deriveM3Values({
      release,
      orderNumber: "0020-5436",
      stored: { delivery_volume_m3: 25, sox_required: true },
      constants,
    });
    expect(r.values.lab_tests).toBe("Geo, NOx, BET, PV, DP, A, CA");
    expect(r.notices.join(" ")).toContain("entfällt");
  });

  it("speichert nur Eingabewerte, keine berechneten Werte", () => {
    const stripped = stripDerivedValues({
      project_name: "Projekt A",
      lab_tests: "Geo",
      delivery_volume_m3: 8.47,
      test_charge_row_id: "stable-1",
      m3_rows: [{ volume_m3: 4, element_count: 340, element_number: "00340", row_labor_kat: 2, __m3_row_id: "stable-1", row_responsible: "AB" }],
    });
    expect(stripped.project_name).toBeUndefined();
    expect(stripped.lab_tests).toBeUndefined();
    expect(stripped.delivery_volume_m3).toBe(8.47);
    expect(stripped.test_charge_row_id).toBe("stable-1");
    expect(stripped.m3_rows).toEqual([{ volume_m3: 4, __m3_row_id: "stable-1", row_responsible: "AB" }]);
  });
});

describe("freigegebene Elementnummern", () => {
  it.each([[970, "00970"], [1, "00001"], [12345, "12345"], [0, "00000"], [123456, "123456"]])("%s → %s", (count, expected) => {
    expect(formatElementNumber(count)).toBe(expected);
  });
  it.each([null, undefined, "", "970", "abc", -1, 1.5, NaN, Infinity, true, {}, Number.MAX_SAFE_INTEGER + 1])("ungültig %s bleibt Platzhalter", (count) => {
    expect(formatElementNumber(count)).toBe("—");
  });
  it("leere/ungültige Zeilen oder fehlende Berechnungsgrundlagen bleiben ohne Nummer", () => {
    const stored = { m3_rows: [{}, { volume_m3: "abc" }, { volume_m3: -1 }] };
    const result = deriveM3Values({ release, stored, orderNumber: null, constants });
    expect((result.values.m3_rows as Record<string, unknown>[]).map((r) => r.element_number)).toEqual([null, null, null]);
    const missing = deriveM3Values({ release, stored: { m3_rows: [{ volume_m3: 15, element_number: "stale" }] }, orderNumber: null, constants: null });
    expect((missing.values.m3_rows as Record<string, unknown>[])[0].element_number).toBeNull();
  });
});

describe("manuelle Beprobungsauswahl", () => {
  const base = { release: null, orderNumber: null, constants: null };
  it("nutzt den automatischen Vorschlag, solange nichts gespeichert ist", () => {
    const r = deriveM3Values({ ...base, stored: {} });
    expect(r.values.lab_tests).toBe(r.values.lab_tests_auto);
  });
  it("gespeicherte Auswahl ist maßgeblich", () => {
    const r = deriveM3Values({ ...base, stored: { lab_tests_selected: ["Geo", "SOx", "Bench"] } });
    expect(r.values.lab_tests).toBe("Geo, SOx, Bench");
  });
  it("Auswahl bleibt beim Speichern erhalten, Automatik nicht", () => {
    const stripped = stripDerivedValues({ lab_tests: "Geo", lab_tests_auto: "Geo, NOx", lab_tests_selected: ["Geo"] });
    expect(stripped.lab_tests).toBeUndefined();
    expect(stripped.lab_tests_auto).toBeUndefined();
    expect(stripped.lab_tests_selected).toEqual(["Geo"]);
  });
});
