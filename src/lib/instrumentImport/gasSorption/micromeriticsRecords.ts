/**
 * Strukturierte Auswertung der binären Micromeritics-Dateien (.REP/.SMP).
 *
 * Die Dateien bestehen aus längenpräfigierten UTF-16LE-Datensätzen. Beschriftungen
 * und Werte stehen dabei NICHT nebeneinander, sondern in zwei aufeinanderfolgenden
 * Gruppen gleicher Länge (erst alle Labels einer Zeile/Spalte, danach alle Werte).
 * Genau diese Gruppenstruktur wird hier ausgewertet – dadurch entfällt das frühere
 * Raten von Werten aus zufällig benachbarten Zeichenketten.
 *
 * Aufbau eines Datensatzes:
 *   [00 00 00 00 01 00 00 00 <count:uint32>]   (nur beim ersten Datensatz einer Gruppe)
 *   E0 01 00 <byteLength:uint32> <utf16le-Text>
 */

const MARKER = [0xe0, 0x01, 0x00];
const GROUP_HEADER = [0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00];

export interface MicromeriticsRecord {
  offset: number;
  text: string;
  /** Anzahl der Datensätze dieser Gruppe (nur beim ersten Datensatz gesetzt). */
  groupCount: number | null;
}

export interface MicromeriticsPair {
  label: string;
  value: string;
}

const decoder = () => new TextDecoder("utf-16le", { fatal: false });

const isPrintable = (t: string) => [...t].every((c) => c === "\t" || c.charCodeAt(0) >= 32);

export function extractMicromeriticsRecords(buffer: ArrayBuffer): MicromeriticsRecord[] {
  const buf = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const dec = decoder();
  const out: MicromeriticsRecord[] = [];

  for (let i = 0; i + 7 <= buf.length; i++) {
    if (buf[i] !== MARKER[0] || buf[i + 1] !== MARKER[1] || buf[i + 2] !== MARKER[2]) continue;
    const len = view.getUint32(i + 3, true);
    if (len <= 0 || len > 400 || len % 2 !== 0 || i + 7 + len > buf.length) continue;

    let text: string;
    try {
      text = dec.decode(buf.subarray(i + 7, i + 7 + len)).replace(/\u0000+$/, "");
    } catch {
      continue;
    }
    if (text === "" || !isPrintable(text)) continue;

    let groupCount: number | null = null;
    if (i >= 12) {
      const ok = GROUP_HEADER.every((b, k) => buf[i - 12 + k] === b);
      if (ok) {
        const n = view.getUint32(i - 4, true);
        if (n > 0 && n <= 64) groupCount = n;
      }
    }
    out.push({ offset: i, text, groupCount });
    i += 6 + len;
  }
  return out;
}

/** Datensätze zu Gruppen (Label-Gruppe / Wert-Gruppe) zusammenfassen. */
function toGroups(records: MicromeriticsRecord[]): string[][] {
  const groups: string[][] = [];
  let current: { items: string[]; size: number } | null = null;
  for (const r of records) {
    if (r.groupCount != null) {
      current = { items: [r.text], size: r.groupCount };
      groups.push(current.items);
    } else if (current && current.items.length < current.size) {
      current.items.push(r.text);
    } else {
      current = null;
    }
  }
  return groups;
}

const isLabel = (t: string) => /:\s*$/.test(t.trim()) && /[A-Za-zÄÖÜäöü]/.test(t);

/**
 * Liefert die Beschriftung/Wert-Paare der Datei.
 * Zwei aufeinanderfolgende Gruppen gleicher Größe werden positionsweise gepaart,
 * sofern die erste Gruppe überwiegend aus Beschriftungen besteht.
 */
export function extractMicromeriticsPairs(buffer: ArrayBuffer): MicromeriticsPair[] {
  const records = extractMicromeriticsRecords(buffer);
  const groups = toGroups(records);

  const pairs: MicromeriticsPair[] = [];

  for (let i = 0; i < groups.length - 1; i++) {
    const labels = groups[i];
    const values = groups[i + 1];
    if (labels.length !== values.length) continue;
    const labelCount = labels.filter(isLabel).length;
    if (labelCount === 0 || labelCount < labels.length - 1) continue;
    if (values.filter(isLabel).length > 0) continue;

    for (let k = 0; k < labels.length; k++) {
      if (!isLabel(labels[k])) continue;
      const value = values[k].trim();
      if (value === "") continue;
      pairs.push({ label: labels[k].trim().replace(/:\s*$/, ""), value });
    }
    i++; // Wertgruppe ist verbraucht
  }
  return pairs.length > 0 ? pairs : reverseLabelPairs(records);
}

/**
 * Fallback für Messdateien (.SMP) ohne Gruppenkopf: dort steht der Wertblock
 * unmittelbar VOR dem gleich langen Beschriftungsblock.
 */
export function reverseLabelPairs(records: MicromeriticsRecord[]): MicromeriticsPair[] {
  const texts = records.map((r) => r.text.trim());
  const pairs: MicromeriticsPair[] = [];
  let i = 0;
  while (i < texts.length) {
    if (!isLabel(texts[i])) { i++; continue; }
    let end = i;
    while (end + 1 < texts.length && isLabel(texts[end + 1])) end++;
    const n = end - i + 1;
    const start = i - n;
    if (start >= 0 && texts.slice(start, i).every((t) => t !== "" && !isLabel(t))) {
      for (let k = 0; k < n; k++) {
        pairs.push({ label: texts[i + k].replace(/:\s*$/, ""), value: texts[start + k] });
      }
    }
    i = end + 1;
  }
  return pairs;
}

/** Paare als auswertbare Zeilen „Bezeichnung: Wert“. */
export function micromeriticsPairLines(buffer: ArrayBuffer): string[] {
  return extractMicromeriticsPairs(buffer).map((p) => `${p.label}: ${p.value}`);
}

