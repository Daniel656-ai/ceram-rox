/**
 * Reine Regel-Logik: „1 Auftrag + mindestens 1 Fertigungsfreigabe = genau 1 Kundendoku".
 *
 * Bewusst ohne Datenbankzugriff, damit die Regel testbar bleibt.
 */

export interface ReleaseAssignment {
  id: string;
  order_id: string | null;
  revision_number: number | null;
  is_current: boolean | null;
}

export interface ExistingDoc {
  id: string;
  order_id: string | null;
  based_on_release_id: string | null;
}

export interface SyncPlan {
  creates: Array<{ orderId: string; releaseId: string }>;
  updates: Array<{ id: string; releaseId: string }>;
}

/** Aktuelle Revision je Auftrag: `is_current`, sonst höchste Revisionsnummer. */
export function currentReleaseByOrder(releases: ReleaseAssignment[]): Map<string, string> {
  const best = new Map<string, ReleaseAssignment>();
  for (const r of releases) {
    if (!r.order_id) continue;
    const prev = best.get(r.order_id);
    if (!prev) {
      best.set(r.order_id, r);
      continue;
    }
    const rCurrent = r.is_current === true;
    const pCurrent = prev.is_current === true;
    if (rCurrent !== pCurrent) {
      if (rCurrent) best.set(r.order_id, r);
      continue;
    }
    if ((r.revision_number ?? 0) > (prev.revision_number ?? 0)) best.set(r.order_id, r);
  }
  const out = new Map<string, string>();
  for (const [orderId, r] of best) out.set(orderId, r.id);
  return out;
}

export function planCustomerDocumentationSync(
  releases: ReleaseAssignment[],
  existing: ExistingDoc[]
): SyncPlan {
  const current = currentReleaseByOrder(releases);
  const byOrder = new Map<string, ExistingDoc>();
  for (const d of existing) {
    if (!d.order_id) continue;
    if (!byOrder.has(d.order_id)) byOrder.set(d.order_id, d);
  }
  const plan: SyncPlan = { creates: [], updates: [] };
  for (const [orderId, releaseId] of current) {
    const doc = byOrder.get(orderId);
    if (!doc) plan.creates.push({ orderId, releaseId });
    else if (doc.based_on_release_id !== releaseId) plan.updates.push({ id: doc.id, releaseId });
  }
  return plan;
}
