/**
 * Zuordnungslogik der Kundendokumentation (rein rechnend, ohne Backendzugriff).
 *
 * - Genau eine Kundendoku je Auftrag.
 * - Grundlage ist immer die aktuell gültige Freigabe-Revision
 *   (`is_current`, bei Gleichstand die höchste Revisionsnummer).
 * - Ältere Revisionen bleiben unangetastet erhalten.
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
  /** Aufträge ohne Kundendoku – je Auftrag genau ein neues Dokument. */
  creates: Array<{ orderId: string; releaseId: string }>;
  /** Bestehende Kundendokus, deren Grundlage nachgeführt werden muss. */
  updates: Array<{ id: string; releaseId: string }>;
}

/** Aktuell gültige Revision je Auftrag. */
export function currentReleaseByOrder(releases: ReleaseAssignment[]): Map<string, string> {
  const best = new Map<string, { id: string; rev: number; isCurrent: boolean }>();
  for (const r of releases) {
    if (!r.order_id) continue;
    const cand = { id: r.id, rev: Number(r.revision_number) || 0, isCurrent: r.is_current === true };
    const prev = best.get(r.order_id);
    const better =
      !prev ||
      (cand.isCurrent && !prev.isCurrent) ||
      (cand.isCurrent === prev.isCurrent && cand.rev > prev.rev);
    if (better) best.set(r.order_id, cand);
  }
  return new Map([...best].map(([orderId, v]) => [orderId, v.id]));
}

export function planCustomerDocumentationSync(
  releases: ReleaseAssignment[],
  existing: ExistingDoc[]
): SyncPlan {
  const byOrder = new Map<string, ExistingDoc>();
  for (const d of existing) if (d.order_id && !byOrder.has(d.order_id)) byOrder.set(d.order_id, d);

  const creates: SyncPlan["creates"] = [];
  const updates: SyncPlan["updates"] = [];
  for (const [orderId, releaseId] of currentReleaseByOrder(releases)) {
    const doc = byOrder.get(orderId);
    if (!doc) creates.push({ orderId, releaseId });
    else if (doc.based_on_release_id !== releaseId) updates.push({ id: doc.id, releaseId });
  }
  return { creates, updates };
}
