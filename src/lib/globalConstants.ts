/**
 * Globale technische Konstanten verwenden die bestehende globale Feldstruktur.
 * Bei `data_source = constant` ist `default_value` der verbindliche Wert und
 * ausdrücklich kein Platzhalter oder Fallback.
 */
export const GLOBAL_CONSTANT_SOURCE = "constant" as const;

export interface GlobalConstantLike {
  field_key: string;
  display_name?: string | null;
  data_type?: string | null;
  default_value?: string | null;
  data_source?: string | null;
}

export const isGlobalConstant = (field: GlobalConstantLike): boolean =>
  field.data_source === GLOBAL_CONSTANT_SOURCE;

export function parseGlobalConstantValue(field: GlobalConstantLike): unknown {
  if (!isGlobalConstant(field)) return undefined;
  const raw = field.default_value;
  if (raw == null || raw.trim() === "") return undefined;

  if (["number", "decimal", "percent"].includes(field.data_type ?? "")) {
    const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : undefined;
  }
  if (field.data_type === "boolean") return raw === "true" || raw === "1";
  return raw;
}

export function globalConstantScope(fields: GlobalConstantLike[]): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (const field of fields) {
    const value = parseGlobalConstantValue(field);
    if (value !== undefined) scope[field.field_key] = value;
  }
  return scope;
}