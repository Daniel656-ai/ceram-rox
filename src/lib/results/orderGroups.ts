import {
  groupRecordsBySample,
  isOfficialResult,
  type SampleGroup,
  type SampleMeasurementRecord,
} from "@/lib/results/sampleResultsAggregation";
import { expandStructuredResult, isInternalResult } from "@/lib/results/internalResults";

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
  /** Erster Wert dieser Spalte – nur zur Ermittlung der Anzeige-Nachkommastellen. */
  precisionRef?: { result_name: string; instance_key: string | null };
}
/** Ein Durchlauf (eigenständige Messung bzw. Messung einer Analyse) einer Probe. */
export interface ComparisonRun {
  key: string;
  /** Bezeichnung des Durchlaufs ("Lauf 2" o. ä.); null bei nur einem Durchlauf. */
  label: string | null;
  /** Kontext des Durchlaufs (z. B. Messstelle) – nur zur Erkennung echter Wiederholungen/Tooltip. */
  context: Record<string, string> | null;
  /** Werte je Spalte (offiziell und vorläufig; normalerweise genau einer). */
  cells: Record<string, Array<number | string>>;
  /** Je Wert in `cells` (gleiche Reihenfolge): true = vorläufig. */
  interim: Record<string, boolean[]>;
}
export interface ComparisonRow {
  sample: SampleGroup;
  /** Eine Unterzeile je Durchlauf (mindestens eine). */
  runs: ComparisonRun[];
}
export interface ComparisonSection {
  serviceName: string;
  serviceId: string | null;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  /** Anzahl Werte dieser Analyseart (ohne interne Einträge). */
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

export const stableContext = (c: Record<string, string> | null): string =>
  JSON.stringify(Object.entries(c ?? {}).sort(([a], [b]) => a.localeCompare(b)));

/** Je Analyseart (Dienstleistung) eine Tabelle: Proben mit Durchläufen als Zeilen, Parameter als Spalten (offizielle UND vorläufige Werte). */
export function buildOrderComparison(order: OrderGroup): ComparisonSection[] {
  const sections = new Map<
    string,
    { serviceId: string | null; columns: Map<string, ComparisonColumn>; rows: ComparisonRow[]; officialCount: number; interimCount: number }
  >();
  for (const sample of order.samples) {
    const perService = new Map<string, ComparisonRow>();
    for (const m of sample.measurements) {
      const name = m.serviceName || "Messung";
      let sec = sections.get(name);
      if (!sec) {
        sec = { serviceId: m.serviceId ?? null, columns: new Map(), rows: [], officialCount: 0, interimCount: 0 };
        sections.set(name, sec);
      }
      let row = perService.get(name);
      if (!row) {
        row = { sample, runs: [] };
        perService.set(name, row);
        sec.rows.push(row);
      }
      const runsOfMeasurement = new Map<string, ComparisonRun>();
      // Mehrere Werte derselben Spalte im selben Durchlauf (ohne eigene Durchlauf-Kennung)
      // sind weitere Durchläufe: jeder bekommt eine eigene Unterzeile statt "a / b / c" in einer Zelle.
      const occurrences = new Map<string, number>();
      // Strukturierte Werte (Blöcke/JSON) werden in einzelne Werte zerlegt – nie roher Text.
      const flat = m.results.flatMap((r) =>
        isInternalResult(r) ? [] : (expandStructuredResult(r, m.results)?.rows ?? [r]),
      );
      for (const r of flat) {
        const isInterim = !isOfficialResult(r);
        if (isInterim) sec.interimCount += 1;
        else sec.officialCount += 1;
        const label = labelOf(r);
        const key = `${label}::${r.unit ?? ""}`;
        if (!sec.columns.has(key)) {
          sec.columns.set(key, {
            key, label, unit: r.unit ?? null,
            precisionRef: { result_name: r.result_name, instance_key: r.instance_key ?? null },
          });
        }
        const v: number | string | null = r.value ?? (r.remarks && !r.remarks.trim().startsWith("{") && !r.remarks.trim().startsWith("[") ? r.remarks : null);
        if (v === null) continue;
        const baseKey = `${m.measurementId}:${r.instance_key ?? ""}`;
        const occ = occurrences.get(`${baseKey}|${key}`) ?? 0;
        occurrences.set(`${baseKey}|${key}`, occ + 1);
        const runKey = occ === 0 ? baseKey : `${baseKey}#${occ}`;
        let run = runsOfMeasurement.get(runKey);
        if (!run) {
          run = {
            key: runKey,
            label: occ === 0 ? r.instance_label?.trim() || null : null,
            context: r.instance_context && Object.keys(r.instance_context).length ? r.instance_context : null,
            cells: {},
            interim: {},
          };
          runsOfMeasurement.set(runKey, run);
          row.runs.push(run);
        }
        (run.cells[key] ??= []).push(v);
        (run.interim[key] ??= []).push(isInterim);
      }
    }
  }
  const out = [...sections.entries()].map(([serviceName, s]) => {
    // Bezeichnung nur bei mehreren Durchläufen; fehlende Namen -> "Lauf n".
    for (const row of s.rows) {
      if (row.runs.length > 1) row.runs.forEach((run, i) => { run.label = run.label || `Lauf ${i + 1}`; });
      else if (row.runs[0]) row.runs[0].label = null;
      // Probe ohne Werte in dieser Analyseart: trotzdem eine (leere) Zeile.
      if (row.runs.length === 0) row.runs.push({ key: `${row.sample.sampleKey}:empty`, label: null, context: null, cells: {}, interim: {} });
    }
    const multi = s.rows.filter((r) => r.runs.length > 1);
    return {
      serviceName,
      serviceId: s.serviceId,
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

/** Kontext eines Durchlaufs als Text („Temperatur: 300 °C“); leer = undefined. */
export const contextText = (c: Record<string, string> | null): string | undefined =>
  c && Object.keys(c).length ? Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(" · ") : undefined;

/** Sind alle Durchläufe einer Probe echte Wiederholungen (gleicher Kontext)? Nur dann ist ein Mittelwert sinnvoll. */
export const runsAreRepeats = (row: ComparisonRow): boolean =>
  new Set(row.runs.map((r) => stableContext(r.context))).size <= 1;

/** Status eines Durchlaufs für Anzeige/Export: offiziell, vorläufig oder gemischt. */
export function runStatus(run: ComparisonRun): "offiziell" | "vorläufig" | "teilweise vorläufig" | null {
  const flags = Object.values(run.interim).flat();
  if (flags.length === 0) return null;
  const n = flags.filter(Boolean).length;
  return n === 0 ? "offiziell" : n === flags.length ? "vorläufig" : "teilweise vorläufig";
}
