import { format, parseISO } from "date-fns";
import {
  buildOrderComparison,
  contextText,
  groupRecordsByOrder,
  runsAreRepeats,
  runStatus,
  type ComparisonRow,
  type ComparisonSection,
} from "@/lib/results/orderGroups";
import type { SampleGroup, SampleMeasurementRecord } from "@/lib/results/sampleResultsAggregation";
import { resolveResultPrecision, type PrecisionDefinitions } from "@/lib/resultDisplayPrecision";
import { formatResultLabel } from "@/lib/resultLabels";
import { toUnicode } from "@/lib/richText";
import { formatElementKey } from "@/lib/elementKeys";
import {
  ACTIVITY_GAS_UNIT,
  extractActivity,
  type ActivityValue,
  type ActivityView,
} from "@/lib/results/activityMeasurement";

/**
 * Excel-Export eines ganzen Auftrags: Blatt „Übersicht“ + je Probe ein Blatt (Blattname = Probennummer),
 * im Probenblatt je Messart eine kleine Tabelle untereinander. Offizielle und vorläufige Werte (Spalte „Status“), nur lesen.
 * Reine Funktion (kein Download, keine Datenbank) – gut testbar.
 */

export type ExportCellValue = string | number | Date | null;
export interface ExportCell {
  v: ExportCellValue;
  /** Excel-Zahlen-/Datumsformat (z. B. "0.00"), nur bei Zahlen/Datum. */
  z?: string;
}
export interface ExportSheet {
  name: string;
  rows: ExportCell[][];
}
export interface OrderExportInput {
  /** ALLE Messungen des Auftrags (unabhängig von Seitenfiltern). */
  records: SampleMeasurementRecord[];
  /** Bereits übersetzte Statusbezeichnung des Auftrags. */
  statusLabel: string;
  workflowLabel?: string | null;
  precision: PrecisionDefinitions;
  exportDate: Date;
}
export interface OrderExportResult {
  fileName: string;
  sheets: ExportSheet[];
  /** Kennzahlen für die Rückmeldung an den Nutzer. */
  summary: { samples: number; services: number; values: number };
}

export const OVERVIEW_SHEET = "Übersicht";
const DATE_FORMAT = "dd.mm.yyyy";

const text = (v: string | null | undefined): ExportCell => ({ v: v && v.trim() ? v : null });
const num = (v: number, z?: string): ExportCell => ({ v, z });
const date = (iso: string | null | undefined): ExportCell => {
  if (!iso) return { v: null };
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? { v: null } : { v: d, z: DATE_FORMAT };
};
const blank: ExportCell = { v: null };

const zFor = (decimals: number | undefined): string | undefined =>
  decimals === undefined ? undefined : decimals > 0 ? `0.${"0".repeat(decimals)}` : "0";

/** Gültiger, eindeutiger Excel-Blattname (max. 31 Zeichen, ohne \ / ? * [ ] :). */
export function uniqueSheetName(raw: string, used: Set<string>): string {
  const base = (raw || "Probe").replace(/[\\/?*[\]:]/g, "-").replace(/\s+/g, " ").trim().slice(0, 31) || "Probe";
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${i})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
    i += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

export function exportFileName(orderNumber: string, exportDate: Date): string {
  const safe = (orderNumber || "Auftrag").trim().replace(/\s+/g, "_").replace(/[\\/:*?"<>|]+/g, "-");
  return `${safe}_Ergebnisse_${format(exportDate, "yyyy-MM-dd")}.xlsx`;
}

const valueCount = (row: ComparisonRow | undefined): number =>
  row ? row.runs.reduce((n, run) => n + Object.values(run.cells).reduce((m, v) => m + v.length, 0), 0) : 0;

const distinct = (xs: Array<string | null | undefined>): string[] => [
  ...new Set(xs.filter((x): x is string => !!x && x.trim() !== "")),
];

/** Zelle eines Durchlaufs: genau ein Wert (zur Sicherheit mehrere als Text, nie verwerfen). */
function runCell(values: Array<number | string> | undefined, z: string | undefined): ExportCell {
  if (!values || values.length === 0) return blank;
  if (values.length === 1) return typeof values[0] === "number" ? num(values[0], z) : text(String(values[0]));
  return text(values.map(String).join(" / "));
}

const activityCell = (v: ActivityValue): ExportCell =>
  v === null ? blank : typeof v === "number" ? num(v) : text(v);

/** Aktivitätsmessung: je Katalysator Probendaten, „Messbedingungen“ und „Ergebnisse je Temperatur“ (Gase in/out als eigene Zahlenspalten); am Ende „Weitere Angaben“. */
export function activityExportRows(view: ActivityView): ExportCell[][] {
  const rows: ExportCell[][] = [];
  const status = view.official ? "offiziell" : "vorläufig";
  const fieldHead = (f: { label: string; unit: string | null }) => text(f.unit ? `${f.label} [${f.unit}]` : f.label);
  for (const cat of view.catalysts) {
    const title = cat.title ?? (view.catalysts.length > 1 ? String(cat.index) : null);
    rows.push([text(title ? `Aktivitätsmessung · Katalysator ${title}` : "Aktivitätsmessung"), text(status)]);
    if (cat.sampleData.length) {
      rows.push([text("Probendaten")]);
      rows.push(cat.sampleData.map(fieldHead));
      rows.push(cat.sampleData.map((f) => activityCell(f.value)));
      rows.push([]);
    }
    rows.push([text("Messbedingungen")]);
    const c = cat.conditions;
    rows.push([
      text("AV [m/h]"), text("FR [Nm³/h]"), text("NO in [ppm]"), text(`${formatElementKey("NH3")} in [ppm]`),
      text(`${formatElementKey("H2O")} in [%]`), text(`${formatElementKey("O2")} in [%]`), text(`${formatElementKey("N2")} in`),
    ]);
    rows.push([c.av, c.fr, c.no, c.nh3, c.h2o, c.o2].map(activityCell).concat([text("Rest")]));
    rows.push([]);
    rows.push([text("Ergebnisse je Temperatur")]);
    rows.push([
      text("Temperatur [°C]"), text("η NOx [%]"), text("K-Wert [Nm/h]"),
      ...cat.gasColumns.flatMap((g) => [
        text(`${formatElementKey(g)} in [${ACTIVITY_GAS_UNIT[g]}]`),
        text(`${formatElementKey(g)} out [${ACTIVITY_GAS_UNIT[g]}]`),
      ]),
      text("Status"),
    ]);
    for (const r of cat.rows) {
      rows.push([
        activityCell(r.temperature), activityCell(r.eta), activityCell(r.k),
        ...cat.gasColumns.flatMap((g) => [activityCell(r.gases[g]?.in ?? null), activityCell(r.gases[g]?.out ?? null)]),
        text(status),
      ]);
    }
    rows.push([]);
  }
  if (view.other.length) {
    rows.push([text("Weitere Angaben")]);
    for (const f of view.other) rows.push([text(f.label), activityCell(f.value), text(f.unit)]);
    rows.push([]);
  }
  return rows;
}

function sampleSheet(
  sample: SampleGroup,
  sections: ComparisonSection[],
  header: { orderNumber: string; project: string },
  precision: PrecisionDefinitions,
  name: string,
): ExportSheet {
  const rows: ExportCell[][] = [];
  rows.push([text("Probenbezeichnung"), text(sample.sampleName || sample.sampleNumber || "–")]);
  rows.push([text("Probennummer"), text(sample.sampleNumber || "–")]);
  if (sample.originalSampleNumber) rows.push([text("Ersatzprobe für"), text(sample.originalSampleNumber)]);
  rows.push([text("Auftrag"), text(header.orderNumber)]);
  if (header.project) rows.push([text("Projekt"), text(header.project)]);
  rows.push([]);

  let tables = 0;
  for (const sec of sections) {
    const row = sec.rows.find((r) => r.sample.sampleKey === sample.sampleKey);
    if (!row || valueCount(row) === 0) continue;
    // Nur Spalten, in denen diese Probe mindestens einen Wert hat.
    const cols = sec.columns.filter((c) => row.runs.some((run) => (run.cells[c.key]?.length ?? 0) > 0));
    if (cols.length === 0) continue;
    const withContext = row.runs.some((run) => !!contextText(run.context));
    const zs = cols.map((c) =>
      zFor(c.precisionRef ? resolveResultPrecision(c.precisionRef, sec.serviceId, precision) : undefined),
    );

    rows.push([text(sec.serviceName)]);
    rows.push([
      text("Lauf"),
      ...(withContext ? [text("Messkontext")] : []),
      ...cols.map((c) => text(toUnicode(formatResultLabel(c.label, c.unit)))),
      text("Status"),
    ]);
    row.runs.forEach((run, i) => {
      rows.push([
        text(run.label ?? String(i + 1)),
        ...(withContext ? [text(contextText(run.context))] : []),
        ...cols.map((c, ci) => runCell(run.cells[c.key], zs[ci])),
        text(runStatus(run)),
      ]);
    });
    // Mittelwert nur bei echten Wiederholungen (gleicher Kontext), als feste Zahl.
    if (row.runs.length > 1 && runsAreRepeats(row)) {
      const stats = cols.map((c) => {
        const nums = row.runs
          .flatMap((run) => run.cells[c.key] ?? [])
          .filter((v): v is number => typeof v === "number");
        return { n: nums.length, mean: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null };
      });
      const ns = stats.map((s) => s.n).filter((n) => n > 0);
      if (ns.length) {
        const lo = Math.min(...ns);
        const hi = Math.max(...ns);
        rows.push([
          text(`Ø (n=${lo === hi ? lo : `${lo}–${hi}`})`),
          ...(withContext ? [blank] : []),
          ...stats.map((s, ci) => (s.mean === null ? blank : num(s.mean, zs[ci]))),
          blank,
        ]);
      }
    }
    rows.push([]);
    tables += 1;
  }
  for (const m of sample.measurements) {
    const { view } = extractActivity(m.results);
    if (!view) continue;
    rows.push(...activityExportRows(view));
    tables += 1;
  }
  if (tables === 0) rows.push([text("keine Werte")]);
  return { name, rows };
}

export function buildOrderExport(input: OrderExportInput): OrderExportResult | null {
  const group = groupRecordsByOrder(input.records)[0];
  if (!group) return null;
  const recs = input.records.filter((r) => (r.orderId || `number:${r.orderNumber}`) === group.orderKey);
  const first = recs[0];
  const sections = buildOrderComparison(group);
  const serviceSections = sections.filter((s) => s.columns.length > 0);

  const technical = first.orderNumber && first.orderNumber !== group.displayNumber ? first.orderNumber : "";
  const project = distinct(recs.map((r) => r.projectName)).join(", ");
  const customer = distinct(recs.map((r) => r.createdByName)).join(", ");
  const providers = distinct(recs.map((r) => r.assignedToName)).join(", ");
  const remarks = distinct(recs.map((r) => r.remarks))[0] ?? "";
  const status = [input.statusLabel, input.workflowLabel].filter(Boolean).join(" · ");

  // --- Blatt „Übersicht“ ---
  const ov: ExportCell[][] = [];
  ov.push([text("Auftrag"), text(technical ? `${group.displayNumber} (${technical})` : group.displayNumber)]);
  if (project) ov.push([text("Projekt"), text(project)]);
  ov.push([text("Auftraggeber"), text(customer || "–")]);
  ov.push([text("Messdienstleister"), text(providers || "–")]);
  ov.push([text("Auftragsdatum"), first.orderCreatedAt ? date(first.orderCreatedAt) : text("–")]);
  ov.push([text("Auftragsstatus"), text(status || "–")]);
  ov.push([text("Bemerkung"), text(remarks || "–")]);
  ov.push([text("Exportiert am"), { v: input.exportDate, z: DATE_FORMAT }]);
  ov.push([text("Hinweis"), text("Offizielle und vorläufige Werte; die Spalte „Status“ in den Probenblättern kennzeichnet sie.")]);
  ov.push([]);
  ov.push([
    text("Probenbezeichnung"),
    text("Probennummer"),
    text("Abgeschlossen am"),
    ...serviceSections.map((s) => text(`${s.serviceName} (Anzahl Werte)`)),
  ]);

  const used = new Set<string>([OVERVIEW_SHEET.toLowerCase()]);
  const sheetNames = new Map<string, string>();
  for (const s of group.samples) {
    sheetNames.set(s.sampleKey, uniqueSheetName(s.sampleNumber || s.sampleName || "Ohne Probe", used));
  }

  let totalValues = 0;
  for (const s of group.samples) {
    const latest = s.measurements
      .map((m) => m.completedAt)
      .filter((x): x is string => !!x)
      .sort()
      .pop();
    const counts = serviceSections.map((sec) => valueCount(sec.rows.find((r) => r.sample.sampleKey === s.sampleKey)));
    totalValues += counts.reduce((a, b) => a + b, 0);
    ov.push([
      text(s.sampleName || s.sampleNumber || "–"),
      text(s.sampleNumber || "–"),
      latest ? date(latest) : text("–"),
      ...counts.map((n) => (n > 0 ? num(n, "0") : text("–"))),
    ]);
  }

  const sheets: ExportSheet[] = [{ name: OVERVIEW_SHEET, rows: ov }];
  for (const s of group.samples) {
    sheets.push(
      sampleSheet(s, sections, { orderNumber: group.displayNumber, project }, input.precision, sheetNames.get(s.sampleKey)!),
    );
  }
  return {
    fileName: exportFileName(group.displayNumber, input.exportDate),
    sheets,
    summary: { samples: group.samples.length, services: serviceSections.length, values: totalValues },
  };
}
