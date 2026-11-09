/**
 * Verrechnungsstatus von Kundenaufträgen – rein organisatorische Kennzeichnung,
 * keine Abrechnungslogik. Änderungen bestehender Aufträge laufen ausschließlich
 * über die RPC `set_order_billed` (api.orders.setBilled).
 */
export interface BillableOrderLike {
  order_type?: string | null;
  is_billed?: boolean | null;
}

/** true/false für Kundenaufträge (fehlend/null = false), null = keine Anzeige. */
export function resolveBilled(order: BillableOrderLike | null | undefined): boolean | null {
  if (!order || order.order_type !== "customer") return null;
  return order.is_billed === true;
}

/** Wert, der beim Anlegen gespeichert wird – nur Kundenaufträge können true sein. */
export function billedForCreate(orderType: string | null | undefined, selected: boolean): boolean {
  return orderType === "customer" ? selected === true : false;
}

/** Nur Auftragsersteller oder Master dürfen ändern (serverseitig erneut geprüft). */
export function canEditBilled(
  order: { created_by?: string | null } | null | undefined,
  userId: string | null | undefined,
  isMaster: boolean,
): boolean {
  if (!order || !userId) return false;
  return isMaster || order.created_by === userId;
}
