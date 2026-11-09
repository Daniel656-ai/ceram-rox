/** Druck-HTML für Vorgabewerte – nutzt die gemeinsame Formatierung (`specValues`). */
import { rawMaterialValueLabel, type RawMaterialLookup } from "@/lib/rawMaterials/displayLabel";
import { isEmptySpecValue, primSpecValue, specColLabel, specValueShape } from "@/lib/specValues";

export const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const cell = (col: string | null, v: unknown, materials: Map<string, RawMaterialLookup>) => {
  if (isEmptySpecValue(v)) return "–";
  const d = rawMaterialValueLabel(col, v, materials);
  return escHtml(d ? d.label : primSpecValue(v));
};

/**
 * Wert als HTML: Listen von Objekten → Tabelle, Listen → kommagetrennt,
 * Einzelwert → Text (+ Einheit). Leer → „–“, nie 0.
 */
export function specValueHtml(
  raw: unknown,
  unit: string | null | undefined,
  materials: Map<string, RawMaterialLookup>,
  colLabels?: Map<string, string>,
): string {
  const shape = specValueShape(raw);
  if (shape.kind === "table") {
    const label = (c: string) => colLabels?.get(c) ?? specColLabel(c);
    return `<table class="inner"><thead><tr><th>#</th>${shape.cols.map((c) => `<th>${escHtml(label(c))}</th>`).join("")}</tr></thead><tbody>${
      shape.rows.map((r, i) => `<tr><td>${i + 1}</td>${shape.cols.map((c) => `<td>${cell(c, r[c], materials)}</td>`).join("")}</tr>`).join("")
    }</tbody></table>`;
  }
  if (shape.kind === "list") {
    return shape.items.length === 0 ? "–" : shape.items.map((x) => cell(null, x, materials)).join(", ");
  }
  const text = cell(null, shape.value, materials);
  return text === "–" || !unit ? text : `${text} ${escHtml(unit)}`;
}

/** Gemeinsame Druckregeln der Laufzettel (A4, mehrseitig, Tabellenköpfe wiederholen). */
export const RUN_SHEET_CSS = `
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  header { display: flex; justify-content: space-between; gap: 8mm; border-bottom: 1px solid #999; padding-bottom: 4mm; }
  h1 { font-size: 16pt; margin: 0 0 3mm; }
  h2 { font-size: 12pt; margin: 5mm 0 2mm; break-after: avoid; }
  h3 { font-size: 11pt; margin: 4mm 0 1.5mm; break-after: avoid; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 1mm 4mm; margin: 0; font-size: 11pt; }
  dt { color: #444; } dd { margin: 0; font-weight: bold; }
  .dmc svg { width: 32mm; height: 32mm; }
  .stand { display: flex; flex-direction: column; gap: 1mm; font-size: 9pt; margin-top: 3mm; }
  .muted { color: #666; font-weight: normal; }
  .warn { color: #b45309; font-weight: bold; font-size: 8.5pt; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 1.2mm 2mm; text-align: left; vertical-align: top; }
  th { background: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.inner { width: auto; font-size: 9pt; }
  table.inner th, table.inner td { padding: 0.6mm 1.5mm; }
  .grp { margin: 6mm 0 2mm; padding: 1.5mm 3mm; background: #d9d9d9; font-weight: bold; font-size: 11.5pt; break-after: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .grp-sub { margin: 3mm 0 1mm; font-weight: bold; color: #333; border-bottom: 1px solid #999; break-after: avoid; }
  section.svc { break-inside: avoid; border: 1px solid #ccc; padding: 1.5mm 2.5mm 2mm; margin: 2mm 0; }
  section.svc h3 { margin-top: 0.5mm; }
  .status { float: right; font-size: 8.5pt; border: 1px solid #888; padding: 0.3mm 1.5mm; font-weight: normal; }
  th.write, td.write { width: 32%; height: 7mm; }
  .sign { display: flex; gap: 6mm; margin-top: 2mm; font-size: 9pt; }
  .sign span { flex: 1; border-bottom: 1px solid #777; padding-bottom: 4mm; }
`;
