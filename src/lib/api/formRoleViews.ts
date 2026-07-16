import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import type { FormLayoutTree } from "./formDefinitionLayout";
import { emptyLayout, normalizeLayout } from "./formDefinitionLayout";

/**
 * Role-based views of a form definition. Same field set, different layout
 * and (via `form_field_permissions`) different visibility/editability.
 *
 * Preset role keys — arbitrary custom keys are also allowed.
 */
export const ROLE_VIEW_PRESETS: { key: string; label: string }[] = [
  { key: "auftraggeber", label: "Auftraggeber" },
  { key: "messdienstleister", label: "Messdienstleister" },
  { key: "labor", label: "Labor" },
  { key: "admin", label: "Administrator" },
];

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
