/**
 * Export der drei strikt getrennten Ebenen:
 *
 * 1. Rohdaten   – exakt die importierten Messpunkte, niemals verändert.
 * 2. Auswertung – gespeicherte Auswertungspunkte samt Diagramm.
 *
 * Der Export liest ausschließlich; er schreibt nie in die Rohdaten zurück.
 */
import type { MeasurementChannel, MeasurementDataset } from "./dataset";
import type { CurveEvaluationRecord } from "@/lib/api/measurementRawData";

const BOM = "\uFEFF";

/** Zahl im deutschen Format (Dezimalkomma), damit Excel korrekt einliest. */
const de = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "" : String(v).replace(".", ",");

const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const channelHeader = (c: MeasurementChannel) => (c.unit ? `${c.label} [${c.unit}]` : c.label);

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, fileName: string, mime = "text/csv;charset=utf-8") {
  downloadBlob(new Blob([BOM + text], { type: mime }), fileName);
}

/** CSV der unveränderten Original-Rohdaten. */
export function rawDataCsv(dataset: MeasurementDataset, meta?: Record<string, string | null | undefined>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (v) lines.push(`# ${cell(k)};${cell(String(v))}`);
  }
  lines.push(dataset.channels.map((c) => cell(channelHeader(c))).join(";"));
  for (const row of dataset.rows) {
    lines.push(dataset.channels.map((_, i) => de(row[i])).join(";"));
  }
  return lines.join("\n");
}

/** CSV der gespeicherten Auswertung (Tabelle; das Diagramm liegt im PDF-Export). */
export function evaluationCsv(records: CurveEvaluationRecord[], meta?: Record<string, string | null | undefined>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (v) lines.push(`# ${cell(k)};${cell(String(v))}`);
  }
  lines.push(
    ["Auswertungsmethode", "Kurve", "X-Größe", "X-Wert", "X-Einheit", "Y-Wert", "Einheit", "Kommentar", "Im Bericht", "Erstellt", "Zuletzt geändert"]
      .map(cell)
      .join(";")
  );
  for (const r of records) {
    lines.push(
      [
        r.method_label ?? r.method,
        r.y_label ?? r.y_channel,
        r.x_label ?? r.x_channel,
        de(r.kind === "point" ? r.x_at : r.x_from),
        r.x_unit ?? "",
        de(r.value),
        r.unit ?? "",
        r.comment ?? "",
        r.include_in_report ? "ja" : "nein",
        new Date(r.created_at).toLocaleString("de-AT"),
        new Date(r.updated_at ?? r.created_at).toLocaleString("de-AT"),
      ]
        .map((v) => cell(String(v)))
        .join(";")
    );
  }
  return lines.join("\n");
}

/**
 * PDF-Export der Auswertung: Tabelle **und** Diagramm mit eingezeichneten
 * Auswertungspunkten.
 */
export async function exportEvaluationPdf(opts: {
  title: string;
  subtitle?: string;
  records: CurveEvaluationRecord[];
  chartElement?: HTMLElement | null;
  fileName: string;
}) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  doc.setFontSize(14);
  doc.text(opts.title, margin, y);
  y += 18;
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.text(opts.subtitle, margin, y);
    y += 14;
  }

  if (opts.chartElement) {
    try {
      const canvas = await html2canvas(opts.chartElement, { backgroundColor: "#ffffff", scale: 2 });
      const w = pageW - margin * 2;
      const h = (canvas.height / canvas.width) * w;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, w, h);
      y += h + 16;
    } catch {
      /* Diagramm konnte nicht gerendert werden – Tabelle bleibt erhalten. */
    }
  }

  doc.setFontSize(9);
  const cols = [
    { label: "Kurve", w: 150 },
    { label: "X", w: 80 },
    { label: "Y", w: 90 },
    { label: "Einheit", w: 60 },
    { label: "Methode", w: 135 },
  ];
  const drawHeader = () => {
    let x = margin;
    doc.setFont(undefined as any, "bold");
    for (const c of cols) {
      doc.text(c.label, x, y);
      x += c.w;
    }
    doc.setFont(undefined as any, "normal");
    y += 12;
  };
  drawHeader();
  for (const r of opts.records) {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    const values = [
      r.y_label ?? r.y_channel,
      `${de(r.kind === "point" ? r.x_at : r.x_from)}${r.x_unit ? ` ${r.x_unit}` : ""}`,
      de(r.value),
      r.unit ?? "",
      r.method_label ?? r.method,
    ];
    let x = margin;
    values.forEach((v, i) => {
      doc.text(String(v).slice(0, 40), x, y);
      x += cols[i].w;
    });
    y += 12;
    if (r.comment) {
      doc.setTextColor(120);
      doc.text(`Kommentar: ${r.comment}`, margin + 10, y);
      doc.setTextColor(0);
      y += 12;
    }
  }

  doc.save(opts.fileName);
}
