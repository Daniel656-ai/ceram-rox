/** Explicit form saves only; never generate numbers or mutate form values. */
export function experimentNumberPatch(
  fields: readonly { field_key: string; binding_path?: string | null }[],
  values: Record<string, unknown>,
): { pp_experiment_number?: string } {
  const bound = fields.filter((field) => field.binding_path === "order.versuchsnummer");
  const candidates = bound.length > 0
    ? bound
    : fields.filter((field) => field.field_key === "versuchsnummer");
  // An ambiguous definition must not silently choose or combine numbers.
  if (candidates.length !== 1) return {};
  const value = values[candidates[0].field_key];
  if (typeof value !== "string" || !value.trim()) return {};
  return { pp_experiment_number: value.trim() };
}