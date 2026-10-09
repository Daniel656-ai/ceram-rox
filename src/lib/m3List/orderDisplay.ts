/** Presentation only: never pass these values to persistence, exports or handover. */
export function m3OrderLabel(
  releaseNumber: string | null | undefined,
  projectName: string | null | undefined,
): string {
  return [releaseNumber?.trim().slice(0, 9), projectName?.trim()].filter(Boolean).join(" ");
}

/** Keep the original derived values (including the internal order number) untouched. */
export function withM3OrderDisplay(
  values: Record<string, unknown>,
  releaseNumber: string | null | undefined,
  projectName: string | null | undefined,
): Record<string, unknown> {
  return { ...values, order_number: m3OrderLabel(releaseNumber, projectName) };
}