import * as XLSX from "xlsx";
import type { ExportCell, ExportSheet } from "@/lib/orderExport/buildOrderExport";

const MIN_WIDTH = 8;
const MAX_WIDTH = 42;

const displayLength = (c: ExportCell): number => {
  if (c.v === null) return 0;
  if (c.v instanceof Date) return 10;
  return String(c.v).length;
};

/** Spaltenbreiten aus dem längsten Eintrag je Spalte (begrenzt), damit nichts abgeschnitten wirkt. */
export function columnWidths(rows: ExportCell[][]): number[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((c, i) => {
      widths[i] = Math.max(widths[i] ?? 0, displayLength(c));
    });
  }
  return widths.map((w) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w + 2)));
}

/**
 * Excel-Arbeitsmappe aus den Blattmodellen. Zahlen bleiben echte Zahlen (volle Genauigkeit);
 * die Anzeige-Nachkommastellen steuert nur das Zahlenformat der Zelle.
 */
export function toWorkbook(sheets: ExportSheet[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(
      sheet.rows.map((r) => r.map((c) => c.v)),
      { cellDates: true },
    );
    sheet.rows.forEach((row, r) =>
      row.forEach((c, col) => {
        if (!c.z || c.v === null) return;
        const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
        if (cell) cell.z = c.z;
      }),
    );
    ws["!cols"] = columnWidths(sheet.rows).map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  return wb;
}

/** Löst den Download der Datei im Browser aus. */
export function downloadWorkbook(sheets: ExportSheet[], fileName: string): void {
  XLSX.writeFile(toWorkbook(sheets), fileName, { cellDates: true });
}
