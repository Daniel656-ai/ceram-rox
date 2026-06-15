import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const storageLocations = {
  list: () =>
    unwrap(
      dbClient
        .from("storage_locations")
        .select("*")
        .order("name")
    ),

  add: (loc: { name: string; description?: string; hall?: string; room?: string; shelf?: string; position?: string }) =>
    unwrap(dbClient.from("storage_locations").insert(loc as any).select().single()),

  update: (
    id: string,
    updates: { name?: string; description?: string; hall?: string | null; room?: string | null; shelf?: string | null; position?: string | null }
  ) => run(dbClient.from("storage_locations").update(updates as any).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("storage_locations").delete().eq("id", id)),
};


export const rawMaterials = {
  list: () =>
    unwrap(
      dbClient
        .from("raw_materials")
        .select("*, storage_locations(*)")
        .order("material_name")
    ),

  get: (id: string) =>
    unwrap(
      dbClient
        .from("raw_materials")
        .select(
          "*, storage_locations(*), raw_material_batches(*), raw_material_documents(*), raw_material_analyses(*)"
        )
        .eq("id", id)
        .single()
    ),

  create: (
    m: {
      material_name: string;
      material_number: string;
      supplier?: string;
      description?: string;
      unit?: string;
      default_location_id?: string;
      is_hazardous?: boolean;
      hazard_categories?: string[];
    },
    createdBy: string
  ) =>
    unwrap(
      dbClient
        .from("raw_materials")
        .insert({ ...m, created_by: createdBy } as any)
        .select()
        .single()
    ),

  update: (
    id: string,
    updates: {
      material_name?: string;
      supplier?: string;
      description?: string;
      unit?: string;
      default_location_id?: string | null;
      price_per_kg?: number;
      is_hazardous?: boolean;
      hazard_categories?: string[];
    }
  ) => run(dbClient.from("raw_materials").update(updates as any).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("raw_materials").delete().eq("id", id)),
};

export const rawMaterialBatches = {
  add: (b: {
    raw_material_id: string;
    batch_number: string;
    delivery_date?: string;
    delivery_quantity?: number;
    supplier?: string;
    notes?: string;
  }) =>
    unwrap(dbClient.from("raw_material_batches").insert(b).select().single()),

  delete: (id: string) =>
    run(dbClient.from("raw_material_batches").delete().eq("id", id)),
};

export const rawMaterialAnalyses = {
  add: (a: {
    raw_material_id: string;
    batch_id?: string;
    analysis_type?: string;
    parameter_name: string;
    value?: number;
    text_value?: string;
    unit?: string;
    min_limit?: number;
    max_limit?: number;
    remarks?: string;
  }) =>
    unwrap(dbClient.from("raw_material_analyses").insert(a).select().single()),

  delete: (id: string) =>
    run(dbClient.from("raw_material_analyses").delete().eq("id", id)),
};

export const inventoryMovements = {
  list: (materialId?: string) => {
    let q = dbClient
      .from("inventory_movements")
      .select("*, raw_material_batches(batch_number)")
      .order("movement_date", { ascending: false });
    if (materialId) q = q.eq("raw_material_id", materialId);
    return unwrap(q);
  },

  add: (
    m: {
      raw_material_id: string;
      batch_id?: string;
      movement_type: string;
      quantity: number;
      movement_date?: string;
      supplier?: string;
      project_reference?: string;
      comment?: string;
    },
    createdBy: string
  ) =>
    unwrap(
      dbClient
        .from("inventory_movements")
        .insert({ ...m, created_by: createdBy })
        .select()
        .single()
    ),
};

export const rawMaterialDocuments = {
  /** Upload to storage + record DB row. */
  async upload(args: {
    file: File;
    raw_material_id: string;
    batch_id?: string;
    document_type: string;
    uploaded_by: string;
  }) {
    const path = `${args.uploaded_by}/${args.raw_material_id}/${Date.now()}_${args.file.name}`;
    const { error: uploadErr } = await dbClient.storage
      .from("raw-material-documents")
      .upload(path, args.file);
    if (uploadErr) throw uploadErr;
    await run(
      dbClient.from("raw_material_documents").insert({
        raw_material_id: args.raw_material_id,
        batch_id: args.batch_id || null,
        document_type: args.document_type,
        file_name: args.file.name,
        file_type: args.file.type,
        storage_path: path,
        uploaded_by: args.uploaded_by,
      })
    );
  },
};
