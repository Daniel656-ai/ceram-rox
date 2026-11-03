import { describe, it, expect, vi, beforeEach } from "vitest";

const printHtmlMock = vi.fn((_html: string) => Promise.resolve());
vi.mock("@/lib/runSheet/printHtml", () => ({ printHtml: (h: string) => printHtmlMock(h) }));
const saveMock = vi.fn();
vi.mock("jspdf", () => ({
  jsPDF: class {
    save = saveMock;
    setFont() {} setFontSize() {} text() {} line() {} addPage() {} setPage() {}
    setFillColor() {} setTextColor() {} rect() {}
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
    expect(html).toContain("00184");
    expect(html).toContain("@page { size: A4");
  });

  it("ordnet Kopfspalten und anschließende Vollbreitenbereiche im Dokumentfluss zu", () => {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    const head = body.querySelector(".print-head");
    const left = head?.querySelector(":scope > .print-head-left");
    const right = head?.querySelector(":scope > .print-head-right");
    expect(head?.children).toHaveLength(2);
    expect(left?.querySelector("h2")?.textContent).toBe("Auftragsdetails");
    expect(Array.from(right?.querySelectorAll("h2") ?? [], (h) => h.textContent))
      .toEqual(["Berechnungen", "Labormessungen"]);
    expect(left?.querySelector(".kv")?.rows.length).toBe(model.header.length);
    expect(right?.querySelector(".kv")?.rows.length).toBe(model.calc.length);
    expect(right?.querySelector("p")?.textContent).toBe(model.labTests);
    const charge = body.querySelector(".charge");
    const rows = body.querySelector(".rows");
    expect(head?.nextElementSibling).toBe(charge);
    expect(charge?.nextElementSibling?.textContent).toBe("m³-Tabelle");
    expect(charge?.nextElementSibling?.nextElementSibling).toBe(rows);
    for (const element of [charge, rows, ...body.querySelectorAll(".totals, .small")]) {
      expect(element?.parentElement).toBe(body);
      expect(head?.contains(element)).toBe(false);
    }
    expect(rows?.nextElementSibling?.className).toBe("totals");
  });

  it("erhält Summen ohne Gesamtzeile, TEST-Markierung und Hinweise", () => {
    expect(html).toContain("Reguläre Elementanzahl: 250 Stk · Bench-Zusatz: 2 Stk");
    expect(html).not.toContain("Gesamt: 252");
    expect(html).toContain('<tr class="test">');
    expect(html).toContain("m³-Zeile 1 mit einem zusätzlichen Stempel");
    expect(html).toContain("• Hinweis X");
    expect(html).toContain("unveränderliche Originalversion");
  });

  it("bricht die Überschrift „Verantwortlich / bearbeitet“ gewünscht um", () => {
    expect(html).toContain("<th>Verantwortlich /<br>bearbeitet</th>");
  });

  it("escaped HTML-artige Eingaben; leere Verantwortlich-Zellen bleiben leer", () => {
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Müller &amp; &lt;b&gt;Co&lt;/b&gt;");
    expect(html).toContain("<tr><td>2</td><td>—</td><td>—</td><td>—</td><td></td><td></td></tr>");
  });

  it("zeigt Hinweis ohne Zeilen", () => {
    const h = buildM3PrintHtml(buildM3PdfModel({}, { notices: [], testRowIndex: null }));
    expect(h).toContain("Keine m³-Zeilen.");
  });
  it("aktivierte Charge hat eigene farbige Druckkennzeichnung, deaktivierte nicht", () => {
    expect(html).toContain('class="charge charge-active"');
    expect(html).toContain("--charge-background: #ffeb3b");
    expect(html).toContain("--charge-foreground: #d32f2f");
    expect(html).toContain("print-color-adjust: exact");
    const neutral = buildM3PrintHtml(buildM3PdfModel(values, { notices: [], testRowIndex: null }));
    expect(neutral).toContain('class="charge"');
    expect(neutral).not.toContain('class="charge charge-active"');
    expect(neutral).not.toContain('<tr class="test">');
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
