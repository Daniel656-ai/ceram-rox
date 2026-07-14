import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type FormFieldType =
  | "text" | "longtext" | "number" | "decimal" | "percent"
  | "date" | "time" | "datetime" | "boolean"
  | "select" | "multiselect"
  | "file" | "image" | "barcode" | "qrcode"
  | "ref_customer" | "ref_material" | "ref_product" | "ref_machine"
  | "ref_employee" | "ref_location" | "ref_batch" | "ref_serial"
  | "repeater" | "handwriting" | "computed";

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
