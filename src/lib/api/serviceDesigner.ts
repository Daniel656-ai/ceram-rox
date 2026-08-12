import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type ServiceFieldType =
  | "text" | "longtext" | "number" | "decimal" | "percent"
  | "date" | "time" | "datetime" | "boolean"
  | "select" | "multiselect"
  | "file" | "image" | "barcode" | "qrcode"
  | "ref_customer" | "ref_material" | "ref_product" | "ref_machine"
  | "ref_employee" | "ref_location" | "ref_batch" | "ref_serial"
  | "repeater" | "handwriting" | "computed" | "raw_material_recipe";

export interface ServiceDataField {
  id: string;
  service_id: string;
  field_key: string;
  display_name: string;
  description: string | null;
  field_type: ServiceFieldType;
  category: string | null;
  unit: string | null;
  is_required: boolean;
  default_value: string | null;
  validation: Record<string, unknown>;
  min_value: number | null;
  max_value: number | null;
  decimal_places: number | null;
  readonly: boolean;
  archived: boolean;
  select_options: Array<string | { label: string; value: string }>;
  ref_target: string | null;
  parent_field_id: string | null;
  sort_order: number;
  legacy_parameter_id: string | null;
  /** Als offizielles Ergebnis in die Ergebnisdatenbank übernehmen. */
  is_result: boolean;
  /** Optionaler Anzeigename in der Ergebnisdatenbank. */
  result_label: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceDataFields = {
  listForService: (serviceId: string) =>
    unwrap(
      dbClient
        .from("service_data_fields" as any)
        .select("*")
        .eq("service_id", serviceId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    ) as unknown as Promise<ServiceDataField[]>,

  create: (field: Partial<ServiceDataField> & { service_id: string; field_key: string; display_name: string; field_type: ServiceFieldType }) =>
    unwrap(
      dbClient.from("service_data_fields" as any).insert(field as any).select().single()
    ) as unknown as Promise<ServiceDataField>,

  update: (id: string, updates: Partial<ServiceDataField>) =>
    run(dbClient.from("service_data_fields" as any).update(updates as any).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("service_data_fields" as any).delete().eq("id", id)),


  reorder: async (orders: Array<{ id: string; sort_order: number }>) => {
    for (const o of orders) {
      await run(dbClient.from("service_data_fields" as any).update({ sort_order: o.sort_order } as any).eq("id", o.id));
    }
  },
};
