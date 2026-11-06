/**
 * Reine Zoom-/Sichtbereichslogik für den Kurvenviewer.
 * Betrifft ausschließlich den sichtbaren Bereich (viewRange) – niemals den
 * fachlichen Auswertungsbereich.
 */
export interface XRange { from: number; to: number }

/** Kleinster erlaubter Sichtbereich relativ zum Gesamtbereich. */
export const MIN_SPAN_RATIO = 1e-6;

export function normalizeRange(r: XRange): XRange {
  return r.from <= r.to ? r : { from: r.to, to: r.from };
}

/** Sichtbereich in den Gesamtbereich einpassen (Breite bleibt, wenn möglich). */
export function clampRange(r: XRange, full: XRange): XRange {
  const f = normalizeRange(full);
  const fullSpan = f.to - f.from;
  if (fullSpan <= 0) return { ...f };
  let { from, to } = normalizeRange(r);
  const minSpan = fullSpan * MIN_SPAN_RATIO;
  if (to - from < minSpan) { const c = (from + to) / 2; from = c - minSpan / 2; to = c + minSpan / 2; }
  const span = to - from;
  if (span >= fullSpan) return { ...f };
  if (from < f.from) { from = f.from; to = from + span; }
  if (to > f.to) { to = f.to; from = to - span; }
  return { from, to };
}

/** Zoom um einen Ankerpunkt; factor < 1 vergrößert, > 1 verkleinert. */
export function zoomAt(r: XRange, full: XRange, anchor: number, factor: number): XRange {
  const { from, to } = normalizeRange(r);
  const a = Math.min(Math.max(anchor, from), to);
  return clampRange({ from: a - (a - from) * factor, to: a + (to - a) * factor }, full);
}

/** Wheel-Delta (Pixel/Zeilen/Seiten) in einen stufenlosen Zoomfaktor umrechnen. */
export function wheelFactor(deltaY: number, deltaMode = 0, intensity = 0.0015): number {
  const dy = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);
  return Math.exp(dy * intensity);
}

/** Horizontal verschieben um dx (in X-Einheiten); Breite bleibt erhalten. */
export function panBy(r: XRange, full: XRange, dx: number): XRange {
  const { from, to } = normalizeRange(r);
  return clampRange({ from: from + dx, to: to + dx }, full);
}

/** Pixelposition (relativ zur Zeichenfläche) in einen X-Wert umrechnen. */
export function pixelToX(px: number, plotWidth: number, r: XRange): number {
  if (plotWidth <= 0) return r.from;
  const t = Math.min(Math.max(px / plotWidth, 0), 1);
  return r.from + t * (r.to - r.from);
}

export function sameRange(a: XRange, b: XRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** Zoom-Historie: past/current/future. */
export interface ZoomHistory { past: XRange[]; current: XRange; future: XRange[] }

export const initHistory = (r: XRange): ZoomHistory => ({ past: [], current: r, future: [] });

export function pushView(h: ZoomHistory, next: XRange): ZoomHistory {
  if (sameRange(h.current, next)) return h;
  return { past: [...h.past, h.current].slice(-100), current: next, future: [] };
}

export function undoView(h: ZoomHistory): ZoomHistory {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), current: h.past[h.past.length - 1], future: [h.current, ...h.future] };
}

export function redoView(h: ZoomHistory): ZoomHistory {
  if (!h.future.length) return h;
  return { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) };
}

/** Reset: vollständiger Bereich, Historie wird geleert. */
export const resetView = (full: XRange): ZoomHistory => initHistory(full);
