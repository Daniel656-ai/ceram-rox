/**
 * Druckfertige A4-HTML-Ansicht der m³-Liste aus dem bestehenden `M3PdfModel`.
 * Inhalte und Reihenfolge entsprechen `renderM3Pdf`; keine eigenen Berechnungen.
 */
import type { M3PdfModel } from "./pdfExport";

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const pairs = (list: [string, string][]) =>
  `<table class="kv">${list
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join("")}</table>`;

export function buildM3PrintHtml(model: M3PdfModel): string {
  const rows = model.rows.length
    ? model.rows
        .map(
          (r) =>
            `<tr${r.test ? ' class="test"' : ""}><td>${r.index}</td><td>${escapeHtml(r.volume)}</td><td>${escapeHtml(
              r.pieces
            )}</td><td>${escapeHtml(r.laborKat)}</td><td>${escapeHtml(r.responsible)}</td><td>${
              r.test ? "TEST" : ""
            }</td></tr>`
        )
        .join("")
    : `<tr><td colspan="6">Keine m³-Zeilen.</td></tr>`;

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title>
<style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #000; margin: 0; }
h1 { font-size: 14pt; margin: 0 0 3mm; }
h2 { font-size: 11pt; margin: 4mm 0 1.5mm; break-after: avoid; }
table { border-collapse: collapse; width: 100%; }
.kv th { text-align: left; width: 55mm; padding: 0.6mm 2mm 0.6mm 0; vertical-align: top; }
.kv td { padding: 0.6mm 0; white-space: pre-wrap; word-break: break-word; }
.rows thead { display: table-header-group; }
.rows th, .rows td { border-bottom: 0.2mm solid #999; padding: 1mm; text-align: left; vertical-align: top; word-break: break-word; }
.rows tr { break-inside: avoid; }
.rows tr.test td { font-weight: bold; }
.totals { font-weight: bold; margin-top: 2mm; }
.testnotice { font-weight: bold; font-size: 10pt; margin-top: 2mm; }
.small { font-size: 8pt; }
p { margin: 1mm 0; white-space: pre-wrap; }
</style></head><body>
<h1>${escapeHtml(model.title)}</h1>
${pairs(model.header)}
<h2>Labormessungen</h2>
<p>${escapeHtml(model.labTests)}</p>
<h2>Berechnungen</h2>
${pairs(model.calc)}
<h2>m³-Tabelle</h2>
<table class="rows"><thead><tr><th style="width:16mm">Zeile</th><th style="width:24mm">m³</th><th style="width:30mm">Stückzahl</th><th style="width:24mm">Labor-KAT</th><th>verantwortlich</th><th style="width:18mm">TEST</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="totals">${escapeHtml(model.totals)}</p>
${model.testNotice ? `<p class="testnotice">${escapeHtml(model.testNotice)}</p>` : ""}
${model.notices.map((n) => `<p class="small">• ${escapeHtml(n)}</p>`).join("")}
<p class="small">${escapeHtml(model.originalNote)}</p>
</body></html>`;
}

export function m3PdfFileName(releaseLabel: unknown): string {
  return `m3-Liste_${String(releaseLabel ?? "export").replace(/[^\w.-]+/g, "_")}.pdf`;
}
