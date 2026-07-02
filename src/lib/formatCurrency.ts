/**
 * Central formatter for monetary values in project views.
 * Display-only: rounds commercially to whole units and uses de-DE thousands separators.
 * Does NOT alter stored values or calculations.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return "–";
  return Math.round(n).toLocaleString("de-DE", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
