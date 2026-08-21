/**
 * Aggregation der offiziellen Ergebnisse aller Proben eines Auftrags.
 *
 * Regeln:
 * - Es werden ausschließlich Ergebnisse mit `is_official = true` berücksichtigt.
 * - Gruppierung erfolgt technisch über die Dienstleistungs-ID (`serviceId`),
 *   niemals über den sichtbaren Namen.
 * - Ergebnisspalten werden über die stabile Ergebnis-Kennung (`result_name`)
 *   getrennt gehalten; unterschiedliche Ergebnisfelder werden nie vermischt.
 * - Fehlende Werte gehen nicht als 0 in den Mittelwert ein.
 */

export interface RawResultRow {
  id: string;
  result_name: string;
  display_label: string | null;
  value: number | string | null;
  unit: string | null;
  is_official: boolean | null;
  /** Zuordnung zu einer konkreten Messung (Messdatenblock). */
  instance_key?: string | null;
  instance_label?: string | null;
  instance_context?: Record<string, string> | null;
}

export interface RawMeasurementRow {
  id: string;
  sample_id: string | null;
  original_sample_id?: string | null;
  service_id: string;
  status?: string | null;
  measurement_services?: { id: string; service_name: string } | null;
  samples?: { id: string; sample_number: string; sample_name: string } | null;
  original_sample?: { id: string; sample_number: string; sample_name: string } | null;
  measurement_results?: RawResultRow[] | null;
}

export interface ResultColumn {
  key: string;
  label: string;
  unit: string | null;
}

export interface ResultCell {
  value: number | null;
  /** Rohwert, falls nicht numerisch (z.B. Text-Ergebnis) */
  text: string | null;
}

export interface SampleRow {
  sampleId: string | null;
  sampleNumber: string;
  sampleName: string;
  measurementId: string;
  status: string | null;
  /** Ursprünglich vorgesehene Probe, falls mit Ersatzprobe gemessen wurde */
  originalSampleNumber: string | null;
  isReplacement: boolean;
  cells: Record<string, ResultCell>;
}

export interface ServiceResultGroup {
  serviceId: string;
  serviceName: string;
  columns: ResultColumn[];
  rows: SampleRow[];
  /** Mittelwerte je Ergebnisspalte über alle Proben mit vorhandenem Wert */
  averages: Record<string, { average: number | null; count: number; total: number }>;
}

function toNumber(v: number | string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function buildOrderResultGroups(rows: RawMeasurementRow[]): ServiceResultGroup[] {
  const groups = new Map<string, ServiceResultGroup>();

  for (const m of rows) {
    const serviceId = m.service_id;
    if (!serviceId) continue;
    let group = groups.get(serviceId);
    if (!group) {
      group = {
        serviceId,
        serviceName: m.measurement_services?.service_name || "Dienstleistung",
        columns: [],
        rows: [],
        averages: {},
      };
      groups.set(serviceId, group);
    }

    const official = (m.measurement_results || []).filter((r) => r.is_official === true);

    const cells: Record<string, ResultCell> = {};
    for (const r of official) {
      const key = r.result_name;
      if (!group.columns.some((c) => c.key === key)) {
        group.columns.push({
          key,
          label: r.display_label || r.result_name,
          unit: r.unit || null,
        });
      } else if (r.display_label) {
        const col = group.columns.find((c) => c.key === key)!;
        col.label = r.display_label;
        if (!col.unit && r.unit) col.unit = r.unit;
      }
      const num = toNumber(r.value);
      cells[key] = { value: num, text: num === null && r.value != null ? String(r.value) : null };
    }

    group.rows.push({
      sampleId: m.sample_id,
      sampleNumber: m.samples?.sample_number || "–",
      sampleName: m.samples?.sample_name || "Ohne Probe",
      measurementId: m.id,
      status: m.status ?? null,
      originalSampleNumber:
        m.original_sample_id && m.original_sample_id !== m.sample_id
          ? m.original_sample?.sample_number || "–"
          : null,
      isReplacement: !!(m.original_sample_id && m.original_sample_id !== m.sample_id),
      cells,
    });
  }

  for (const group of groups.values()) {
    for (const col of group.columns) {
      let sum = 0;
      let count = 0;
      for (const row of group.rows) {
        const cell = row.cells[col.key];
        if (cell && cell.value !== null) {
          sum += cell.value;
          count += 1;
        }
      }
      group.averages[col.key] = {
        average: count > 0 ? sum / count : null,
        count,
        total: group.rows.length,
      };
    }
  }

  // Nur Gruppen mit mindestens einer offiziellen Ergebnisspalte anzeigen
  return [...groups.values()].filter((g) => g.columns.length > 0);
}
