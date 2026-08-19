/**
 * Strukturierung der offiziellen Ergebnisse eines Auftrags:
 *
 *   Auftrag → Probe → Dienstleistung/Analyse → vollständige Ergebnisse
 *
 * Es werden ausschließlich Ergebnisse mit `is_official = true` berücksichtigt.
 * Es wird nichts abgeschnitten: jede Analyse liefert alle vorhandenen
 * Ergebnisparameter (vertikale Darstellung).
 */

import type { RawMeasurementRow } from "./orderResultsAggregation";
import { computeStats } from "./resultsStatistics";
import type { ResultParamColumn } from "./resultSchema";

export interface AnalysisValue {
  key: string;
  label: string;
  unit: string | null;
  group: string | null;
  value: number | null;
  /** Rohtext, falls nicht numerisch (z. B. „<0,01"). */
  text: string | null;
}

export interface AnalysisEntry {
  measurementId: string;
  measurementNumber: string;
  serviceId: string;
  serviceName: string;
  /** Fortlaufende Nummer der Analyse innerhalb Probe + Dienstleistung. */
  index: number;
  label: string;
  status: string | null;
  date: string | null;
  values: AnalysisValue[];
}

export interface ServiceAnalyses {
  serviceId: string;
  serviceName: string;
  analyses: AnalysisEntry[];
}

export interface SampleResultGroup {
  sampleId: string | null;
  sampleNumber: string;
  sampleName: string;
  isReplacement: boolean;
  originalSampleNumber: string | null;
  services: ServiceAnalyses[];
  analysisCount: number;
}

function toNumber(v: number | string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Optionale Sortierung/Gruppierung anhand einer definierten Ergebnisstruktur. */
function orderValues(
  values: AnalysisValue[],
  columns?: ResultParamColumn[]
): AnalysisValue[] {
  if (!columns || columns.length === 0) return values;
  const order = new Map(columns.map((c, i) => [c.key, i]));
  const groups = new Map(columns.map((c) => [c.key, c.group]));
  return values
    .map((v) => ({ ...v, group: v.group ?? groups.get(v.key) ?? null }))
    .sort((a, b) => (order.get(a.key) ?? 1e6) - (order.get(b.key) ?? 1e6));
}

export function buildOrderResultStructure(
  rows: RawMeasurementRow[],
  columnsByService?: Map<string, ResultParamColumn[]>
): SampleResultGroup[] {
  const samples = new Map<string, SampleResultGroup>();

  for (const m of rows) {
    const official = (m.measurement_results || []).filter((r) => r.is_official === true);
    if (official.length === 0) continue;

    const sampleKey = m.sample_id || `ohne:${m.id}`;
    let sample = samples.get(sampleKey);
    if (!sample) {
      sample = {
        sampleId: m.sample_id ?? null,
        sampleNumber: m.samples?.sample_number || "–",
        sampleName: m.samples?.sample_name || "Ohne Probe",
        isReplacement: !!(m.original_sample_id && m.original_sample_id !== m.sample_id),
        originalSampleNumber:
          m.original_sample_id && m.original_sample_id !== m.sample_id
            ? m.original_sample?.sample_number || "–"
            : null,
        services: [],
        analysisCount: 0,
      };
      samples.set(sampleKey, sample);
    }

    let service = sample.services.find((s) => s.serviceId === m.service_id);
    if (!service) {
      service = {
        serviceId: m.service_id,
        serviceName: m.measurement_services?.service_name || "Dienstleistung",
        analyses: [],
      };
      sample.services.push(service);
    }

    const values: AnalysisValue[] = official.map((r) => {
      const num = toNumber(r.value as any);
      return {
        key: r.display_label || r.result_name,
        label: r.display_label || r.result_name,
        unit: r.unit || null,
        group: null,
        value: num,
        text: num === null && r.value != null && r.value !== "" ? String(r.value) : null,
      };
    });

    const index = service.analyses.length + 1;
    service.analyses.push({
      measurementId: m.id,
      measurementNumber: (m as any).measurement_number || "",
      serviceId: m.service_id,
      serviceName: service.serviceName,
      index,
      label: index === 1 ? `${service.serviceName} – Analyse 1` : `${service.serviceName} – Analyse ${index}`,
      status: m.status ?? null,
      date:
        official.map((r) => (r as any).measured_at as string | null).filter(Boolean)[0] ?? null,
      values: orderValues(values, columnsByService?.get(m.service_id)),
    });
    sample.analysisCount += 1;
  }

  return [...samples.values()].sort((a, b) =>
    a.sampleNumber.localeCompare(b.sampleNumber, "de", { numeric: true })
  );
}

export interface ComparisonRow {
  key: string;
  label: string;
  unit: string | null;
  group: string | null;
  cells: Array<{ value: number | null; text: string | null }>;
  mean: number | null;
  min: number | null;
  max: number | null;
  sd: number | null;
}

/** Vergleichstabelle über ausgewählte Analysen – Parameter als Zeilen. */
export function buildComparison(analyses: AnalysisEntry[]): ComparisonRow[] {
  const order: string[] = [];
  const meta = new Map<string, { label: string; unit: string | null; group: string | null }>();
  for (const a of analyses) {
    for (const v of a.values) {
      if (!meta.has(v.key)) {
        meta.set(v.key, { label: v.label, unit: v.unit, group: v.group });
        order.push(v.key);
      } else {
        const m = meta.get(v.key)!;
        if (!m.unit && v.unit) m.unit = v.unit;
      }
    }
  }

  return order.map((key) => {
    const m = meta.get(key)!;
    const cells = analyses.map((a) => {
      const hit = a.values.find((v) => v.key === key);
      return { value: hit?.value ?? null, text: hit?.text ?? null };
    });
    const nums = cells.map((c) => c.value).filter((v): v is number => v !== null);
    const stats = computeStats(nums);
    return {
      key,
      label: m.label,
      unit: m.unit,
      group: m.group,
      cells,
      mean: stats?.mean ?? null,
      min: stats?.min ?? null,
      max: stats?.max ?? null,
      sd: stats?.sd ?? null,
    };
  });
}

/** Gruppiert Ergebniszeilen nach fachlicher Gruppe (null → „Ergebnisse"). */
export function groupByResultGroup<T extends { group: string | null }>(rows: T[]) {
  const groups: Array<{ name: string; rows: T[] }> = [];
  for (const r of rows) {
    const name = r.group || "Ergebnisse";
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return groups;
}
