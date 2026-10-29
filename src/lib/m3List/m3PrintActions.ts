/** Druck- und Download-Aktion der m³-Liste – unabhängig voneinander. */
import { buildM3PdfModel, renderM3Pdf } from "./pdfExport";
import { buildM3PrintHtml, m3PdfFileName } from "./printM3Html";
import { printHtml } from "@/lib/runSheet/printHtml";

type Opts = { notices: string[]; testRowIndex: number | null };

export function printM3List(values: Record<string, unknown>, opts: Opts): Promise<void> {
  return printHtml(buildM3PrintHtml(buildM3PdfModel(values, opts)));
}

export function downloadM3Pdf(values: Record<string, unknown>, opts: Opts): void {
  const doc = renderM3Pdf(buildM3PdfModel(values, opts));
  doc.save(m3PdfFileName(values.release_label));
}
