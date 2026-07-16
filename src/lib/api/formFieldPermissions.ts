import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type FieldVisibility = "hidden" | "read" | "write";

export interface FormFieldPermission {
  id: string;
  form_definition_id: string;
  role_key: string;
  field_id: string;
  visibility: FieldVisibility;
  required: boolean;
  created_at: string;
  updated_at: string;
}

export interface EffectivePermission {
  visibility: FieldVisibility;
  required: boolean;
  locked?: boolean;
}

const DEFAULT: EffectivePermission = { visibility: "write", required: false };

export const formFieldPermissions = {
  listForForm: (formId: string) =>
    unwrap(
      dbClient
        .from("form_field_permissions" as any)
        .select("*")
        .eq("form_definition_id", formId)
    ) as unknown as Promise<FormFieldPermission[]>,

  listForRole: (formId: string, roleKey: string) =>
    unwrap(
      dbClient
        .from("form_field_permissions" as any)
        .select("*")
        .eq("form_definition_id", formId)
        .eq("role_key", roleKey)
    ) as unknown as Promise<FormFieldPermission[]>,

  /** Bulk replace all permissions for a given (form, role). */
  async replaceForRole(
    formId: string,
    roleKey: string,
    rows: Array<{ field_id: string; visibility: FieldVisibility; required: boolean }>
  ) {
    await run(
      dbClient
        .from("form_field_permissions" as any)
        .delete()
        .eq("form_definition_id", formId)
        .eq("role_key", roleKey)
    );
    if (rows.length === 0) return;
    await run(
      dbClient
        .from("form_field_permissions" as any)
        .insert(
          rows.map((r) => ({
            form_definition_id: formId,
            role_key: roleKey,
            field_id: r.field_id,
            visibility: r.visibility,
            required: r.required,
          })) as any
        )
    );
  },

  /**
   * Build an effective permission map for a role, defaulting all unspecified
   * fields to `write` / not-required. `lockedFieldIds` overrides visibility → `read`.
   */
  async getEffectiveMap(
    formId: string,
    roleKey: string,
    fieldIds: string[],
    lockedFieldIds: string[] = []
  ): Promise<Map<string, EffectivePermission>> {
    const map = new Map<string, EffectivePermission>();
    for (const id of fieldIds) map.set(id, { ...DEFAULT });
    const rows = await formFieldPermissions.listForRole(formId, roleKey);
    for (const r of rows) {
      if (!map.has(r.field_id)) continue;
      map.set(r.field_id, { visibility: r.visibility, required: r.required });
    }
    const lockedSet = new Set(lockedFieldIds);
    for (const [id, p] of map) {
      if (lockedSet.has(id)) {
        map.set(id, { ...p, visibility: p.visibility === "hidden" ? "hidden" : "read", locked: true, required: false });
      }
    }
    return map;
  },

  defaultPermission(): EffectivePermission {
    return { ...DEFAULT };
  },
};
