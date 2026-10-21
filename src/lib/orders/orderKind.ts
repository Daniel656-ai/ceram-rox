/**
 * Auftragsart-Klassifizierung (nur Darstellung/Filter, keine Datenänderung).
 * "Kombiniert" wird nicht mehr verwendet. "Klassisch" kennzeichnet historische
 * bzw. nicht eindeutig zuordenbare Bestandsaufträge und ist nicht filterbar.
 */
export type ResolvedOrderKind = "labor" | "pilot_plant" | "legacy";
export type OrderKindFilter = "all" | "labor" | "pilot_plant";

export const ORDER_KIND_FILTER_OPTIONS: OrderKindFilter[] = ["all", "labor", "pilot_plant"];

type OrderLike = {
  order_kind?: string | null;
  order_measurements?: Array<{ measurement_services?: { category?: string | null } | null } | null> | null;
};

export function resolveOrderKind(order: OrderLike): ResolvedOrderKind {
  if (order.order_kind === "pilot_plant") return "pilot_plant";
  if (order.order_kind === "labor") return "labor";
  const cats = new Set<string>();
  let unknown = false;
  for (const m of order.order_measurements ?? []) {
    const c = m?.measurement_services?.category;
    if (c === "labor" || c === "pilot_plant") cats.add(c);
    else unknown = true;
  }
  if (!unknown && cats.size === 1) return [...cats][0] as ResolvedOrderKind;
  return "legacy";
}

export function matchesOrderKindFilter(order: OrderLike, filter: OrderKindFilter): boolean {
  return filter === "all" || resolveOrderKind(order) === filter;
}
