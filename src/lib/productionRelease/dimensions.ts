/**
 * Sichere Auswertung von Maß- und Toleranzangaben aus Fertigungsfreigaben.
 *
 * Grundsatz: Ziffern werden NIE durch Entfernen von Trennzeichen zusammengefügt
 * („152 x 152 mm“ ≠ 152152). Mehrdeutige Angaben liefern `ambiguous` und werden
 * zur Prüfung vorgelegt statt still umgewandelt.
 *
 * Toleranz-Symmetrisierung ist eine reine Rechenregel (Schwindungsauslegung) –
 * die Originalvorgabe bleibt unverändert erhalten.
 */

export type DimensionAnalysis =
  | { kind: "empty" }
  | { kind: "single"; value: number }
  | { kind: "cross_section"; width: number; height: number }
  | { kind: "tolerance"; nominal: number; upper: number; lower: number }
  | { kind: "ambiguous" };

/** Einzelne Zahl (deutsch oder englisch, Tausenderpunkt toleriert). */
export function parseNumberToken(token: string): number | null {
  let t = token.trim().replace(/[\u2212\u2013]/g, "-");
  if (!/^[+-]?\d[\d.,]*$/.test(t)) return null;
  t = t.replace(/\.(?=\d{3}(?:\D|$))/g, ""); // Tausenderpunkt
  if ((t.match(/,/g) ?? []).length > 1) return null;
  t = t.replace(",", ".");
  if ((t.match(/\./g) ?? []).length > 1) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const NUM = String.raw`[+\-\u2212\u2013]?\d[\d.,]*`;
const UNIT = String.raw`(?:\s*mm)?`;
const SEP = String.raw`\s*[x×X*]\s*`;

const CROSS_RE = new RegExp(String.raw`^\s*(${NUM})${UNIT}${SEP}(${NUM})${UNIT}\s*$`);
const PM_RE = new RegExp(String.raw`^\s*(${NUM})${UNIT}\s*(?:±|\+/-|\+-)\s*(\d[\d.,]*)${UNIT}\s*$`);
const ASYM_RE = new RegExp(
  String.raw`^\s*(${NUM})${UNIT}\s*\+\s*(\d[\d.,]*)${UNIT}\s*(?:/\s*)?[-\u2212\u2013]\s*(\d[\d.,]*)${UNIT}\s*$`
);

export function analyzeDimensionText(raw: unknown): DimensionAnalysis {
  if (raw === null || raw === undefined) return { kind: "empty" };
  if (typeof raw === "number") return Number.isFinite(raw) ? { kind: "single", value: raw } : { kind: "ambiguous" };
  const s = String(raw).trim();
  if (!s) return { kind: "empty" };

  const cross = s.match(CROSS_RE);
  if (cross) {
    const w = parseNumberToken(cross[1]);
    const h = parseNumberToken(cross[2]);
    return w != null && h != null && w > 0 && h > 0 ? { kind: "cross_section", width: w, height: h } : { kind: "ambiguous" };
  }
  const pm = s.match(PM_RE);
  if (pm) {
    const n = parseNumberToken(pm[1]);
    const t = parseNumberToken(pm[2]);
    return n != null && t != null ? { kind: "tolerance", nominal: n, upper: t, lower: t } : { kind: "ambiguous" };
  }
  const asym = s.match(ASYM_RE);
  if (asym) {
    const n = parseNumberToken(asym[1]);
    const up = parseNumberToken(asym[2]);
    const lo = parseNumberToken(asym[3]);
    return n != null && up != null && lo != null
      ? { kind: "tolerance", nominal: n, upper: up, lower: lo }
      : { kind: "ambiguous" };
  }

  // Genau eine Zahl, sonstiger Text (Einheit, „ca.“) wird ignoriert.
  const tokens = s.match(/[+\-\u2212\u2013]?\d[\d.,]*/g) ?? [];
  if (tokens.length === 1) {
    const n = parseNumberToken(tokens[0]);
    return n != null ? { kind: "single", value: n } : { kind: "ambiguous" };
  }
  return { kind: "ambiguous" };
}

/**
 * Rechenwert für die Schwindungsauslegung: aus Grenzmaßen abgeleitetes
 * symmetrisches Nennmaß. 150 +1/−3 → Grenzmaße 151/147 → 149 ±2.
 */
export function symmetrizeTolerance(nominal: number, upper: number, lower: number) {
  const max = nominal + Math.abs(upper);
  const min = nominal - Math.abs(lower);
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { nominal: round((max + min) / 2), tolerance: round((max - min) / 2), max: round(max), min: round(min) };
}

const fmt = (n: number) => n.toLocaleString("de-AT", { maximumFractionDigits: 3 });

/** Anzeige „152 mm × 203 mm“. */
export function formatCrossSection(width: number, height: number): string {
  return `${fmt(width)} mm × ${fmt(height)} mm`;
}

export interface CrossSectionInfo {
  width: number | null;
  height: number | null;
  display: string | null;
  /** Originaltext aus der Freigabe, falls vorhanden. */
  original: string | null;
}

/**
 * Querschnitt einer Freigabe-Revision: bevorzugt der unverändert gesicherte
 * Originaltext (field_sources.cross_section_mm.raw), sonst der gespeicherte
 * Einzelwert. Ein Einzelwert wird NICHT zu einem Quadrat ergänzt.
 */
export function crossSectionFromRelease(release: Record<string, unknown> | null): CrossSectionInfo {
  if (!release) return { width: null, height: null, display: null, original: null };
  const sources = (release.field_sources ?? {}) as Record<string, { raw?: unknown } | undefined>;
  const original = typeof sources.cross_section_mm?.raw === "string" ? (sources.cross_section_mm.raw as string) : null;
  if (original) {
    const a = analyzeDimensionText(original);
    if (a.kind === "cross_section") {
      return { width: a.width, height: a.height, display: formatCrossSection(a.width, a.height), original };
    }
  }
  const stored = analyzeDimensionText(release.cross_section_mm as unknown);
  if (stored.kind === "single") {
    return { width: stored.value, height: null, display: `${fmt(stored.value)} mm`, original };
  }
  return { width: null, height: null, display: original, original };
}
