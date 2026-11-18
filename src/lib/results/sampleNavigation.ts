import type { OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup } from "@/lib/results/sampleResultsAggregation";

/** Eine auswählbare Probenzeile in der Reihenfolge, wie sie in der Liste sichtbar ist. */
export interface NavItem {
  orderKey: string | null;
  sampleKey: string;
}

/** Sichtbare Probenzeilen: nach Auftrag nur Proben aufgeklappter Aufträge. */
export function buildNavItems(
  mode: "order" | "sample",
  orders: OrderGroup[],
  expanded: Set<string>,
  samples: SampleGroup[],
): NavItem[] {
  if (mode === "sample") return samples.map((s) => ({ orderKey: null, sampleKey: s.sampleKey }));
  return orders
    .filter((o) => expanded.has(o.orderKey))
    .flatMap((o) => o.samples.map((s) => ({ orderKey: o.orderKey, sampleKey: s.sampleKey })));
}

/** Nächste/vorherige Zeile (ohne Umlauf). Ist nichts gewählt, beginnt ↓ oben bzw. ↑ unten. */
export function stepSelection(items: NavItem[], current: NavItem | null, delta: 1 | -1): NavItem | null {
  if (items.length === 0) return null;
  const idx = current
    ? items.findIndex((i) => i.orderKey === current.orderKey && i.sampleKey === current.sampleKey)
    : -1;
  if (idx === -1) return delta === 1 ? items[0] : items[items.length - 1];
  const next = idx + delta;
  if (next < 0 || next >= items.length) return items[idx];
  return items[next];
}

/**
 * Kam die Probe aus der Ergebnisübersicht eines Auftrags (compareKey gesetzt), soll
 * „Zurück“ nach einem Wechsel per Pfeiltaste zur Übersicht des neuen Auftrags führen.
 * Ohne Ergebnisübersicht bleibt es leer.
 */
export function compareKeyAfterStep(compareKey: string | null, next: NavItem): string | null {
  return compareKey ? next.orderKey ?? compareKey : null;
}
