/**
 * Central formatter for raw-material quantities.
 * Display-only: does NOT alter stored values or calculations.
 * Renders numbers with 3 decimal places using de-DE separators.
 */
export function formatQuantity(
  value: number | string | null | undefined,
  fractionDigits = 3
): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return "–";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Convenience: formats "<qty> <unit>" with a safe fallback. */
export function formatQuantityWithUnit(
  value: number | string | null | undefined,
  unit?: string | null,
  fractionDigits = 3
): string {
  const q = formatQuantity(value, fractionDigits);
  return unit ? `${q} ${unit}` : q;
}

/** Maximale Nachkommastellen für Liefermengen (systemweite Regel). */
export const QUANTITY_DECIMALS = 3;

/**
 * Normalisiert eine Liefermenge auf maximal 3 Nachkommastellen –
 * mathematisch korrekt gerundet (kaufmännisch, nicht abgeschnitten).
 * 12.3454 → 12.345 · 12.3455 → 12.346 · 12.9999 → 13
 * Wird beim Import und beim Speichern angewendet, nicht nur in der Anzeige.
 */
export function normalizeQuantity(
  value: number | string | null | undefined,
  fractionDigits = QUANTITY_DECIMALS
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseQuantity(value);
  if (n === null || !isFinite(n)) return null;
  const f = 10 ** fractionDigits;
  // Number.EPSILON-Korrektur, damit 1.0005 nicht binär als 1.000499… abgerundet wird.
  const r = Math.round((Math.abs(n) + Number.EPSILON) * f) / f;
  const signed = n < 0 ? -r : r;
  return Object.is(signed, -0) ? 0 : signed;
}

/**
 * Interpretiert eine Zahl aus Excel/Text unabhängig davon, ob Dezimalpunkt
 * oder Dezimalkomma geliefert wird.
 * "125,1234" → 125.1234 · "125.1234" → 125.1234 · "1.234,5" → 1234.5 · "1,234.5" → 1234.5
 */
export function parseQuantity(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  let s = String(raw).trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Beide vorhanden: das hintere Zeichen ist das Dezimaltrennzeichen.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // Nur Komma: mehrere Kommas = Tausendertrenner, sonst Dezimalkomma.
    s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    // Nur Punkt: mehrere Punkte = Tausendertrenner, sonst Dezimalpunkt.
    if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
