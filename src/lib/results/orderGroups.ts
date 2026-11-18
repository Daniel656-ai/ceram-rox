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
export interface ComparisonRow {
  sample: SampleGroup;
  /** Offizielle Werte je Spalte (mehrere bei Durchläufen/Wiederholungen). */
  cells: Record<string, Array<number | string>>;
}
export interface ComparisonSection {
  serviceName: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}

const labelOf = (r: { display_label: string | null; result_name: string }): string => {
  if (r.display_label) return r.display_label;
  const raw = r.result_name.startsWith("form:")
    ? r.result_name.slice(r.result_name.indexOf(":", 5) + 1)
    : r.result_name;
  return raw.replace(/_/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());
};

/** Je Analyseart (Dienstleistung) eine Tabelle: Proben als Zeilen, offizielle Parameter als Spalten. */
export function buildOrderComparison(order: OrderGroup): ComparisonSection[] {
  const sections = new Map<string, { columns: Map<string, ComparisonColumn>; rows: ComparisonRow[] }>();
  for (const sample of order.samples) {
    const perService = new Map<string, ComparisonRow>();
    for (const m of sample.measurements) {
      const name = m.serviceName || "Messung";
      let sec = sections.get(name);
      if (!sec) {
        sec = { columns: new Map(), rows: [] };
        sections.set(name, sec);
      }
      let row = perService.get(name);
      if (!row) {
        row = { sample, cells: {} };
        perService.set(name, row);
        sec.rows.push(row);
      }
      for (const r of m.results) {
        if (!isOfficialResult(r) || isInternalResult(r)) continue;
        const label = labelOf(r);
        const key = `${label}::${r.unit ?? ""}`;
        if (!sec.columns.has(key)) sec.columns.set(key, { key, label, unit: r.unit ?? null });
        const v: number | string | null = r.value ?? (r.remarks && !r.remarks.trim().startsWith("{") && !r.remarks.trim().startsWith("[") ? r.remarks : null);
        if (v === null) continue;
        (row.cells[key] ??= []).push(v);
      }
    }
  }
  return [...sections.entries()]
    .map(([serviceName, s]) => ({ serviceName, columns: [...s.columns.values()], rows: s.rows }))
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName, "de"));
}
