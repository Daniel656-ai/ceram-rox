import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const projectConsumables = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_consumables")
        .select("*, consumables(name, unit)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    ),

  add: (c: {
    project_id: string;
    consumable_id: string;
    quantity: number;
    unit_price: number;
    comment?: string;
    created_by: string;
  }) =>
    unwrap(
      dbClient.from("project_consumables").insert(c).select().single()
    ),

  remove: (id: string) =>
    run(dbClient.from("project_consumables").delete().eq("id", id)),
};

export const projectKnetungMaterials = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_knetung_materials")
        .select("*, raw_materials(material_name, unit)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    ),

  add: (m: {
    project_id: string;
    raw_material_id: string;
    order_measurement_id?: string;
    quantity_kg: number;
    price_per_kg: number;
    comment?: string;
    created_by: string;
  }) =>
    unwrap(
      dbClient
        .from("project_knetung_materials")
        .insert(m)
        .select()
        .single()
    ),

  remove: (id: string) =>
    run(dbClient.from("project_knetung_materials").delete().eq("id", id)),
};
