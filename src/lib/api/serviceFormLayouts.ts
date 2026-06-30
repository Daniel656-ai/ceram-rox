import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type FormRoleView = "customer" | "employee" | "public";

export interface FormFieldRef {
  id: string; // local row id
  field_id: string; // service_data_fields.id
  width: 12 | 9 | 8 | 6 | 4 | 3;
  readonly?: boolean;
  hidden?: boolean;
  /** Optional override for the field's display name at this placement only. */
  label_override?: string;
  /** Optional override for the field's help text at this placement only. */
  description_override?: string;
}

export interface RepeatableConfig {
  /** When true, the section can be added multiple times by the end user. */
  enabled: boolean;
  /** Minimum number of entries that must exist (default 1). */
  min?: number;
  /** Maximum number of entries that may be added. 0 / undefined = unlimited. */
  max?: number;
  /** Singular label for a single entry, e.g. "Mundstück". */
  item_label?: string;
  /** Custom label for the add-button, e.g. "Weiteres Mundstück hinzufügen". */
  add_label?: string;
  /** Storage key used in the form value map. Defaults to `repeat:<section_id>`. */
  storage_key?: string;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  collapsed?: boolean;
  fields: FormFieldRef[];
  /** Optional repeater configuration. When enabled the section becomes a 1:n list. */
  repeatable?: RepeatableConfig;
}

export interface FormLayoutData {
  sections: FormSection[];
}

export interface ServiceFormLayout {
  id: string;
  service_id: string;
  role_view: FormRoleView;
  layout: FormLayoutData;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY: FormLayoutData = { sections: [] };

export const serviceFormLayouts = {
  get: async (serviceId: string, roleView: FormRoleView): Promise<ServiceFormLayout | null> => {
    const rows = (await unwrap(
      dbClient
        .from("service_form_layouts" as any)
        .select("*")
        .eq("service_id", serviceId)
        .eq("role_view", roleView)
        .limit(1)
    )) as unknown as ServiceFormLayout[];
    return rows?.[0] ?? null;
  },

  upsert: (serviceId: string, roleView: FormRoleView, layout: FormLayoutData) =>
    run(
      dbClient.from("service_form_layouts" as any).upsert(
        {
          service_id: serviceId,
          role_view: roleView,
          layout: layout as any,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "service_id,role_view" }
      )
    ),

  empty: (): FormLayoutData => ({ ...EMPTY, sections: [] }),
};
