import { describe, it, expect } from "vitest";
import {
  canUseTestMarking,
  readTestMarkingRowIds,
  resolveTestMarkingRows,
  toggleTestMarkingRow,
  buildTestNotice,
  TEST_MARKING_ROW_ID_KEY,
  TEST_MARKING_ROW_IDS_KEY,
  M3_ROW_ID_FIELD,
} from "../testMarking";
import { buildM3PdfModel } from "../pdfExport";
import { buildM3PrintHtml } from "../printM3Html";

const rows = (ids: (string | undefined)[]) => ids.map((id) => (id ? { [M3_ROW_ID_FIELD]: id } : {}));
let seq = 0;
const newId = () => `id-${++seq}`;

describe("Mehrfachauswahl TEST-Kennzeichnung", () => {
  it("eine einzelne markierte Zeile", () => {
    const s = toggleTestMarkingRow({ m3_rows: rows([undefined, undefined]) }, "m3_rows", 1, true, newId);
    const res = resolveTestMarkingRows(s, s.m3_rows as Record<string, unknown>[]);
    expect(res).toEqual({ rowIndices: [1], status: "ok" });
    expect(buildTestNotice(res.rowIndices)).toBe(
      "TEST: Bitte die komplette Charge der m³-Zeile 2 mit einem zusätzlichen Stempel ‚TEST …‘ versehen!"
    );
  });

  it("mehrere markierte Zeilen (1, 3 und 5) mit dynamischem Hinweistext", () => {
    let s: Record<string, unknown> = { m3_rows: rows([undefined, undefined, undefined, undefined, undefined]) };
    for (const i of [0, 2, 4]) s = toggleTestMarkingRow(s, "m3_rows", i, true, newId);
    const res = resolveTestMarkingRows(s, s.m3_rows as Record<string, unknown>[]);
    expect(res.rowIndices).toEqual([0, 2, 4]);
    expect(buildTestNotice(res.rowIndices)).toBe(
      "TEST: Bitte die kompletten Chargen der m³-Zeilen 1, 3 und 5 mit einem zusätzlichen Stempel ‚TEST …‘ versehen!"
    );
  });

  it("unabhängiges An- und Abwählen verändert andere Auswahlen nicht", () => {
    let s: Record<string, unknown> = { m3_rows: rows(["a", "b", "c"]) };
    s = toggleTestMarkingRow(s, "m3_rows", 0, true, newId);
    s = toggleTestMarkingRow(s, "m3_rows", 2, true, newId);
    s = toggleTestMarkingRow(s, "m3_rows", 0, false, newId);
    const res = resolveTestMarkingRows(s, s.m3_rows as Record<string, unknown>[]);
    expect(res.rowIndices).toEqual([2]);
    expect(readTestMarkingRowIds(s)).toEqual(["c"]);
  });

  it("Wiederherstellung nach Speichern und erneutem Öffnen (Roundtrip)", () => {
    let s: Record<string, unknown> = { m3_rows: rows([undefined, undefined, undefined]) };
    s = toggleTestMarkingRow(s, "m3_rows", 0, true, newId);
    s = toggleTestMarkingRow(s, "m3_rows", 2, true, newId);
    const reopened = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    expect(resolveTestMarkingRows(reopened, reopened.m3_rows as Record<string, unknown>[]).rowIndices).toEqual([0, 2]);
  });

  it("Rückwärtskompatibilität: alter Datensatz nur mit test_charge_row_id", () => {
    const stored = { m3_rows: rows(["x", "alt"]), [TEST_MARKING_ROW_ID_KEY]: "alt" };
    expect(readTestMarkingRowIds(stored)).toEqual(["alt"]);
    expect(resolveTestMarkingRows(stored, stored.m3_rows)).toEqual({ rowIndices: [1], status: "ok" });
  });

  it("Konsistenz: test_charge_row_id bleibt synchron zur ersten Auswahl, leer bei leerer Auswahl", () => {
    let s: Record<string, unknown> = { m3_rows: rows(["a", "b"]) };
    s = toggleTestMarkingRow(s, "m3_rows", 1, true, newId);
    s = toggleTestMarkingRow(s, "m3_rows", 0, true, newId);
    expect(s[TEST_MARKING_ROW_IDS_KEY]).toEqual(["b", "a"]);
    expect(s[TEST_MARKING_ROW_ID_KEY]).toBe("b");
    s = toggleTestMarkingRow(s, "m3_rows", 1, false, newId);
    s = toggleTestMarkingRow(s, "m3_rows", 0, false, newId);
    expect(s[TEST_MARKING_ROW_IDS_KEY]).toEqual([]);
    expect(s[TEST_MARKING_ROW_ID_KEY]).toBeNull();
  });

  it("ungültige oder nicht mehr vorhandene Zeilen-IDs", () => {
    const stored = { m3_rows: rows(["a"]), [TEST_MARKING_ROW_IDS_KEY]: ["weg", "", 5, "a"] };
    expect(readTestMarkingRowIds(stored)).toEqual(["weg", "a"]);
    expect(resolveTestMarkingRows(stored, stored.m3_rows)).toEqual({ rowIndices: [0], status: "ok" });
    const gone = { m3_rows: rows(["a"]), [TEST_MARKING_ROW_IDS_KEY]: ["weg"] };
    expect(resolveTestMarkingRows(gone, gone.m3_rows).status).toBe("missing");
  });

  it("mehrdeutige (duplizierte) Zeilen-ID wird nicht geraten", () => {
    const stored = { m3_rows: rows(["dup", "dup"]), [TEST_MARKING_ROW_IDS_KEY]: ["dup"] };
    expect(resolveTestMarkingRows(stored, stored.m3_rows)).toEqual({ rowIndices: [], status: "ambiguous" });
  });

  it("vorhandene Zeilen-IDs werden nie neu erzeugt", () => {
    const s = toggleTestMarkingRow({ m3_rows: rows(["stabil"]) }, "m3_rows", 0, true, () => "NEU");
    expect((s.m3_rows as Record<string, unknown>[])[0][M3_ROW_ID_FIELD]).toBe("stabil");
    expect(s[TEST_MARKING_ROW_IDS_KEY]).toEqual(["stabil"]);
  });

  it("Berechtigungen: zugelassene Rollen dürfen, andere nicht", () => {
    for (const r of ["Administrator", "Messdienstleister", "Teamleiter", "PMO"]) {
      expect(canUseTestMarking([r])).toBe(true);
    }
    expect(canUseTestMarking(["Auftraggeber"])).toBe(false);
    expect(canUseTestMarking([])).toBe(false);
  });

  it("Mehrfachmarkierung in HTML-Druck und PDF-Modell", () => {
    const values = {
      release_label: "FF-1",
      m3_rows: [1, 2, 3].map((i) => ({ volume_m3: i, element_count: i * 10 })),
    };
    const model = buildM3PdfModel(values, { notices: [], testRowIndices: [0, 2] });
    expect(model.rows.map((r) => r.test)).toEqual([true, false, true]);
    expect(model.testNotice).toContain("m³-Zeilen 1 und 3");
    const html = buildM3PrintHtml(model);
    expect(html.match(/<tr class="test">/g)).toHaveLength(2);
    expect(html).toContain("m³-Zeilen 1 und 3");
  });

  it("PDF-Modell: bisheriger Einzelindex bleibt gültig", () => {
    const model = buildM3PdfModel({ m3_rows: [{}, {}] }, { notices: [], testRowIndex: 1 });
    expect(model.rows.map((r) => r.test)).toEqual([false, true]);
    expect(model.testNotice).toContain("m³-Zeile 2");
  });

  it("Hinweistexte: Singular, zwei Zeilen, drei Zeilen, leer", () => {
    expect(buildTestNotice([])).toBeNull();
    expect(buildTestNotice([1])).toContain("m³-Zeile 2 mit");
    expect(buildTestNotice([0, 2])).toContain("m³-Zeilen 1 und 3");
    expect(buildTestNotice([4, 0, 2])).toContain("m³-Zeilen 1, 3 und 5");
  });
});
