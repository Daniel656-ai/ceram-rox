import { describe, it, expect } from "vitest";
import { buildM3PdfModel, renderM3Pdf } from "../pdfExport";

const values = (n: number) => ({
  release_label: "FF-1 · Rev1",
  order_number: "A123",
  lab_tests: "Geo, NOx, Bench NOx",
  regular_element_total: 430,
  bench_extra_pieces: 1,
  total_element_count: 431,
  m3_rows: Array.from({ length: n }, (_, i) => ({ volume_m3: i + 1, element_count: 10 * (i + 1), row_labor_kat: 2 })),
});

describe("m³-PDF", () => {
  it("enthält alle Zeilen, Mengen, TEST und Original-Hinweis", () => {
    const m = buildM3PdfModel(values(3), { notices: ["n1"], testRowIndex: 1 });
    expect(m.rows).toHaveLength(3);
    expect(m.rows[1].test).toBe(true);
    expect(m.rows[0].pieces).toBe("00010");
    expect(m.totals).toContain("Gesamt: 431 Stk");
    expect(m.testNotice).toContain("m³-Zeile 2");
    expect(m.originalNote).toContain("Originalversion");
    expect(m.header.find(([k]) => k === "Auftrag")?.[1]).toBe("A123");
  });
  it("mehrseitig ohne Zeilenverlust", () => {
    const doc = renderM3Pdf(buildM3PdfModel(values(120), { notices: [], testRowIndex: null }));
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
  });
  it("tatsächliches PDF enthält führende Nullen, Elementnummer und aktive Chargenfarben", () => {
    const m = buildM3PdfModel({ m3_rows: [{ element_count: 970, row_responsible: "AB" }] }, { notices: [], testRowIndex: 0 });
    expect(m.rows[0].pieces).toBe("00970");
    const pdf = renderM3Pdf(m).output();
    expect(pdf).toContain("00970");
    const renderedText = Array.from(pdf.matchAll(/\(([^()]*)\) Tj/g), (match) => match[1]).join("");
    expect(renderedText).toContain("Elementnummer");
    expect(pdf).toContain("Gesamte Charge");
    expect(pdf).toContain("1. 0.92 0.23 rg");
    expect(pdf).toContain("0.827 0.184 0.184 rg");
  });
  it("neutrales PDF enthält keine aktive Chargenfüllung und keine ungültige Nummer", () => {
    const m = buildM3PdfModel({ m3_rows: [{ element_count: -1 }, { element_count: 970, element_number: null }] }, { notices: [], testRowIndex: null });
    expect(m.rows.map((r) => r.pieces)).toEqual(["—", "—"]);
    expect(renderM3Pdf(m).output()).not.toContain("1. 0.92 0.23 rg");
  });
});
