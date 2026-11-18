import {
  groupRecordsBySample,
  isOfficialResult,
  type SampleGroup,
  type SampleMeasurementRecord,
} from "@/lib/results/sampleResultsAggregation";
import { isInternalResult } from "@/lib/results/internalResults";

/**
 * Auftragsbezogene Gruppierung der Probenübersicht. Reine Navigation/Anzeige:
 * jede Messung erscheint genau einmal, es werden keine Werte verändert.
 */
export interface OrderGroup {
  orderKey: string;
  orderId: string;
  displayNumber: string;
  projectNames: string[];
  /** Proben des Auftrags – jeweils nur mit den Messungen dieses Auftrags. */
  samples: SampleGroup[];
  measurementCount: number;
  officialCount: number;
  interimCount: number;
  lastActivityAt: string | null;
}

export function groupRecordsByOrder(records: SampleMeasurementRecord[]): OrderGroup[] {
  const byOrder = new Map<string, SampleMeasurementRecord[]>();
  for (const rec of records) {
    const key = rec.orderId || `number:${rec.orderNumber}`;
    const list = byOrder.get(key);
    if (list) list.push(rec);
    else byOrder.set(key, [rec]);
  }
  const groups: OrderGroup[] = [];
  for (const [orderKey, recs] of byOrder) {
    const samples = groupRecordsBySample(recs);
    const projectNames: string[] = [];
    let official = 0;
    let interim = 0;
    let last: string | null = null;
    for (const rec of recs) {
      if (rec.projectName && !projectNames.includes(rec.projectName)) projectNames.push(rec.projectName);
      for (const r of rec.results) {
        if (isInternalResult(r)) continue;
        if (isOfficialResult(r)) official += 1;
        else interim += 1;
      }
      const t = rec.completedAt ?? rec.createdAt;
      if (t && (!last || t > last)) last = t;
    }
    groups.push({
      orderKey,
      orderId: recs[0].orderId,
      displayNumber: recs[0].orderDisplayNumber || recs[0].orderNumber,
      projectNames,
      samples,
      measurementCount: recs.length,
      officialCount: official,
      interimCount: interim,
      lastActivityAt: last,
    });
  }
  // Zuletzt bearbeitete Aufträge zuerst, bei Gleichstand nach Auftragsnummer.
  return groups.sort(
    (a, b) =>
      (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") ||
      a.displayNumber.localeCompare(b.displayNumber, "de", { numeric: true }),
  );
}

/* ---------------- Probenvergleich innerhalb eines Auftrags ---------------- */

export interface ComparisonColumn {
  key: string;
  label: string;
  unit: string | null;
}
/** Ein Durchlauf (eigenständige Messung bzw. Messung einer Analyse) einer Probe. */
export interface ComparisonRun {
  key: string;
  /** Bezeichnung des Durchlaufs ("Lauf 2" o. ä.); null bei nur einem Durchlauf. */
  label: string | null;
  /** Kontext des Durchlaufs (z. B. Messstelle) – nur zur Erkennung echter Wiederholungen/Tooltip. */
  context: Record<string, string> | null;
  /** Offizielle Werte je Spalte (normalerweise genau einer). */
  cells: Record<string, Array<number | string>>;
}
export interface ComparisonRow {
  sample: SampleGroup;
  /** Eine Unterzeile je Durchlauf (mindestens eine). */
  runs: ComparisonRun[];
}
export interface ComparisonSection {
  serviceName: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  /** Werte dieser Analyseart (ohne interne Einträge) – für die Kurzzeile ohne offizielle Werte. */
  officialCount: number;
  interimCount: number;
  /** Mindestens eine Probe hat mehrere Durchläufe. */
  hasMultipleRuns: boolean;
  /** Mittelwert sinnvoll: Durchläufe jeder Probe haben denselben Kontext (Wiederholungen). */
  meanAvailable: boolean;
}

const labelOf = (r: { display_label: string | null; result_name: string }): string => {
  if (r.display_label) return r.display_label;
  const raw = r.result_name.startsWith("form:")
    ? r.result_name.slice(r.result_name.indexOf(":", 5) + 1)
    : r.result_name;
  return raw.replace(/_/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());
};

const stableContext = (c: Record<string, string> | null): string =>
  JSON.stringify(Object.entries(c ?? {}).sort(([a], [b]) => a.localeCompare(b)));

/** Je Analyseart (Dienstleistung) eine Tabelle: Proben mit Durchläufen als Zeilen, offizielle Parameter als Spalten. */
export function buildOrderComparison(order: OrderGroup): ComparisonSection[] {
  const sections = new Map<
    string,
    { columns: Map<string, ComparisonColumn>; rows: ComparisonRow[]; officialCount: number; interimCount: number }
  >();
  for (const sample of order.samples) {
    const perService = new Map<string, ComparisonRow>();
    for (const m of sample.measurements) {
      const name = m.serviceName || "Messung";
      let sec = sections.get(name);
      if (!sec) {
        sec = { columns: new Map(), rows: [], officialCount: 0, interimCount: 0 };
        sections.set(name, sec);
      }
      let row = perService.get(name);
      if (!row) {
        row = { sample, runs: [] };
        perService.set(name, row);
        sec.rows.push(row);
      }
      const runsOfMeasurement = new Map<string, ComparisonRun>();
      for (const r of m.results) {
        if (isInternalResult(r)) continue;
        if (!isOfficialResult(r)) {
          sec.interimCount += 1;
          continue;
        }
        sec.officialCount += 1;
        const label = labelOf(r);
        const key = `${label}::${r.unit ?? ""}`;
        if (!sec.columns.has(key)) sec.columns.set(key, { key, label, unit: r.unit ?? null });
        const v: number | string | null = r.value ?? (r.remarks && !r.remarks.trim().startsWith("{") && !r.remarks.trim().startsWith("[") ? r.remarks : null);
        if (v === null) continue;
        const runKey = `${m.measurementId}:${r.instance_key ?? ""}`;
        let run = runsOfMeasurement.get(runKey);
        if (!run) {
          run = {
            key: runKey,
            label: r.instance_label?.trim() || null,
            context: r.instance_context && Object.keys(r.instance_context).length ? r.instance_context : null,
            cells: {},
          };
          runsOfMeasurement.set(runKey, run);
          row.runs.push(run);
        }
        (run.cells[key] ??= []).push(v);
      }
    }
  }
  const out = [...sections.entries()].map(([serviceName, s]) => {
    // Bezeichnung nur bei mehreren Durchläufen; fehlende Namen -> "Lauf n".
    for (const row of s.rows) {
      if (row.runs.length > 1) row.runs.forEach((run, i) => { run.label = run.label || `Lauf ${i + 1}`; });
      else if (row.runs[0]) row.runs[0].label = null;
      // Probe ohne offizielle Werte in dieser Analyseart: trotzdem eine (leere) Zeile.
      if (row.runs.length === 0) row.runs.push({ key: `${row.sample.sampleKey}:empty`, label: null, context: null, cells: {} });
    }
    const multi = s.rows.filter((r) => r.runs.length > 1);
    return {
      serviceName,
      columns: [...s.columns.values()],
      rows: s.rows,
      officialCount: s.officialCount,
      interimCount: s.interimCount,
      hasMultipleRuns: multi.length > 0,
      meanAvailable: multi.every((r) => new Set(r.runs.map((x) => stableContext(x.context))).size === 1),
    };
  });
  return out.sort((a, b) => a.serviceName.localeCompare(b.serviceName, "de"));
}

/** Mittelwert einer Spalte über alle Durchläufe einer Probe (nur Zahlen), n = Anzahl Zahlenwerte. */
export interface RunSummary {
  mean: number | null;
  n: number;
  /** Alle Einzelwerte (Zahlen und Texte) in Durchlauf-Reihenfolge. */
  values: Array<number | string>;
}

export function summarizeRuns(row: ComparisonRow, columnKey: string): RunSummary {
  const values = row.runs.flatMap((run) => run.cells[columnKey] ?? []);
  const nums = values.filter((v): v is number => typeof v === "number");
  return { mean: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null, n: nums.length, values };
}
