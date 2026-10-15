/**
 * Darstellungsreihenfolge temperaturabhängiger NOx-Kenngrößen.
 *
 * Gilt ausschließlich für Bezeichnungen „K-Wert … (T °C)“ und „η-NOx … (T °C)“.
 * Primär Temperatur aufsteigend, dann K-Wert vor η-NOx, dann Indexnummer.
 * Alle anderen Einträge behalten ihre Position (Slot-Verfahren) – es ändert
 * sich nur die Reihenfolge, nie die Zuordnung von Schlüssel und Wert.
 */

export interface NoxParamInfo {
  kind: 0 | 1; // 0 = K-Wert, 1 = η-NOx
  temperature: number;
  index: number | null;
}

const TEMP_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*°\s*C\s*\)/i;
const K_RE = /^\s*k\s*-?\s*wert\b/i;
const ETA_RE = /^\s*(?:η|eta)\s*-?\s*no\s*[xₓ]/i;

export function parseNoxParam(label: string | null | undefined): NoxParamInfo | null {
  const s = String(label ?? "");
  const kind = K_RE.test(s) ? 0 : ETA_RE.test(s) ? 1 : null;
  if (kind === null) return null;
  const t = s.match(TEMP_RE);
  if (!t) return null;
  const temperature = Number(t[1].replace(",", "."));
  if (!Number.isFinite(temperature)) return null;
  const idx = s.replace(TEMP_RE, "").match(/(?:wert|no\s*[xₓ])\s*(\d+)\b/i);
  return { kind, temperature, index: idx ? Number(idx[1]) : null };
}

function compare(a: NoxParamInfo, b: NoxParamInfo): number {
  return a.temperature - b.temperature || a.kind - b.kind || (a.index ?? 0) - (b.index ?? 0);
}

/** Ordnet nur NOx-Einträge innerhalb ihrer bisherigen Positionen neu (stabil). */
export function reorderNoxItems<T>(items: T[], getLabel: (item: T) => string): T[] {
  const slots: number[] = [];
  const hits: Array<{ item: T; info: NoxParamInfo; pos: number }> = [];
  items.forEach((item, i) => {
    const info = parseNoxParam(getLabel(item));
    if (!info) return;
    slots.push(i);
    hits.push({ item, info, pos: i });
  });
  if (hits.length < 2) return items;
  hits.sort((a, b) => compare(a.info, b.info) || a.pos - b.pos);
  const out = [...items];
  slots.forEach((slot, i) => { out[slot] = hits[i].item; });
  return out;
}

/**
 * Sichtbare Bezeichnung ohne Indexnummer – nur wenn Temperatur + Kenngröße
 * innerhalb der übergebenen Liste eindeutig sind. Sonst `null` (unverändert).
 */
export function noxDisplayLabels(labels: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const counts = new Map<string, number>();
  const infos = labels.map((l) => [l, parseNoxParam(l)] as const);
  for (const [, info] of infos) {
    if (!info) continue;
    const k = `${info.kind}:${info.temperature}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [label, info] of infos) {
    if (!info || info.index === null) continue;
    if (counts.get(`${info.kind}:${info.temperature}`) !== 1) continue;
    out.set(label, label.replace(/((?:wert|no\s*[xₓ]))\s*\d+\b\s*/i, "$1 "));
  }
  return out;
}
