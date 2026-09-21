/**
 * Ergebnismerkmale (Ergebnisbedingungen) in der Ergebnisdatenbank
 * ===============================================================
 *
 * Merkmale wie „Temperatur: 300 °C“ werden beim Abschluss der Tätigkeit
 * strukturiert am Ergebnis gespeichert (`measurement_results.instance_context`).
 * Hier werden sie nur gelesen – es entsteht keine zweite Datenhaltung und
 * keine feste Liste möglicher Merkmale: Jedes künftige Merkmal (T2–T6, Druck,
 * Gasart …) erscheint automatisch.
 */

import type { ResultRecord } from "@/hooks/useResultsDatabase";

type ContextLike = Record<string, string> | null | undefined;

/** Alle Merkmal/Wert-Paare eines Datensatzes (Messung und Einzelergebnisse). */
export function recordConditionEntries(record: ResultRecord): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const add = (ctx: ContextLike) => {
    for (const [k, v] of Object.entries(ctx ?? {})) {
      const key = String(k).trim();
      const value = String(v ?? "").trim();
      if (key && value) out.push([key, value]);
    }
  };
  add(record.instanceContext as ContextLike);
  for (const o of record.outputResults ?? []) add(o.instance_context as ContextLike);
  return out;
}

/** Verfügbare Merkmale mit ihren vorkommenden Werten – Grundlage der Filter. */
export function collectConditionDimensions(
  records: ResultRecord[],
): Array<{ key: string; values: string[] }> {
  const map = new Map<string, Set<string>>();
  for (const rec of records) {
    for (const [k, v] of recordConditionEntries(rec)) {
      const set = map.get(k) ?? new Set<string>();
      set.add(v);
      map.set(k, set);
    }
  }
  return [...map.entries()]
    .map(([key, values]) => ({
      key,
      values: [...values].sort((a, b) => {
        const na = Number.parseFloat(a.replace(",", "."));
        const nb = Number.parseFloat(b.replace(",", "."));
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return a.localeCompare(b, "de");
      }),
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "de"));
}

/** Trifft der Datensatz das gewählte Merkmal (optional mit Wert)? */
export function matchesCondition(
  record: ResultRecord,
  key: string,
  value?: string | null,
): boolean {
  if (!key) return true;
  return recordConditionEntries(record).some(
    ([k, v]) => k === key && (!value || value === "all" || v === value),
  );
}

/** Lesbare Zusammenfassung aller Merkmale eines Datensatzes (Export/Anzeige). */
export function conditionSummary(record: ResultRecord): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const [k, v] of recordConditionEntries(record)) {
    const text = `${k}: ${v}`;
    if (seen.has(text)) continue;
    seen.add(text);
    parts.push(text);
  }
  return parts.join(" · ");
}
