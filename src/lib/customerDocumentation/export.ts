/**
 * Export der Kundendokumentation – PDF und CSV.
 *
 * Es wird ausschließlich das bereits im Projekt verwendete jsPDF genutzt und
 * das bestehende CSV-Muster (Semikolon + UTF-8-BOM). Der Export läuft
 * vollständig im Client und ist damit in Web und Desktop identisch; es wird
 * keine Serverfunktion benötigt und keine Datei kopiert.
 */
import { downloadText } from "@/lib/curves/export";
import type { CustomerDocumentation, DocField } from "./chapters";
import { docLocale, docT, type DocLanguage } from "./i18n";

const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function fieldLabel(t: ReturnType<typeof docT>, f: DocField): string {
  return f.labelKey ? String(t(`fields.${f.labelKey}`)) : (f.label ?? "");
}

/**
 * Strukturierter Datenexport: Kapitel;Abschnitt;Parameter;Wert;Einheit.
 * Bezeichnungen folgen der Dokumentsprache, Messwerte und Einheiten bleiben
 * unverändert.
 */
export function customerDocumentationCsv(doc: CustomerDocumentation, lang: DocLanguage): string {
  const t = docT(lang);
  const lines: string[] = [];
  lines.push(
    [t("table.chapter"), t("table.section"), t("table.parameter"), t("table.value"), t("table.unit")]
      .map((v) => cell(String(v)))
      .join(";")
  );

  const headerTitle = String(t("chapters.header"));
  for (const f of doc.header) {
    lines.push([headerTitle, "", fieldLabel(t, f), f.value, ""].map(cell).join(";"));
  }

  for (const chapter of doc.chapters) {
    const chapterTitle = String(t(`chapters.${chapter.key}`));
    for (const table of chapter.tables) {
      for (const row of table.rows) {
        lines.push(
          [chapterTitle, table.title ?? "", fieldLabel(t, row), row.value, row.unit ?? ""]
            .map(cell)
            .join(";")
        );
      }
    }
    for (const d of chapter.documents) {
      lines.push(
        [chapterTitle, String(t(`doc_kinds.${d.kindKey}`)), d.name, d.reference ?? "", ""]
          .map(cell)
          .join(";")
      );
    }
  }

  return lines.join("\n");
}

export function downloadCustomerDocumentationCsv(
  doc: CustomerDocumentation,
  lang: DocLanguage,
  fileName: string
) {
  downloadText(customerDocumentationCsv(doc, lang), fileName);
}

/** PDF der Kundendokumentation – enthält ausschließlich vorhandene Kapitel. */
export async function exportCustomerDocumentationPdf(opts: {
  doc: CustomerDocumentation;
  lang: DocLanguage;
  fileName: string;
}) {
  const { doc, lang, fileName } = opts;
  const t = docT(lang);
  const locale = docLocale(lang);
  const { default: jsPDF } = await import("jspdf");

  // Die Standardschriften von jsPDF kennen keine Tief-/Hochstellungen. Für das
  // PDF werden sie durch normale Ziffern ersetzt; Anzeige und CSV bleiben
  // unverändert.
  const SUBSCRIPTS: Record<string, string> = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
    "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  };
  const safe = (v: unknown) =>
    String(v ?? "").replace(/[₀-₉⁰¹²³⁴]/g, (c) => SUBSCRIPTS[c] ?? c);
  const clip = (v: unknown, max: number) => {
    const s = safe(v);
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin - 20) {
      pdf.addPage();
      y = margin;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-shadow
  const text = (value: string, x: number, size: number, style: "normal" | "bold" = "normal") => {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", style);
    pdf.text(safe(value), x, y);
  };

  // Titel
  text(String(t("document_title")), margin, 20, "bold");
  y += 26;
  pdf.setDrawColor(180);
  pdf.line(margin, y, pageW - margin, y);
  y += 20;

  // Dokumentationskopf
  text(String(t("chapters.header")), margin, 13, "bold");
  y += 16;
  for (const f of doc.header) {
    ensureSpace(14);
    text(`${fieldLabel(t, f)}:`, margin, 10, "bold");
    text(f.value, margin + 160, 10);
    y += 14;
  }
  y += 10;

  // Inhaltsverzeichnis – nur tatsächlich vorhandene Kapitel
  if (doc.chapters.length) {
    ensureSpace(30);
    text(String(t("toc")), margin, 13, "bold");
    y += 16;
    doc.chapters.forEach((c, i) => {
      ensureSpace(14);
      text(`${i + 1}. ${String(t(`chapters.${c.key}`))}`, margin + 10, 10);
      y += 14;
    });
    y += 10;
  } else {
    text(String(t("no_content")), margin, 10);
    y += 16;
  }

  // Kapitel
  doc.chapters.forEach((chapter, index) => {
    ensureSpace(40);
    y += 8;
    text(`${index + 1}. ${String(t(`chapters.${chapter.key}`))}`, margin, 13, "bold");
    y += 18;

    for (const table of chapter.tables) {
      if (table.title) {
        ensureSpace(16);
        text(table.title, margin, 10, "bold");
        y += 14;
      }
      ensureSpace(14);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(safe(t("table.parameter")), margin + 8, y);
      pdf.text(safe(t("table.value")), margin + 280, y);
      pdf.text(safe(t("table.unit")), margin + 400, y);
      y += 12;
      pdf.setFont("helvetica", "normal");
      for (const row of table.rows) {
        ensureSpace(13);
        pdf.setFontSize(9);
        pdf.text(clip(fieldLabel(t, row), 46), margin + 8, y);
        pdf.text(clip(row.value, 24), margin + 280, y);
        pdf.text(safe(row.unit ?? ""), margin + 400, y);
        y += 12;
      }
      y += 8;
    }

    if (chapter.documents.length) {
      ensureSpace(14);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(safe(t("table.document")), margin + 8, y);
      pdf.text(safe(t("table.kind")), margin + 250, y);
      pdf.text(safe(t("table.reference")), margin + 400, y);
      y += 12;
      pdf.setFont("helvetica", "normal");
      for (const d of chapter.documents) {
        ensureSpace(13);
        pdf.text(clip(d.name, 42), margin + 8, y);
        pdf.text(clip(t(`doc_kinds.${d.kindKey}`), 34), margin + 250, y);
        pdf.text(clip(d.reference ?? "", 30), margin + 400, y);
        y += 12;
      }
      y += 8;
    }
  });

  // Fußzeile: Datum, Sprache, Seitenzahlen
  const pages = pdf.getNumberOfPages();
  const generated = `${String(t("generated_on"))}: ${new Date().toLocaleDateString(locale)}`;
  const languageLabel = `${String(t("language"))}: ${lang.toUpperCase()}`;
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120);
    pdf.text(generated, margin, pageH - 24);
    pdf.text(languageLabel, margin + contentW / 2 - 30, pageH - 24);
    pdf.text(`${String(t("page"))} ${p} / ${pages}`, pageW - margin - 60, pageH - 24);
    pdf.setTextColor(0);
  }

  pdf.save(fileName);
}
