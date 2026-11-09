/**
 * Fachliche Gruppierung der Dienstleistungen im Pilot-Plant-Auftrags-Laufzettel.
 *
 * Reihenfolge: Knetung → Extrusion → PPP_Masse (Stammdatenreihenfolge) →
 * PPP_Produkt (Stammdatenreihenfolge) → nicht zuordenbar (Originalreihenfolge).
 *
 * Zuordnung ausschließlich über die Stammdatenlisten: ein Listeneintrag mit
 * `metadata.service_id` verweist eindeutig auf die Dienstleistung (kein
 * Namensrückfall); ohne Verweis gilt nur exakte Gleichheit von Eintrag
 * (Bezeichnung/Wert) und Katalogname – derselbe Mechanismus wie die
 * Auftragsformular-Auswahl. Keine Klick-, Proben- oder Nummernlogik.
 * Mehrdeutige Treffer werden nie geraten, sondern als nicht zugeordnet geführt.
 */
export type PppGroup = "knetung" | "extrusion" | "masse" | "produkt" | "unassigned";

export interface PppListItem {
  item_value: string;
  label: string;
  sort_order?: number | null;
  metadata?: any;
}

export interface PppLists {
  masse: PppListItem[] | null;
  produkt: PppListItem[] | null;
}

export interface PppServiceRef {
  serviceId: string | null;
  serviceName: string;
}

export const PPP_LIST_KEYS = { masse: "ppp_masse", produkt: "ppp_produkt" } as const;

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Knetung/Extrusion sind feste Prozessschritte – exakte Katalogbezeichnung. */
const FIXED: Record<string, PppGroup> = { knetung: "knetung", extrusion: "extrusion" };

function matchIndex(list: PppListItem[] | null, s: PppServiceRef): number | "ambiguous" | null {
  if (!list) return null;
  const sorted = [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const hits: number[] = [];
  sorted.forEach((it, i) => {
    const ref = it.metadata?.service_id;
    if (typeof ref === "string" && ref) {
      if (s.serviceId && ref === s.serviceId) hits.push(i);
      return;
    }
    const n = norm(s.serviceName);
    if (n && (norm(it.label) === n || norm(it.item_value) === n)) hits.push(i);
  });
  if (hits.length === 0) return null;
  return hits.length === 1 ? hits[0] : "ambiguous";
}

export interface PppClassification {
  group: PppGroup;
  index: number;
  /** Grund, falls nicht zugeordnet. */
  reason?: "no_list" | "not_listed" | "ambiguous" | "both_lists";
}

export function classifyPppService(s: PppServiceRef, lists: PppLists): PppClassification {
  const fixed = FIXED[norm(s.serviceName)];
  if (fixed) return { group: fixed, index: 0 };
  if (!lists.masse && !lists.produkt) return { group: "unassigned", index: 0, reason: "no_list" };
  const m = matchIndex(lists.masse, s);
  const p = matchIndex(lists.produkt, s);
  if (m === "ambiguous" || p === "ambiguous") return { group: "unassigned", index: 0, reason: "ambiguous" };
  if (m !== null && p !== null) return { group: "unassigned", index: 0, reason: "both_lists" };
  if (m !== null) return { group: "masse", index: m };
  if (p !== null) return { group: "produkt", index: p };
  return { group: "unassigned", index: 0, reason: "not_listed" };
}

const RANK: Record<PppGroup, number> = { knetung: 0, extrusion: 1, masse: 2, produkt: 3, unassigned: 4 };

/** Stabile Sortierung; jede Eingabe erscheint genau einmal. */
export function sortPppServices<T extends PppServiceRef>(
  services: T[], lists: PppLists,
): (T & { pppGroup: PppGroup; pppReason?: PppClassification["reason"] })[] {
  return services
    .map((s, pos) => ({ s, pos, c: classifyPppService(s, lists) }))
    .sort((a, b) => RANK[a.c.group] - RANK[b.c.group] || a.c.index - b.c.index || a.pos - b.pos)
    .map(({ s, c }) => ({ ...s, pppGroup: c.group, pppReason: c.reason }));
}
