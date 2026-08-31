/**
 * ROX – Zentrale Definition globaler Felder in Formularen
 * =======================================================
 *
 * Formularfelder speichern beim Einfügen eine Kopie von Bezeichnung, Einheit und
 * Beschreibung – die Referenz auf das globale Feld (`global_field_id`) bleibt
 * jedoch erhalten. Damit Änderungen an der zentralen Definition in allen
 * bestehenden Formularen sichtbar werden, wird die Kopie beim Laden durch die
 * aktuelle globale Definition überlagert (Read-Through statt Migration).
 *
 * Bewusst NICHT überlagert werden Feldschlüssel, Werte, Berechnungen,
 * Verknüpfungen und Layout – diese bleiben unverändert.
 */

export interface GlobalDefinitionLike {
  id: string;
  field_key: string;
  display_name: string;
  description: string | null;
  unit: string | null;
  is_repeatable?: boolean;
  data_type?: string;
}

export interface InheritingField {
  field_key: string;
  display_name: string;
  description: string | null;
  unit: string | null;
  global_field_id: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Mehrfachverwendungen erhalten beim Einfügen ein Suffix (`_2`, `_3` …).
 * Dieses Suffix bleibt bei der Überlagerung erhalten.
 */
export function instanceSuffix(
  fieldKey: string,
  global: GlobalDefinitionLike,
): string {
  if (fieldKey === global.field_key) return "";
  const m = new RegExp(`^${global.field_key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d+)$`).exec(fieldKey);
  if (!m) return "";
  const n = m[1];
  const reusable = !!global.is_repeatable || global.data_type === "repeater";
  return reusable ? ` ${n}` : ` (Verwendung ${n})`;
}

/** Überlagert ein einzelnes Feld mit der zentralen Definition. */
export function applyGlobalDefinition<T extends InheritingField>(
  field: T,
  global: GlobalDefinitionLike | undefined,
): T {
  if (!global) return field;
  const suffix = instanceSuffix(field.field_key, global);
  return {
    ...field,
    display_name: `${global.display_name}${suffix}`,
    description: global.description ?? null,
    unit: global.unit ?? null,
  };
}

/** Überlagert alle Felder einer Liste, die auf globale Felder referenzieren. */
export function applyGlobalDefinitions<T extends InheritingField>(
  fields: T[],
  globals: GlobalDefinitionLike[],
): T[] {
  if (!fields.length || !globals.length) return fields;
  const byId = new Map(globals.map((g) => [g.id, g]));
  return fields.map((f) =>
    f.global_field_id ? applyGlobalDefinition(f, byId.get(f.global_field_id)) : f,
  );
}
