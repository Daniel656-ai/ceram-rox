/**
 * Central formatter for monetary values across the app.
 * Display-only: uses de-DE thousands separators. Preserves decimals if present
 * in the source value; whole numbers render without trailing zeros.
 * Does NOT alter stored values or calculations.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return "–";
  const hasDecimals = Math.abs(n - Math.trunc(n)) > 1e-9;
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
}
