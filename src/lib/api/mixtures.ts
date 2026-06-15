import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

// Cast helper because new tables are not yet in generated Supabase types.
const db = dbClient as any;

export type MixtureCategory = "mischung" | "loesung";

export const mixtures = {
  list: () =>
    unwrap<any>(
      db
        .from("mixtures")
        .select("*")
        .order("name")
    ),

  get: (id: string) =>
    unwrap<any>(
      db
        .from("mixtures")
        .select("*")
        .eq("id", id)
        .single()
    ),

  create: (
    m: {
      name: string;
      mixture_number?: string | null;
      description?: string | null;
      category?: MixtureCategory;
      unit?: string;
      target_concentration?: string | null;
    },
    createdBy: string
  ) =>
    unwrap<any>(
      db
        .from("mixtures")
        .insert({ ...m, created_by: createdBy })
        .select()
        .single()
    ),

  update: (
    id: string,
    updates: {
      name?: string;
      mixture_number?: string | null;
      description?: string | null;
      category?: MixtureCategory;
      unit?: string;
      target_concentration?: string | null;
      is_active?: boolean;
    }
  ) => run(db.from("mixtures").update(updates).eq("id", id)),

  delete: (id: string) => run(db.from("mixtures").delete().eq("id", id)),
};

export const mixtureRecipes = {
  list: (mixtureId: string) =>
    unwrap<any>(
      db
        .from("mixture_recipe_items")
        .select("*, raw_materials(id, material_name, material_number, unit)")
        .eq("mixture_id", mixtureId)
        .order("position")
    ),

  add: (item: {
    mixture_id: string;
    raw_material_id: string;
    quantity: number;
    unit?: string;
    position?: number;
    notes?: string | null;
  }) => unwrap<any>(db.from("mixture_recipe_items").insert(item).select().single()),

  update: (
    id: string,
    updates: {
      raw_material_id?: string;
      quantity?: number;
      unit?: string;
      position?: number;
      notes?: string | null;
    }
  ) => run(db.from("mixture_recipe_items").update(updates).eq("id", id)),

  delete: (id: string) =>
    run(db.from("mixture_recipe_items").delete().eq("id", id)),
};

export const mixtureBatches = {
  list: (mixtureId?: string) => {
    let q = db
      .from("mixture_batches")
      .select(
        "*, profiles!mixture_batches_produced_by_fkey(first_name, last_name), mixture_batch_consumptions(*, raw_materials(material_name, material_number), raw_material_batches(batch_number))"
      )
      .order("produced_at", { ascending: false });
    if (mixtureId) q = q.eq("mixture_id", mixtureId);
    return unwrap<any>(q);
  },

  produce: (args: {
    mixture_id: string;
    produced_quantity: number;
    unit: string;
    concentration?: string | null;
    notes?: string | null;
    consumptions: Array<{
      raw_material_id: string;
      raw_material_batch_id?: string | null;
      quantity: number;
      unit?: string;
    }>;
  }) =>
    unwrap<any>(
      db.rpc("produce_mixture_batch", {
        _mixture_id: args.mixture_id,
        _produced_quantity: args.produced_quantity,
        _unit: args.unit,
        _concentration: args.concentration ?? null,
        _notes: args.notes ?? null,
        _consumptions: args.consumptions,
      })
    ),

  /** Samples derived from a single mixture batch. */
  listSamples: (mixtureBatchId: string) =>
    unwrap<any>(
      db
        .from("samples")
        .select("id, sample_number, sample_name, status, created_at, created_by")
        .eq("mixture_batch_id", mixtureBatchId)
        .order("created_at", { ascending: false })
    ),
};

export const mixtureTraceability = {
  /** Complete origin of a sample: batch + recipe + consumed raw material batches. */
  forSample: (sampleId: string) =>
    unwrap<any>(db.rpc("get_sample_traceability", { _sample_id: sampleId })),

  /** All samples derived from any batch consuming this raw material. */
  derivedSamples: (rawMaterialId: string, rawMaterialBatchId?: string | null) =>
    unwrap<any>(
      db.rpc("get_raw_material_derived_samples", {
        _raw_material_id: rawMaterialId,
        _raw_material_batch_id: rawMaterialBatchId ?? null,
      })
    ),
};

export const mixtureInventory = {
  list: (mixtureId: string) =>
    unwrap<any>(
      db
        .from("mixture_inventory_movements")
        .select("*, mixture_batches(batch_number)")
        .eq("mixture_id", mixtureId)
        .order("movement_date", { ascending: false })
    ),
};

export function calculateMixtureStock(
  movements: Array<{ movement_type: string; quantity: number }>
) {
  return movements.reduce((sum, m) => {
    return m.movement_type === "eingang"
      ? sum + Number(m.quantity)
      : sum - Number(m.quantity);
  }, 0);
}
