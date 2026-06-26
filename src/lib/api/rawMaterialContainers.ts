import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const db = dbClient as any;

export type ContainerKind = "fass" | "kanister" | "sack" | "big_bag" | "ibc" | "tank" | "flasche" | "kiste" | "sonstige";
export type ContainerStatus = "verfuegbar" | "reserviert" | "in_verwendung" | "leer" | "gesperrt" | "entsorgt";

export interface RawMaterialContainer {
  id: string;
  raw_material_id: string;
  batch_id: string | null;
  container_code: string;
  barcode: string | null;
  kind: ContainerKind;
  initial_quantity: number;
  current_quantity: number;
  reserved_quantity: number;
  unit: string;
  status: ContainerStatus;
  location_id: string | null;
  location_note: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const rawMaterialContainers = {
  list: (rawMaterialId?: string) => {
    let q = db
      .from("raw_material_containers")
      .select("*, storage_locations(*), raw_material_batches(batch_number)")
      .order("created_at", { ascending: false });
    if (rawMaterialId) q = q.eq("raw_material_id", rawMaterialId);
    return unwrap<any[]>(q);
  },

  get: (id: string) =>
    unwrap<any>(
      db
        .from("raw_material_containers")
        .select("*, storage_locations(*), raw_material_batches(batch_number)")
        .eq("id", id)
        .single()
    ),

  getByBarcode: (barcode: string) =>
    unwrap<any>(
      db
        .from("raw_material_containers")
        .select("*, storage_locations(*), raw_material_batches(batch_number, raw_material_id), raw_materials(material_name, unit)")
        .or(`barcode.eq.${barcode},container_code.eq.${barcode}`)
        .maybeSingle()
    ),

  create: (
    c: {
      raw_material_id: string;
      batch_id?: string | null;
      container_code?: string | null;
      barcode?: string | null;
      kind?: ContainerKind;
      initial_quantity?: number;
      current_quantity?: number;
      unit?: string;
      status?: ContainerStatus;
      location_id?: string | null;
      location_note?: string | null;
      notes?: string | null;
    },
    createdBy: string
  ) =>
    unwrap<any>(
      db
        .from("raw_material_containers")
        .insert({ ...c, created_by: createdBy })
        .select()
        .single()
    ),

  update: (
    id: string,
    updates: Partial<{
      container_code: string;
      barcode: string | null;
      kind: ContainerKind;
      initial_quantity: number;
      current_quantity: number;
      reserved_quantity: number;
      unit: string;
      status: ContainerStatus;
      location_id: string | null;
      location_note: string | null;
      notes: string | null;
    }>
  ) => run(db.from("raw_material_containers").update(updates).eq("id", id)),

  delete: (id: string) =>
    run(db.from("raw_material_containers").delete().eq("id", id)),
};
