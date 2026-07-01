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
