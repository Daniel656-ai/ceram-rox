import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type FormFieldType =
  | "text" | "longtext" | "number" | "decimal" | "percent"
  | "date" | "time" | "datetime" | "boolean"
  | "select" | "multiselect"
  | "file" | "image" | "barcode" | "qrcode"
  | "ref_customer" | "ref_material" | "ref_product" | "ref_machine"
  | "ref_employee" | "ref_location" | "ref_batch" | "ref_serial"
  | "repeater" | "handwriting" | "computed" | "raw_material_recipe";

export interface FormField {
  id: string;
  form_id: string;
  field_key: string;
  display_name: string;
  description: string | null;
  field_type: FormFieldType;
  category: string | null;
  unit: string | null;
  is_required: boolean;
  default_value: string | null;
  validation: Record<string, unknown>;
  min_value: number | null;
  max_value: number | null;
  decimal_places: number | null;
  readonly: boolean;
  formula: string | null;
  select_options: Array<string | { label: string; value: string }>;
  ref_target: string | null;
  parent_field_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Config stored inside `form_fields.metadata` for fields of type `repeater`. */
export interface RepeaterMeta {
  min_entries?: number;
  max_entries?: number;
  item_label?: string;
  add_label?: string;
  /** Storage key used to persist entries in shared_form_data. Falls back to field_key. */
  storage_key?: string;
}

export const readRepeaterMeta = (field: FormField): RepeaterMeta => {
  const m = (field.metadata ?? {}) as Record<string, unknown>;
  const r = (m.repeater ?? {}) as RepeaterMeta;
  return {
    min_entries: typeof r.min_entries === "number" ? r.min_entries : 0,
    max_entries: typeof r.max_entries === "number" ? r.max_entries : undefined,
    item_label: typeof r.item_label === "string" ? r.item_label : "Eintrag",
    add_label: typeof r.add_label === "string" ? r.add_label : "Eintrag hinzufügen",
    storage_key: typeof r.storage_key === "string" ? r.storage_key : undefined,
  };
};

export const writeRepeaterMeta = (field: FormField, patch: Partial<RepeaterMeta>): Record<string, unknown> => {
  const m = { ...((field.metadata ?? {}) as Record<string, unknown>) };
  const cur = (m.repeater ?? {}) as RepeaterMeta;
  m.repeater = { ...cur, ...patch };
  return m;
};

export const formFields = {
  listForForm: (formId: string) =>
    unwrap(
      dbClient
        .from("form_fields" as any)
        .select("*")
        .eq("form_id", formId)
        .order("sort_order")
        .order("created_at")
    ) as unknown as Promise<FormField[]>,

  create: (input: Partial<FormField> & { form_id: string; field_key: string; display_name: string; field_type: FormFieldType }) =>
    unwrap(
      dbClient.from("form_fields" as any).insert(input as any).select().single()
    ) as unknown as Promise<FormField>,

  update: (id: string, updates: Partial<FormField>) =>
    run(dbClient.from("form_fields" as any).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("form_fields" as any).delete().eq("id", id)),

  reorder: async (orders: Array<{ id: string; sort_order: number }>) => {
    for (const o of orders) {
      await run(
        dbClient.from("form_fields" as any).update({ sort_order: o.sort_order } as any).eq("id", o.id)
      );
    }
  },
};

/** Return children of a repeater field, in sort_order. */
export const repeaterChildren = (all: FormField[], parentId: string): FormField[] =>
  all.filter((f) => f.parent_field_id === parentId).sort((a, b) => a.sort_order - b.sort_order);

/** All top-level (non-child) fields of a form. */
export const topLevelFields = (all: FormField[]): FormField[] =>
  all.filter((f) => f.parent_field_id == null);
