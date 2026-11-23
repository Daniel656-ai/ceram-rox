import { articlePrefix } from "@/lib/m3List/orderLabel";

export interface ReleaseLinkRow {
  id: string;
  order_id: string | null;
  release_number?: string | null;
  revision_number?: number | null;
  article_number?: string | null;
  is_current?: boolean | null;
}

export interface M3RequestLinkRow {
  order_id: string | null;
  based_on_release_id: string | null;
}

/** "0020-5438 · Rev0" (erste 9 Stellen der Artikelnummer, sonst die Freigabenummer). */
export function releaseLabel(r: Pick<ReleaseLinkRow, "release_number" | "revision_number" | "article_number">): string | null {
  const base = articlePrefix(r.article_number) ?? (r.release_number?.trim() || null);
  if (!base) return null;
  return `${base} · Rev${r.revision_number ?? 0}`;
}

/**
 * Je Auftrag die zugehörige Fertigungsfreigabe als Anzeigetext. Maßgeblich ist die Revision,
 * aus deren m³-Liste der Auftrag erzeugt wurde; sonst die aktuelle bzw. höchste Revision.
 */
export function buildOrderReleaseLabels(
  releases: ReadonlyArray<ReleaseLinkRow>,
  requests: ReadonlyArray<M3RequestLinkRow>
): Map<string, string> {
  const byOrder = new Map<string, ReleaseLinkRow[]>();
  for (const r of releases) {
    if (!r.order_id) continue;
    const list = byOrder.get(r.order_id) ?? [];
    list.push(r);
    byOrder.set(r.order_id, list);
  }
  const basedOn = new Map<string, string>();
  for (const q of requests) if (q.order_id && q.based_on_release_id) basedOn.set(q.order_id, q.based_on_release_id);

  const out = new Map<string, string>();
  for (const [orderId, list] of byOrder) {
    const wanted = basedOn.get(orderId);
    const pick =
      list.find((r) => r.id === wanted) ??
      list.find((r) => r.is_current) ??
      [...list].sort((a, b) => (b.revision_number ?? 0) - (a.revision_number ?? 0))[0];
    const label = pick ? releaseLabel(pick) : null;
    if (label) out.set(orderId, label);
  }
  return out;
}
