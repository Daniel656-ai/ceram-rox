/**
 * Clientseitiger PDF-Export des modularen Ergebnisberichts (jsPDF, Web und
 * Tauri identisch). Nutzt dieselbe Zeichenbehandlung wie die
 * Kundendokumentation (`pdfSafeText`). Keine Bilder, kein Server.
 */
import { pdfSafeText as safe } from "@/lib/customerDocumentation/export";
import { docT } from "@/lib/customerDocumentation/i18n";
import type { RenderedReport, ReportTable } from "./build";

export interface PdfLayout {
  margin: number;
  pageW: number;
  pageH: number;
}

/** Spaltenbreiten proportional zum längsten Inhalt, mit Mindestbreite. */
export function columnWidths(table: ReportTable, contentW: number): number[] {
  const n = table.columns.length;
  const lens = table.columns.map((c, i) =>
    Math.min(60, Math.max(c.length, ...table.rows.map((r) => String(r[i] ?? "").length), 4))
  );
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const min = contentW / (n * 2.5);
  const raw = lens.map((l) => Math.max(min, (l / total) * contentW));
  const scale = contentW / raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w * scale);
}

export async function createReportPdf(report: RenderedReport) {
  const { default: jsPDF } = await import("jspdf");
  const t = docT(report.lang);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const bottom = pageH - margin - 20;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottom) {
      pdf.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  const paragraph = (value: string, size = 10, style: "normal" | "bold" | "italic" = "normal") => {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", style);
    const lineH = size * 1.3;
    for (const para of safe(value).split(/\n/)) {
      const lines: string[] = para.trim() ? pdf.splitTextToSize(para, contentW) : [""];
      for (const line of lines) {
        ensureSpace(lineH);
        pdf.text(line, margin, y);
        y += lineH;
      }
    }
  };

  const drawTable = (table: ReportTable) => {
    const widths = columnWidths(table, contentW);
    const size = 8.5;
    const lineH = size * 1.25;
    const pad = 3;
    const header = () => {
      pdf.setFontSize(size);
      pdf.setFont("helvetica", "bold");
      const cells = table.columns.map((c, i) => pdf.splitTextToSize(safe(c), widths[i] - pad * 2) as string[]);
      const h = Math.max(...cells.map((c) => c.length)) * lineH + pad * 2;
      ensureSpace(h + lineH + pad * 2);
      pdf.setFillColor(235, 239, 244);
      pdf.rect(margin, y, contentW, h, "F");
      let x = margin;
      cells.forEach((c, i) => {
        pdf.text(c, x + pad, y + pad + size);
        x += widths[i];
      });
      y += h;
      pdf.setFont("helvetica", "normal");
    };
    // Abstand vor der Tabelle, Kopf + mindestens eine Zeile zusammenhalten
    y += 4;
    header();
    for (const row of table.rows) {
      pdf.setFontSize(size);
      const cells = table.columns.map((_, i) => pdf.splitTextToSize(safe(row[i] ?? ""), widths[i] - pad * 2) as string[]);
      const h = Math.max(1, ...cells.map((c) => c.length)) * lineH + pad * 2;
      if (ensureSpace(h)) header();
      let x = margin;
      cells.forEach((c, i) => {
        pdf.text(c, x + pad, y + pad + size);
        x += widths[i];
      });
      pdf.setDrawColor(215);
      pdf.line(margin, y + h, margin + contentW, y + h);
      y += h;
    }
    y += 10;
  };

  // Titel
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  for (const line of pdf.splitTextToSize(safe(report.title), contentW) as string[]) {
    pdf.text(line, margin, y + 4);
    y += 22;
  }
  pdf.setDrawColor(180);
  pdf.line(margin, y, pageW - margin, y);
  y += 20;

  report.sections.forEach((s, idx) => {
    ensureSpace(48);
    paragraph(`${idx + 1}. ${s.heading}`, 13, "bold");
    y += 4;
    for (const f of s.fields) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(safe(f.value), contentW - 160) as string[];
      ensureSpace(lines.length * 13);
      pdf.setFont("helvetica", "bold");
      pdf.text(safe(`${f.label}:`), margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(lines, margin + 160, y);
      y += lines.length * 13;
    }
    if (s.fields.length) y += 6;
    if (s.standardText.trim()) { paragraph(s.standardText); y += 4; }
    if (s.orderText.trim()) { paragraph(s.orderText); y += 4; }
    for (const table of s.tables) drawTable(table);
    if (s.empty) { paragraph(String(t("modular_report.no_data")), 9, "italic"); }
    y += 10;
  });

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120);
    pdf.text(safe(`${String(t("generated_on"))}: ${report.generatedOn}`), margin, pageH - 24);
    pdf.text(`${String(t("language"))}: ${report.lang.toUpperCase()}`, margin + contentW / 2 - 30, pageH - 24);
    pdf.text(`${String(t("page"))} ${p} / ${pages}`, pageW - margin - 60, pageH - 24);
    pdf.setTextColor(0);
  }
  return pdf;
}

export async function exportReportPdf(report: RenderedReport, fileName: string) {
  const pdf = await createReportPdf(report);
  pdf.save(fileName);
}
