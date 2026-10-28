/**
 * Sichtbare Bezeichnung einer Repeater-Zeile. Reine Anzeige: Die Zuordnung
 * gespeicherter Werte erfolgt weiterhin über Position bzw. __instance_id,
 * niemals über diesen Text.
 */
export interface RowLabelField {
  field_key: string;
  field_type: string;
  unit?: string | null;
  select_options?: unknown;
}

export function formatRepeaterRowLabel({
  entry, labelFieldKey, field, valueKey, itemLabel, index,
}: {
  entry: Record<string, unknown> | null | undefined;
  labelFieldKey?: string;
  field?: RowLabelField | null;
  /** Tatsächlicher Speicherschlüssel im Eintrag (value_key), sonst field_key. */
  valueKey?: string;
  itemLabel: string;
  index: number;
}): string {
  const fallback = `${itemLabel} ${index + 1}`;
  if (!labelFieldKey || !entry) return fallback;
  const raw = entry[valueKey ?? labelFieldKey];
  if (raw == null || typeof raw === "object" || String(raw).trim() === "") return fallback;
  const text = String(raw).trim();
  if (!field) return text;

  if (Array.isArray(field.select_options)) {
    for (const o of field.select_options as unknown[]) {
      const v = typeof o === "string" ? o : (o as any)?.value;
      if (v != null && String(v) === text) {
        const l = typeof o === "string" ? o : (o as any)?.label;
        if (l != null && String(l).trim()) return String(l).trim();
      }
    }
  }
  const numeric = ["number", "decimal", "integer"].includes(field.field_type);
  if (numeric && field.unit && String(field.unit).trim()) return `${text} ${String(field.unit).trim()}`;
  return text;
}

/** Feldtypen, die als Zeilenbezeichnung taugen (keine Container/Importe). */
export const isRowLabelCandidate = (fieldType: string) =>
  !["repeater", "measurement_block", "measurement_import", "file", "image", "rich_text", "textarea", "long_text"].includes(fieldType);
