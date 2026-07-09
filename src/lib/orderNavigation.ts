/**
 * Zentrale Helper-Funktion für die Verlinkung auf die Auftrags-Detailansicht.
 * Immer über diese Funktion verlinken, damit sich das Klickverhalten der
 * Auftragsnummer in der gesamten Anwendung einheitlich verhält.
 */
export function orderDetailPath(orderId: string): string {
  return `/auftraege/${orderId}`;
}
