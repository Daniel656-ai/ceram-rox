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
      pieces: r.element_count == null ? "—" : `${r.element_count} Stk`,
      laborKat: s(r.row_labor_kat),
      responsible: s(r.row_responsible),
      test: opts.testRowIndex === i,
    })),
    totals: `Reguläre Elementanzahl: ${s(values.regular_element_total)} Stk · Bench-Zusatz: ${s(
      values.bench_extra_pieces ?? 0
    )} Stk · Gesamt: ${s(values.total_element_count)} Stk`,
    testNotice:
      opts.testRowIndex != null && opts.testRowIndex < rows.length
        ? `TEST: Bitte die komplette Charge der m³-Zeile ${opts.testRowIndex + 1} mit einem zusätzlichen Stempel ‚TEST …‘ versehen!`
        : null,
    notices: opts.notices,
    originalNote:
      "Hinweis: Eine unveränderliche Originalversion ist für diese m³-Liste nicht vorhanden. Abweichungen gegenüber dem Original können daher nicht ausgewiesen werden. Die Zeilenstückzahl ist keine Elementnummer.",
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
    { h: "Zeile", w: 16 }, { h: "m³", w: 24 }, { h: "Stückzahl", w: 30 },
    { h: "Labor-KAT", w: 24 }, { h: "verantwortlich", w: 70 }, { h: "TEST", w: 18 },
  ];
  const head = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let x = M;
    for (const c of cols) { doc.text(c.h, x + 1, y + 4); x += c.w; }
    doc.line(M, y + 5.5, M + cols.reduce((a, c) => a + c.w, 0), y + 5.5);
    y += 7;
  };
  text("m³-Tabelle", M, 11, true);
  ensure(14);
  head();
  for (const r of model.rows) {
    const cells = [String(r.index), r.volume, r.pieces, r.laborKat, r.responsible, r.test ? "TEST" : ""];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const wrapped = cells.map((c, i) => doc.splitTextToSize(c, cols[i].w - 2) as string[]);
    const h = Math.max(...wrapped.map((w) => w.length)) * LINE + 1;
    ensure(h, head);
    let x = M;
    wrapped.forEach((w, i) => {
      doc.setFont("helvetica", r.test ? "bold" : "normal");
      doc.text(w, x + 1, y + 4);
      x += cols[i].w;
    });
    y += h;
  }
  if (!model.rows.length) text("Keine m³-Zeilen.", M);
  y += 2;
  text(model.totals, M, 9, true);
  if (model.testNotice) { y += 2; text(model.testNotice, M, 10, true); }
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
