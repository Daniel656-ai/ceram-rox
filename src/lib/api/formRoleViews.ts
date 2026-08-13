import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import type { FormLayoutTree } from "./formDefinitionLayout";
import { emptyLayout, normalizeLayout } from "./formDefinitionLayout";

/**
 * Rollenansichten eines Globalen Formulars. Gleiches Feld-Set, unterschiedliches
 * Layout und (über `form_field_permissions`) unterschiedliche Sichtbarkeit /
 * Bearbeitbarkeit.
 *
 * Kanonische Ansichten eines Globalen Formulars – zusätzliche eigene Schlüssel
 * sind weiterhin erlaubt.
 */
export const ROLE_VIEW_PRESETS: { key: string; label: string }[] = [
  { key: "auftraggeber", label: "Auftraggeber" },
  { key: "messdienstleister", label: "Messdienstleister" },
  { key: "ergebnis", label: "Ergebnis" },
];

/** Laufzeit-Kontext, in dem ein Globales Formular gerendert wird. */
export type FormViewContext = "customer" | "employee" | "result";

/** Kanonischer Ansichts-Schlüssel je Kontext. */
export const VIEW_KEY_BY_CONTEXT: Record<FormViewContext, string> = {
  customer: "auftraggeber",
  employee: "messdienstleister",
  result: "ergebnis",
};

/** Historische Schlüssel, die auf denselben Kontext zeigen (Altdaten). */
export const LEGACY_VIEW_KEYS: Record<FormViewContext, string[]> = {
  customer: ["customer", "auftraggeber_ansicht"],
  employee: ["employee", "messdienstleister_ansicht", "labor"],
  result: ["result", "ergebnisformular", "report"],
};

export const DEFAULT_ROLE_KEY = "default";


export interface FormRoleView {
  id: string;
  form_definition_id: string;
  role_key: string;
  label: string;
  layout: FormLayoutTree | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const formRoleViews = {
  list: (formId: string) =>
    unwrap(
      dbClient
        .from("form_role_views" as any)
        .select("*")
        .eq("form_definition_id", formId)
        .order("role_key")
    ) as unknown as Promise<FormRoleView[]>,

  get: async (formId: string, roleKey: string): Promise<FormRoleView | null> => {
    const { data, error } = await dbClient
      .from("form_role_views" as any)
      .select("*")
      .eq("form_definition_id", formId)
      .eq("role_key", roleKey)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as FormRoleView) ?? null;
  },

  upsert: (formId: string, roleKey: string, label: string, layout: FormLayoutTree) =>
    run(
      dbClient
        .from("form_role_views" as any)
        .upsert(
          {
            form_definition_id: formId,
            role_key: roleKey,
            label,
            layout: layout as any,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "form_definition_id,role_key" }
        )
    ),

  remove: (id: string) => run(dbClient.from("form_role_views" as any).delete().eq("id", id)),

  /**
   * Resolve the layout tree for a given role, falling back to the
   * default role view and finally to the form's base layout.
   */
  async getEffectiveLayout(
    formId: string,
    roleKey: string,
    baseLayout: unknown
  ): Promise<FormLayoutTree> {
    const rv = await formRoleViews.get(formId, roleKey);
    if (rv) return normalizeLayout(rv.layout);
    if (roleKey !== DEFAULT_ROLE_KEY) {
      const def = await formRoleViews.get(formId, DEFAULT_ROLE_KEY);
      if (def) return normalizeLayout(def.layout);
    }
    const normalized = normalizeLayout(baseLayout);
    return normalized.nodes.length ? normalized : emptyLayout();
  },
};
