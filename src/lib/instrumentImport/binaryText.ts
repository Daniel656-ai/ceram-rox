/**
 * Hilfsfunktionen zum strukturierten Auslesen proprietärer Binärdateien.
 *
 * Bewusst OHNE feste Byte-Offsets: es werden ausschließlich lesbare
 * Zeichenketten (ASCII/Latin-1 und UTF-16LE) samt ihrer Fundstelle
 * extrahiert; die fachliche Interpretation übernimmt der jeweilige Parser.
 */

export interface ExtractedString {
  text: string;
  offset: number;
  encoding: "ascii" | "utf16le";
}

const isPrintable = (c: number) => c === 9 || (c >= 32 && c !== 127 && c <= 255);

/** ASCII/Latin-1-Textläufe ab einer Mindestlänge. */
export function extractAsciiStrings(buf: Uint8Array, minLen = 3): ExtractedString[] {
  const out: ExtractedString[] = [];
  let start = -1;
  const chars: number[] = [];
  for (let i = 0; i <= buf.length; i++) {
    const c = i < buf.length ? buf[i] : 0;
    if (i < buf.length && isPrintable(c)) {
      if (start < 0) start = i;
      chars.push(c);
    } else {
      if (start >= 0 && chars.length >= minLen) {
        out.push({ text: String.fromCharCode(...chars).trim(), offset: start, encoding: "ascii" });
      }
      start = -1;
      chars.length = 0;
    }
  }
  return out.filter((s) => s.text !== "");
}

/** UTF-16LE-Textläufe (Micromeritics speichert Beschriftungen häufig so). */
export function extractUtf16Strings(buf: Uint8Array, minLen = 3): ExtractedString[] {
  const out: ExtractedString[] = [];
  let start = -1;
  const chars: number[] = [];
  for (let i = 0; i + 1 <= buf.length; i += 2) {
    const lo = buf[i];
    const hi = i + 1 < buf.length ? buf[i + 1] : 1;
    const ok = hi === 0 && isPrintable(lo);
    if (ok) {
      if (start < 0) start = i;
      chars.push(lo);
    } else {
      if (start >= 0 && chars.length >= minLen) {
        out.push({ text: String.fromCharCode(...chars).trim(), offset: start, encoding: "utf16le" });
      }
      start = -1;
      chars.length = 0;
    }
  }
  return out.filter((s) => s.text !== "");
}

/** Alle lesbaren Zeichenketten, nach Fundstelle sortiert. */
export function extractStrings(buffer: ArrayBuffer, minLen = 3): ExtractedString[] {
  const buf = new Uint8Array(buffer);
  return [...extractAsciiStrings(buf, minLen), ...extractUtf16Strings(buf, minLen)].sort(
    (a, b) => a.offset - b.offset
  );
}

/**
 * Plausible IEEE-754-Doubles in einem Bereich der Datei.
 * Wird nur als letzte Rückfallebene mit niedriger Konfidenz genutzt.
 */
export function scanDoubles(buffer: ArrayBuffer, from: number, to: number): { offset: number; value: number }[] {
  const view = new DataView(buffer);
  const out: { offset: number; value: number }[] = [];
  const end = Math.min(to, buffer.byteLength - 8);
  for (let i = Math.max(0, from); i <= end; i++) {
    const v = view.getFloat64(i, true);
    if (!Number.isFinite(v) || v === 0) continue;
    const a = Math.abs(v);
    if (a < 1e-6 || a > 1e9) continue;
    out.push({ offset: i, value: v });
  }
  return out;
}
