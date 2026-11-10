import type { OrderPriority } from "@/lib/types";

/**
 * Auftragspriorität — vier echte Stufen (niedrig, normal, hoch, sehr_hoch).
 *
 * Die historischen Enum-Werte `wichtig` und `hoechste` bleiben in der
 * Datenbank erhalten und werden ausschließlich lesend auf `hoch` bzw.
 * `sehr_hoch` abgebildet. Bestehende Auftragswerte werden nie umgeschrieben.
 * Die numerische Abbildung auf order_measurements.priority erfolgt
 * serverseitig durch priority_enum_to_int() — diese Ränge müssen damit
 * übereinstimmen (hoch=2, sehr_hoch=3, nie zusammenfallend).
 */

export const PRIORITY_LEVELS = ["niedrig", "normal", "hoch", "sehr_hoch"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

/** Historische Datenbankwerte → aktuelle Stufe (nur Anzeige/Auswahl). */
const LEGACY_TO_LEVEL: Record<string, PriorityLevel> = {
  wichtig: "hoch",
  hoechste: "sehr_hoch",
};

/** Beliebigen gespeicherten Wert auf eine der vier Stufen abbilden. */
export function normalizePriority(p: string | null | undefined): PriorityLevel {
  if (!p) return "normal";
  if ((PRIORITY_LEVELS as readonly string[]).includes(p)) return p as PriorityLevel;
  return LEGACY_TO_LEVEL[p] ?? "normal";
}

/** Numerischer Rang 0–3; hoch und sehr_hoch fallen nie zusammen. */
export function priorityRank(p: string | null | undefined): number {
  return PRIORITY_LEVELS.indexOf(normalizePriority(p));
}

/** i18n-Schlüssel im common-Namespace. */
export function priorityLabelKey(p: string | null | undefined): string {
  switch (normalizePriority(p)) {
    case "niedrig": return "priority_low";
    case "hoch": return "priority_high";
    case "sehr_hoch": return "priority_very_high";
    default: return "priority_normal";
  }
}

/** Badge-Variante zur farblichen Unterscheidung (semantische Varianten). */
export function priorityBadgeVariant(
  p: string | null | undefined
): "secondary" | "outline" | "default" | "destructive" {
  switch (normalizePriority(p)) {
    case "niedrig": return "secondary";
    case "hoch": return "default";
    case "sehr_hoch": return "destructive";
    default: return "outline";
  }
}

/** Ob ein gespeicherter Wert ein historischer (nicht mehr wählbarer) Wert ist. */
export function isLegacyPriority(p: string | null | undefined): boolean {
  return !!p && p in LEGACY_TO_LEVEL;
}

export type { OrderPriority };
