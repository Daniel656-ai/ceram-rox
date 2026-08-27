/**
 * Zentrale Darstellungslogik für Ergebnisfeld-Bezeichnungen.
 *
 * Grundprinzip: Die Einheit ist ein eigenes Attribut des Ergebnisfeldes und
 * niemals Bestandteil des Feldnamens. Die sichtbare Bezeichnung wird immer
 * dynamisch als `Feldname [Einheit]` erzeugt – ohne Einheit bleibt der reine
 * Feldname stehen (niemals leere Klammern).
 */

/** Einheitliche Anzeige: `Feldname [Einheit]` bzw. `Feldname` ohne Einheit. */
export function formatResultLabel(label: string, unit?: string | null): string {
  const name = (label ?? "").trim();
  const u = (unit ?? "").trim();
  if (!u) return name;
  // Ist die Einheit bereits im Namen enthalten (Altdaten/Import), nicht doppeln.
  if (new RegExp(`\\[\\s*${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\]$`).test(name)) return name;
  return `${name} [${u}]`;
}

/** Anzeige für einen beliebigen Ergebnisdatensatz mit Einheitenattribut. */
export function formatResultEntry(r: { label: string; unit?: string | null }): string {
  return formatResultLabel(r.label, r.unit);
}
