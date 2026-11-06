/**
 * Erkennung externer Kunden im Frontend.
 *
 * Spiegelt die serverseitige Funktion public.is_external_customer(uuid):
 * Externe Kunden tragen diese Custom-Rolle in user_roles. Die ID ist die
 * einzige verbindliche Quelle (steht auch in der DB-Funktion, Migration 0013).
 * Rein lesend; Berechtigungen bleiben serverseitig über RLS abgesichert.
 */
export const EXTERNAL_CUSTOMER_ROLE_ID = "fa390068-1afe-492d-8a3b-bcbf473c50a0";

export function isExternalCustomer(customRoleIds: string[] | null | undefined): boolean {
  return Array.isArray(customRoleIds) && customRoleIds.includes(EXTERNAL_CUSTOMER_ROLE_ID);
}
