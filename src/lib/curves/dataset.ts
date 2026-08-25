/**
 * Generisches, verfahrensunabhängiges Kurvenmodell.
 *
 * Jede Messdatei (NETZSCH DIL/STA, künftig weitere Verfahren) wird auf dieses
 * Modell abgebildet: Kanäle mit Einheit + Messpunkte als Zahlenmatrix.
 * Alle Auswertungen arbeiten ausschließlich auf diesem Modell.
 */

export interface MeasurementChannel {
  /** Stabiler technischer Schlüssel (normalisiert). */
  key: string;
  /** Anzeigename exakt wie in der Datei. */
  label: string;
  /** Einheit ohne Klammern, z. B. "°C", "mW/mg", "%". */
  unit: string | null;
  /** true, wenn der Kanal von ROX berechnet wurde (nicht aus der Datei). */
  derived?: boolean;
  /** Kurzbeschreibung der Ableitung (nur bei derived). */
  derivedFrom?: string;
}

export interface MeasurementDataset {
  channels: MeasurementChannel[];
  /** Eine Zeile je Messpunkt, Spaltenreihenfolge = channels. */
  rows: number[][];
}

export interface CurvePoint {
  x: number;
  y: number;
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Kanalschlüssel: kleingeschrieben, ohne Sonderzeichen. */
export function channelKey(label: string): string {
  return String(label ?? "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUP.indexOf(c)))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Trennt Kanalname und Einheit einer NETZSCH-Spaltenüberschrift.
 * "Temp./°C" -> { name: "Temp.", unit: "°C" }
 * "DSC/(mW/mg)" -> { name: "DSC", unit: "mW/mg" }
 * "Gas Flow(purge1)/(ml/min)" -> { name: "Gas Flow(purge1)", unit: "ml/min" }
 * "dL/Lo" -> { name: "dL/Lo", unit: null }  (dimensionslos)
 */
export function splitChannelHeader(header: string): { name: string; unit: string | null } {
  const raw = String(header ?? "").trim();
  if (!raw) return { name: "", unit: null };

  // Einheit in Klammern nach dem letzten "/"
  const paren = raw.match(/^(.*)\/\(([^()]*)\)\s*$/);
  if (paren) return { name: paren[1].trim(), unit: paren[2].trim() || null };

  const idx = raw.lastIndexOf("/");
  if (idx > 0) {
    const name = raw.slice(0, idx).trim();
    const unit = raw.slice(idx + 1).trim();
    // "dL/Lo": der Teil hinter "/" ist keine Einheit, sondern Teil des Namens.
    if (unit && !/^(Lo|L0|L₀)$/i.test(unit) && !/\s/.test(unit)) {
      return { name, unit };
    }
  }
  return { name: raw, unit: null };
}

export const channelIndex = (ds: MeasurementDataset, key: string) =>
  ds.channels.findIndex((c) => c.key === key);

export const findChannel = (ds: MeasurementDataset, key: string) =>
  ds.channels.find((c) => c.key === key) ?? null;

/** Kurve aus zwei Kanälen; Punkte mit ungültigen Werten werden verworfen. */
export function curveOf(ds: MeasurementDataset, xKey: string, yKey: string): CurvePoint[] {
  const xi = channelIndex(ds, xKey);
  const yi = channelIndex(ds, yKey);
  if (xi < 0 || yi < 0) return [];
  const out: CurvePoint[] = [];
  for (const r of ds.rows) {
    const x = r[xi];
    const y = r[yi];
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

/** Punkte innerhalb [from, to] (Reihenfolge der Grenzen egal). */
export function sliceRange(points: CurvePoint[], from: number, to: number): CurvePoint[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return points.filter((p) => p.x >= lo && p.x <= hi);
}

/** Linear interpolierter y-Wert an der Stelle x (null außerhalb des Bereichs). */
export function interpolateAt(points: CurvePoint[], x: number): number | null {
  if (points.length === 0) return null;
  const asc = points[0].x <= points[points.length - 1].x ? points : [...points].reverse();
  if (x < asc[0].x || x > asc[asc.length - 1].x) return null;
  for (let i = 0; i < asc.length - 1; i++) {
    const a = asc[i];
    const b = asc[i + 1];
    if (x >= a.x && x <= b.x) {
      if (b.x === a.x) return a.y;
      const t = (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return asc[asc.length - 1].y;
}

/**
 * Gleichmäßige Reduktion für die Darstellung großer Messreihen.
 * Erster und letzter Punkt bleiben immer erhalten.
 */
export function downsample(points: CurvePoint[], max = 2000): CurvePoint[] {
  if (points.length <= max || max < 2) return points;
  const step = (points.length - 1) / (max - 1);
  const out: CurvePoint[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/** Fläche unter der Kurve (Trapezregel) – Basis für Peakflächen. */
export function trapezoidArea(points: CurvePoint[], baseline: (x: number) => number = () => 0): number {
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ya = a.y - baseline(a.x);
    const yb = b.y - baseline(b.x);
    area += ((ya + yb) / 2) * (b.x - a.x);
  }
  return area;
}
