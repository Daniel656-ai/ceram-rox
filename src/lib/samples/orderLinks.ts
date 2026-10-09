/**
 * Probe ↔ Auftrag: sammelt Verknüpfungen ausschließlich über echte IDs
 * (samples.order_id, samples.pilot_plant_order_id, measurement_orders.sample_id,
 * order_samples). Keine Zuordnung über Namen oder Textsuche.
 */
export interface OrderRef {
  id: string;
  order_number: string | null;
  order_kind?: string | null;
  order_type?: string | null;
  customer_name?: string | null;
  pp_experiment_number?: string | null;
  project_id?: string | null;
  projects?: { project_number: string | null; project_name: string | null } | null;
}

export interface SampleOrderEdge {
  sample_id: string | null | undefined;
  order: OrderRef | null | undefined;
}

/** Baut sample_id → eindeutige Auftragsliste (nach Auftragsnummer sortiert). */
export function buildSampleOrderMap(edges: SampleOrderEdge[]): Map<string, OrderRef[]> {
  const map = new Map<string, Map<string, OrderRef>>();
  for (const e of edges) {
    if (!e.sample_id || !e.order?.id) continue;
    let inner = map.get(e.sample_id);
    if (!inner) { inner = new Map(); map.set(e.sample_id, inner); }
    if (!inner.has(e.order.id)) inner.set(e.order.id, e.order);
  }
  const out = new Map<string, OrderRef[]>();
  for (const [sid, inner] of map) {
    out.set(
      sid,
      [...inner.values()].sort((a, b) => (a.order_number || "").localeCompare(b.order_number || "")),
    );
  }
  return out;
}

/** Sichtbarer Zusatzname eines Auftrags (nur aus Feldern des Auftrags selbst). */
export function orderDisplayName(o: OrderRef): string | null {
  return (o.pp_experiment_number || o.customer_name || "").trim() || null;
}

/** Beschriftung: Nummer, optional „ – Name"; ohne Nummer Kurz-ID als Fallback. */
export function orderLabel(o: OrderRef): string {
  const num = o.order_number || `#${o.id.slice(0, 8)}`;
  const name = orderDisplayName(o);
  return name ? `${num} – ${name}` : num;
}
