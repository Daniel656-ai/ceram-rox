/**
 * ROX – Aktiver Dienstleistungsreiter bei der Pilot-Plant-Auftragserstellung.
 *
 * Reine Logik ohne Datenzugriff. Verbindliche Regel: die zuletzt über die
 * Checkbox ausgewählte bzw. bewusst angeklickte Dienstleistung ist immer der
 * aktive Reiter – niemals automatisch der erste. Positionen werden
 * ausschließlich über ihre `uid` identifiziert (dieselbe Dienstleistung kann
 * mehrfach vorkommen).
 */

export interface ActiveServiceTabState {
  /** uid des aktiven Reiters (null = keiner). */
  active: string | null;
  /** Aktivierungsreihenfolge (zuletzt aktiviert hinten), nur sichtbare uids. */
  order: string[];
}

export const EMPTY_ACTIVE_TAB: ActiveServiceTabState = { active: null, order: [] };

export function nextActiveServiceTab(params: {
  prev: ActiveServiceTabState;
  /** uids der aktuell sichtbaren Positionen (Anzeigereihenfolge). */
  visibleUids: string[];
  /** Neu hinzugekommene Positionen dieses Laufs (Checkbox, Picker, Paket, Duplikat). */
  addedUids?: string[];
  /** Bewusst angeklickter Reiter. */
  clickedUid?: string | null;
}): ActiveServiceTabState {
  const visible = new Set(params.visibleUids);
  const added = (params.addedUids ?? []).filter((u) => visible.has(u));

  // Reihenfolge bereinigen: nur sichtbare uids, jede genau einmal.
  const order: string[] = [];
  for (const u of [...params.prev.order, ...added]) {
    if (visible.has(u) && !order.includes(u)) order.push(u);
  }

  let active: string | null;
  if (params.clickedUid && visible.has(params.clickedUid)) {
    active = params.clickedUid;
    // Bewusst angeklickt = zuletzt gewählt → ans Ende der Reihenfolge.
    const idx = order.indexOf(active);
    if (idx >= 0) order.splice(idx, 1);
    order.push(active);
  } else if (added.length > 0) {
    active = added[added.length - 1];
  } else if (params.prev.active && visible.has(params.prev.active)) {
    active = params.prev.active;
  } else {
    // Aktiver Reiter abgewählt: zuletzt verbliebene Auswahl aktivieren.
    active = order[order.length - 1] ?? params.visibleUids[params.visibleUids.length - 1] ?? null;
  }

  return { active, order };
}
