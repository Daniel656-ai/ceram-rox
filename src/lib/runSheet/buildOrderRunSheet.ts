/**
 * Auftrags-Laufzettel: reine, lesende Zusammenführung ALLER Vorgaben genau
 * eines Auftrags (Auftragsformular + alle Dienstleistungen, mit oder ohne
 * Probe). Keine Deduplizierung zwischen Quellen, nichts wird gespeichert.
 */
import { orderIdentity } from "@/lib/orders/orderIdentity";
import { resolveOrderKind } from "@/lib/orders/orderKind";
import { sortPppServices, type PppGroup, type PppLists } from "./pppGroups";

export interface OrderRunSheetField {
  id: string; field_key: string; display_name?: string | null; unit?: string | null;
  field_type?: string | null; parent_field_id?: string | null; metadata?: any;
}

export interface OrderRunSheet {
  number: string;
  /** Nur gesetzt, wenn abweichend von der angezeigten Nummer. */
  technicalNumber: string | null;
  customerName: string | null;
  project: string | null;
  dueDate: string | null;
  priority: string | null;
  notes: string | null;
  /** Letzte order_spec_updated-Änderung dieses Auftrags (nur Dienstleistungsvorgaben). */
  lastSpecChange: string | null;
  form: { key: string; label: string | null; unit: string | null; raw: unknown; colLabels: Map<string, string> }[];
  /** true = Pilot Plant: Dienstleistungen nach Stammdatenlisten gruppiert. */
  grouped: boolean;
  services: {
    measurementId: string; measurementNumber: string | null; serviceName: string; sampleNumber: string | null;
    serviceId: string | null; status: string | null;
    pppGroup: PppGroup | null; pppReason?: string;
    params: { id: string; name: string; raw: string | null; unit: string | null }[];
  }[];
}

const storageKey = (f: OrderRunSheetField) => {
  const sk = f.metadata?.repeater?.storage_key;
  return typeof sk === "string" && sk.trim() ? sk : f.field_key;
};

/**
 * Pilot-Plant-Erkennung NUR für den Auftrags-Laufzettel. Die allgemeine
 * Auftragsart-Erkennung (resolveOrderKind) bleibt unverändert; ein
 * Mischauftrag mit Pilot-Plant-Dienstleistungen und begleitenden
 * Laborprüfungen gilt hier als Pilot-Plant-Auftrag, damit die fachliche
 * Laufzettel-Reihenfolge auch bei älteren und gemischten Aufträgen greift.
 */
export function isPilotPlantRunSheetOrder(order: any): boolean {
  if (!order) return false;
  if (order.order_kind === "pilot_plant") return true;
  if (typeof order.pp_experiment_number === "string" && order.pp_experiment_number.trim()) return true;
  if (resolveOrderKind(order) === "pilot_plant") return true;
  return ((order.order_measurements ?? []) as any[]).some(
    (m) => m?.measurement_services?.category === "pilot_plant"
  );
}

export function buildOrderRunSheet(
  order: any,
  fields: OrderRunSheetField[],
  events: { event_type: string; order_id?: string | null; created_at: string }[],
  pppLists: PppLists = { masse: null, produkt: null },
): OrderRunSheet {
  const id = orderIdentity(order);
  const values = (order?.shared_form_data?.template?.values ?? {}) as Record<string, unknown>;
  const valueKeys = values && typeof values === "object" ? Object.keys(values) : [];

  const top = fields.filter((f) => !f.parent_field_id);
  const form: OrderRunSheet["form"] = [];
  const used = new Set<string>();
  for (const f of top) {
    const k = storageKey(f);
    if (!(k in values) || used.has(k)) continue;
    used.add(k);
    const colLabels = new Map<string, string>();
    for (const c of fields) {
      if (c.parent_field_id === f.id && c.display_name) colLabels.set(c.field_key, c.display_name);
    }
    form.push({ key: k, label: f.display_name?.trim() || null, unit: f.unit?.trim() || null, raw: values[k], colLabels });
  }
  // Werte ohne Feldbeschreibung nie verschweigen.
  for (const k of valueKeys) {
    if (!used.has(k)) form.push({ key: k, label: null, unit: null, raw: values[k], colLabels: new Map() });
  }

  const base = ((order?.order_measurements ?? []) as any[])
    .filter((m) => !m.order_id || m.order_id === order.id)
    .map((m) => ({
      measurementId: m.id,
      measurementNumber: m.measurement_number ?? null,
      serviceName: m.measurement_services?.service_name ?? "–",
      sampleNumber: m.samples?.sample_number ?? null,
      serviceId: m.service_id ?? null,
      status: m.status ?? null,
      params: ((m.measurement_parameters ?? []) as any[]).map((p) => ({
        id: p.id, name: p.parameter_name, raw: p.parameter_value ?? null, unit: p.unit?.trim() || null,
      })),
    }));
  const grouped = isPilotPlantRunSheetOrder(order);
  const services: OrderRunSheet["services"] = grouped
    ? sortPppServices(base, pppLists)
    : base.map((s) => ({ ...s, pppGroup: null }));

  let last: string | null = null;
  for (const e of events) {
    if (e.event_type !== "order_spec_updated" || (e.order_id && e.order_id !== order.id)) continue;
    if (!last || e.created_at > last) last = e.created_at;
  }

  return {
    number: id.number,
    technicalNumber: id.technicalNumber && id.technicalNumber !== id.number ? id.technicalNumber : null,
    customerName: order?.customer_name?.trim() || null,
    project: order?.projects ? [order.projects.project_number, order.projects.project_name].filter(Boolean).join(" – ") || null : null,
    dueDate: order?.due_date ?? null,
    priority: order?.priority ?? null,
    notes: order?.notes?.trim() || null,
    lastSpecChange: last,
    form,
    grouped,
    services,
  };
}

export function orderDmcPayload(number: string): string | null {
  return number.trim() ? `ROX|A:${number}` : null;
}
