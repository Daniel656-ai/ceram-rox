import { describe, it, expect, vi, beforeEach } from "vitest";

const printHtmlMock = vi.fn(() => Promise.resolve());
vi.mock("@/lib/runSheet/printHtml", () => ({ printHtml: (h: string) => printHtmlMock(h) }));
const saveMock = vi.fn();
vi.mock("jspdf", () => ({
  jsPDF: class {
    save = saveMock;
    setFont() {} setFontSize() {} text() {} line() {} addPage() {} setPage() {}
    splitTextToSize(t: string) { return [t]; }
    getNumberOfPages() { return 1; }
  },
}));

import { buildM3PdfModel } from "../pdfExport";
import { buildM3PrintHtml } from "../printM3Html";
import { printM3List, downloadM3Pdf } from "../m3PrintActions";
import { M3_ROWS_KEY } from "../template";

const values = {
  release_label: "FF-26/001 Rev1",
  cell_count: 400,
  lab_tests: "BET <script>alert(1)</script>",
  elements_per_m3: 123,
  regular_element_total: 250,
  bench_extra_pieces: 2,
  total_element_count: 252,
  [M3_ROWS_KEY]: [
    { volume_m3: 1.5, element_count: 184, row_labor_kat: "A", row_responsible: "Müller & <b>Co</b>" },
    {},
  ],
};

describe("buildM3PrintHtml", () => {
  const model = buildM3PdfModel(values, { notices: ["Hinweis X"], testRowIndex: 0 });
  const html = buildM3PrintHtml(model);

  it("enthält Kopfdaten, Berechnungen und Tabelleninhalte", () => {
    expect(html).toContain("m³-Liste FF-26/001 Rev1");
    for (const [k] of model.header) expect(html).toContain(k);
    expect(html).toContain("Elemente je m³");
    expect(html).toContain("<td>123</td>");
    expect(html).toContain("184 Stk");
    expect(html).toContain("@page { size: A4");
  });

  it("erhält Summen, TEST-Markierung und Hinweise", () => {
    expect(html).toContain("Reguläre Elementanzahl: 250 Stk · Bench-Zusatz: 2 Stk · Gesamt: 252 Stk");
    expect(html).toContain('<tr class="test">');
    expect(html).toContain("m³-Zeile 1 mit einem zusätzlichen Stempel");
    expect(html).toContain("• Hinweis X");
    expect(html).toContain("unveränderliche Originalversion");
  });

  it("escaped HTML-artige Eingaben und zeigt leere Zeilen als —", () => {
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Müller &amp; &lt;b&gt;Co&lt;/b&gt;");
    expect(html).toContain("<tr><td>2</td><td>—</td><td>—</td><td>—</td><td>—</td><td></td></tr>");
  });

  it("zeigt Hinweis ohne Zeilen", () => {
    const h = buildM3PrintHtml(buildM3PdfModel({}, { notices: [], testRowIndex: null }));
    expect(h).toContain("Keine m³-Zeilen.");
  });
});

describe("m³-Aktionen", () => {
  beforeEach(() => { printHtmlMock.mockClear(); saveMock.mockClear(); });

  it("Drucken übergibt die HTML-Druckansicht an printHtml, ohne Download", async () => {
    const opts = { notices: [], testRowIndex: null };
    await printM3List(values, opts);
    expect(printHtmlMock).toHaveBeenCalledWith(buildM3PrintHtml(buildM3PdfModel(values, opts)));
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("Download speichert weiterhin das PDF, ohne Druck", () => {
    downloadM3Pdf(values, { notices: [], testRowIndex: null });
    expect(saveMock).toHaveBeenCalledWith("m3-Liste_FF-26_001_Rev1.pdf");
    expect(printHtmlMock).not.toHaveBeenCalled();
  });
});
