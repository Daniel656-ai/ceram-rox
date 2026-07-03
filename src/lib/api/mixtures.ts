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
      is_template?: boolean;
      template_kind?: string | null;
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
      is_template?: boolean;
      template_kind?: string | null;
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

  /** Phase 1 Verwiegen: create batch in status 'geplant' with weighing snapshots (no inventory). */
  weigh: (args: {
    mixture_id: string;
    unit: string;
    concentration?: string | null;
    notes?: string | null;
    planned_quantity?: number | null;
    weighings: Array<{
      raw_material_id: string;
      raw_material_batch_id?: string | null;
      container_id?: string | null;
      target_quantity?: number | null;
      actual_quantity?: number | null;
      gross_weight?: number | null;
      unit?: string;
      notes?: string | null;
      confirmed?: boolean;
    }>;
  }) =>
    unwrap<string>(
      db.rpc("weigh_mixture_batch", {
        _mixture_id: args.mixture_id,
        _unit: args.unit,
        _concentration: args.concentration ?? null,
        _notes: args.notes ?? null,
        _planned_quantity: args.planned_quantity ?? null,
        _weighings: args.weighings,
      })
    ),

  /** Finalize a weighed batch: books all inventory (FIFO per container) and eingang of the mixture. */
  finalize: (args: { batch_id: string; produced_quantity: number }) =>
    unwrap<any>(
      db.rpc("finalize_mixture_batch", {
        _batch_id: args.batch_id,
        _produced_quantity: args.produced_quantity,
      })
    ),

  /** Weighings recorded for a batch (with container/lot snapshots). */
  weighings: (batchId: string) =>
    unwrap<any[]>(
      db
        .from("mixture_batch_weighings")
        .select("*, raw_materials(material_name, material_number, unit)")
        .eq("batch_id", batchId)
        .order("created_at")
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

  /** Phase 2: correct a single weighing (delta re-books inventory if batch already finalized). */
  correctWeighing: (args: {
    weighing_id: string;
    new_actual_quantity: number;
    new_container_id?: string | null;
    new_notes?: string | null;
    reason: string;
  }) =>
    unwrap<any>(
      db.rpc("correct_mixture_weighing", {
        _weighing_id: args.weighing_id,
        _new_actual_quantity: args.new_actual_quantity,
        _new_container_id: args.new_container_id ?? null,
        _new_notes: args.new_notes ?? null,
        _reason: args.reason,
      })
    ),

  /** Phase 2: correct produced quantity of a batch (delta book on mixture inventory). */
  correctProducedQuantity: (args: { batch_id: string; new_produced_quantity: number; reason: string }) =>
    unwrap<any>(
      db.rpc("correct_mixture_batch_quantity", {
        _batch_id: args.batch_id,
        _new_produced_quantity: args.new_produced_quantity,
        _reason: args.reason,
      })
    ),

  /** Phase 2: full correction history for a batch. */
  corrections: (batchId: string) =>
    unwrap<any[]>(
      db
        .from("mixture_batch_corrections")
        .select("*, profiles!mixture_batch_corrections_created_by_fkey(first_name, last_name)")
        .eq("batch_id", batchId)
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
