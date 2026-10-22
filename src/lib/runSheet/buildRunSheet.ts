/**
 * Proben-Laufzettel: reine, lesende Zuordnung Probe → Dienstleistungen → Vorgaben.
 * Es werden ausschließlich Dienstleistungen mit order_measurements.sample_id
 * gleich der gewählten Probe übernommen. Keine Zuordnung über Auftrag/Namen;
 * order-level Formularwerte (shared_form_data) sind keiner Probe eindeutig
 * zugeordnet und werden daher nicht ausgegeben. Nichts wird gespeichert.
 */
import { orderIdentity } from "@/lib/orders/orderIdentity";

export interface RunSheetMeasurementRow {
  id: string;
  sample_id: string | null;
  measurement_number?: string | null;
  measurement_services?: { service_name?: string | null } | null;
  measurement_parameters?: { id: string; parameter_name: string; parameter_value: string | null; unit: string | null }[] | null;
  measurement_orders?: {
    id: string;
    order_number?: string | null;
    order_kind?: string | null;
    pp_experiment_number?: string | null;
    customer_name?: string | null;
    order_measurements?: { measurement_services?: { category?: string | null } | null }[] | null;
  } | null;
}

export interface SpecChangeRow { order_measurement_id: string | null; created_at: string }

export interface RunSheetOrder {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  /** Letzte eindeutig zuordenbare Vorgabenänderung (ISO) oder null = nicht nachweisbar. */
  lastSpecChange: string | null;
  services: {
    measurementId: string;
    measurementNumber: string | null;
    serviceName: string;
    params: { id: string; name: string; value: string; unit: string | null }[];
  }[];
}

export const EMPTY_VALUE = "–";

export function displaySpecValue(v: string | null | undefined): string {
  if (v === null || v === undefined) return EMPTY_VALUE;
  const s = String(v).trim();
  return s === "" ? EMPTY_VALUE : s;
}

export function dmcPayload(orderNumber: string, sampleNumber: string): string | null {
  if (!orderNumber.trim() || !sampleNumber.trim()) return null; // keine erfundenen Nummern
  return `ROX|A:${orderNumber}|P:${sampleNumber}`;
}

export function buildRunSheet(
  sampleId: string,
  rows: RunSheetMeasurementRow[],
  changes: SpecChangeRow[],
): RunSheetOrder[] {
  const byOrder = new Map<string, RunSheetOrder>();
  for (const m of rows) {
    if (!m || m.sample_id !== sampleId || !m.measurement_orders) continue;
    const o = m.measurement_orders;
    let entry = byOrder.get(o.id);
    if (!entry) {
      entry = {
        orderId: o.id,
        orderNumber: orderIdentity(o as any).number,
        customerName: o.customer_name?.trim() ? o.customer_name : null,
        lastSpecChange: null,
        services: [],
      };
      byOrder.set(o.id, entry);
    }
    // Jede Zeile einzeln – gleiche Parameternamen (z. B. zwei O₂) bleiben getrennt.
    const params = (m.measurement_parameters ?? []).map((p) => ({
      id: p.id, name: p.parameter_name, value: displaySpecValue(p.parameter_value), unit: p.unit?.trim() || null,
    }));
    entry.services.push({
      measurementId: m.id,
      measurementNumber: m.measurement_number ?? null,
      serviceName: m.measurement_services?.service_name ?? EMPTY_VALUE,
      params,
    });
    for (const c of changes) {
      if (c.order_measurement_id === m.id && (!entry.lastSpecChange || c.created_at > entry.lastSpecChange)) {
        entry.lastSpecChange = c.created_at;
      }
    }
  }
  return [...byOrder.values()];
}
