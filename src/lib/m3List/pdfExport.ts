/**
 * A4-PDF-Export der m³-Liste (clientseitig, jsPDF, keine Storage-Ablage).
 *
 * Der Export gibt ausschließlich den aktuell abgeleiteten Stand wieder.
 * Eine unveränderliche Originalversion existiert im Datenbestand noch nicht
 * (erfordert Migration 0021) – das PDF weist dies ausdrücklich aus und
 * markiert daher keine Abweichungen gegenüber einem Original.
 */
import { jsPDF } from "jspdf";
import { M3_HEADER_FIELDS, M3_ROWS_KEY } from "./template";
import { formatElementNumber } from "./calculations";

export interface M3PdfRow {
  index: number;
  volume: string;
  pieces: string;
  laborKat: string;
  responsible: string;
  test: boolean;
}

export interface M3PdfModel {
  title: string;
  header: [string, string][];
  labTests: string;
  calc: [string, string][];
  rows: M3PdfRow[];
  totals: string;
  testNotice: string | null;
  notices: string[];
  originalNote: string;
}

const s = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

export function buildM3PdfModel(
  values: Record<string, unknown>,
  opts: { notices: string[]; testRowIndex: number | null }
): M3PdfModel {
  const rows = (Array.isArray(values[M3_ROWS_KEY]) ? values[M3_ROWS_KEY] : []) as Record<string, unknown>[];
  return {
    title: `m³-Liste ${s(values.release_label)}`,
    header: [
      ...M3_HEADER_FIELDS.filter((f) => f.field_key !== "cross_section_mm").map(
        (f) => [f.display_name, s(values[f.field_key])] as [string, string]
      ),
      ["Querschnitt", s(values.cross_section_mm)],
      ["Zellenzahl", s(values.cell_count)],
    ],
    labTests: s(values.lab_tests),
    calc: [
      ["Längentoleranz", s(values.length_tolerance)],
      ["Durchmessertoleranz", s(values.diameter_tolerance)],
      ["Innenwandtoleranz", s(values.inner_wall_tolerance)],
      ["Elemente je m³", s(values.elements_per_m3)],
      ["Labor-KAT-Länge [mm]", s(values.laborkat_length_mm)],
      ["Anzahl Labor-KAT", s(values.labor_kat_count)],
      ["Mikrostück NOx", s(values.micro_nox)],
      ["Mikrostück SOx", s(values.micro_sox)],
    ],
    rows: rows.map((r, i) => ({
      index: i + 1,
      volume: s(r.volume_m3),
      pieces: Object.prototype.hasOwnProperty.call(r, "element_number") ? s(r.element_number) : formatElementNumber(r.element_count),
      laborKat: s(r.row_labor_kat),
      responsible: s(r.row_responsible),
      test: opts.testRowIndex === i,
    })),
    totals: `Reguläre Elementanzahl: ${s(values.regular_element_total)} Stk · Bench-Zusatz: ${s(
      values.bench_extra_pieces ?? 0
    )} Stk · Gesamt: ${s(values.total_element_count)} Stk`,
    testNotice:
      opts.testRowIndex != null && opts.testRowIndex >= 0 && opts.testRowIndex < rows.length
        ? `TEST: Bitte die komplette Charge der m³-Zeile ${opts.testRowIndex + 1} mit einem zusätzlichen Stempel ‚TEST …‘ versehen!`
        : null,
    notices: opts.notices,
    originalNote:
      "Hinweis: Eine unveränderliche Originalversion ist für diese m³-Liste nicht vorhanden. Abweichungen gegenüber dem Original können daher nicht ausgewiesen werden.",
  };
}

const PAGE_W = 210, PAGE_H = 297, M = 14, LINE = 5;

export function renderM3Pdf(model: M3PdfModel): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;
  const ensure = (h: number, onBreak?: () => void) => {
    if (y + h > PAGE_H - M) {
      doc.addPage();
      y = M;
      onBreak?.();
    }
  };
  const text = (t: string, x: number, size = 9, bold = false, width = PAGE_W - 2 * M) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(t, width) as string[];
    ensure(lines.length * LINE);
    doc.text(lines, x, y + 4);
    y += lines.length * LINE;
  };

  text(model.title, M, 14, true);
  y += 2;
  const pairs = (list: [string, string][]) => {
    for (const [k, v] of list) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(v, PAGE_W - 2 * M - 55) as string[];
      ensure(lines.length * LINE);
      doc.setFont("helvetica", "bold");
      doc.text(k, M, y + 4);
      doc.setFont("helvetica", "normal");
      doc.text(lines, M + 55, y + 4);
      y += lines.length * LINE;
    }
  };
  pairs(model.header);
  y += 2;
  text("Labormessungen", M, 11, true);
  text(model.labTests, M);
  y += 2;
  text("Berechnungen", M, 11, true);
  pairs(model.calc);
  y += 3;

  // Tabelle mit Kopfzeilen-Wiederholung
  const cols = [
    { h: "Zeile", w: 18 }, { h: "m³", w: 22 }, { h: "Elementnummer", w: 43 },
    { h: "Labor-Kats", w: 30 }, { h: "Verantwortlich / bearbeitet", w: 47 }, { h: "TEST", w: 22 },
  ];
  const TABLE_SIZE = 18, TABLE_LINE = 7.5, PAD = 2;
  const chargeColors = { background: [255, 235, 59], foreground: [211, 47, 47] } as const;
  const chargeText = model.testNotice ? `Gesamte Charge · ${model.testNotice}` : "Gesamte Charge";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TABLE_SIZE);
  const chargeLines = doc.splitTextToSize(chargeText, PAGE_W - 2 * M - 2 * PAD) as string[];
  const chargeH = chargeLines.length * TABLE_LINE + 2 * PAD;
  ensure(chargeH);
  if (model.testNotice) {
    doc.setFillColor(...chargeColors.background);
    doc.rect(M, y, PAGE_W - 2 * M, chargeH, "F");
    doc.setTextColor(...chargeColors.foreground);
  }
  doc.text(chargeLines, M + PAD, y + PAD + 5.8, { lineHeightFactor: TABLE_LINE / (TABLE_SIZE * 25.4 / 72) });
  doc.setTextColor(0);
  y += chargeH + 3;
  const head = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(TABLE_SIZE);
    const lines = cols.map((c) => doc.splitTextToSize(c.h, c.w - 2 * PAD) as string[]);
    const h = Math.max(...lines.map((l) => l.length)) * TABLE_LINE + 2 * PAD;
    ensure(h);
    let x = M;
    cols.forEach((c, i) => {
      doc.text(lines[i], x + PAD, y + PAD + 5.8, { lineHeightFactor: TABLE_LINE / (TABLE_SIZE * 25.4 / 72) });
      doc.rect(x, y, c.w, h);
      x += c.w;
    });
    y += h;
  };
  text("m³-Tabelle", M, 11, true);
  ensure(14);
  head();
  for (const r of model.rows) {
    const cells = [String(r.index), r.volume, r.pieces, r.laborKat, r.responsible, r.test ? "TEST" : ""];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(TABLE_SIZE);
    doc.setFont("helvetica", r.test ? "bold" : "normal");
    const wrapped = cells.map((c, i) => doc.splitTextToSize(c, cols[i].w - 2 * PAD) as string[]);
    const h = Math.max(...wrapped.map((w) => w.length)) * TABLE_LINE + 2 * PAD;
    ensure(h, head);
    if (r.test) {
      doc.setFillColor(...chargeColors.background);
      doc.rect(M, y, PAGE_W - 2 * M, h, "F");
      doc.setTextColor(...chargeColors.foreground);
    }
    let x = M;
    wrapped.forEach((w, i) => {
      doc.setFont("helvetica", r.test ? "bold" : "normal");
      doc.text(w, x + PAD, y + PAD + 5.8, { lineHeightFactor: TABLE_LINE / (TABLE_SIZE * 25.4 / 72) });
      doc.rect(x, y, cols[i].w, h);
      x += cols[i].w;
    });
    doc.setTextColor(0);
    y += h;
  }
  if (!model.rows.length) text("Keine m³-Zeilen.", M);
  y += 2;
  text(model.totals, M, 9, true);
  for (const n of model.notices) text(`• ${n}`, M, 8);
  y += 2;
  text(model.originalNote, M, 8);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${model.title} · Seite ${p}/${pages}`, M, PAGE_H - 6);
  }
  return doc;
}
