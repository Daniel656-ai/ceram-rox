/**
 * Gemeinsame Live-Suche für lange Auswahllisten.
 * Präfixsuche auf der SICHTBAREN Bezeichnung, rein als Zeichenfolge
 * (führende Nullen bleiben erhalten), Groß-/Kleinschreibung egal.
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Ab dieser Anzahl (exklusiv) erscheint ein Suchfeld. */
export const SEARCH_THRESHOLD = 10;

export function shouldShowSearch(optionCount: number): boolean {
  return optionCount > SEARCH_THRESHOLD;
}

export function matchesPrefix(label: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return String(label ?? "").toLocaleLowerCase().startsWith(q);
}

export function filterOptions<T extends SelectOption>(options: T[], query: string): T[] {
  return options.filter((o) => matchesPrefix(o.label, query));
}
