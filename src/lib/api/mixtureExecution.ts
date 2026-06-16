import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const db = dbClient as any;

export const mixtureExecution = {
  // Batch lifecycle
  start: (batchId: string) => run(db.rpc("start_mixture_batch", { _batch_id: batchId })),
  complete: (batchId: string, producedQuantity?: number | null) =>
    run(db.rpc("complete_mixture_batch", { _batch_id: batchId, _produced_quantity: producedQuantity ?? null })),
  release: (batchId: string) => run(db.rpc("release_mixture_batch", { _batch_id: batchId })),

  getBatch: (batchId: string) =>
    unwrap<any>(
      db
        .from("mixture_batches")
        .select(
          "*, mixtures(id, name, mixture_number, unit), profiles!mixture_batches_produced_by_fkey(first_name, last_name)"
        )
        .eq("id", batchId)
        .single()
    ),

  createBatch: (b: {
    mixture_id: string;
    recipe_version_id: string;
    produced_quantity: number;
    unit: string;
    concentration?: string | null;
    notes?: string | null;
  }) =>
    unwrap<any>(
      db.from("mixture_batches").insert({ ...b, execution_status: "geplant", produced_by: undefined }).select().single()
    ),

  // Weighings
  listWeighings: (batchId: string) =>
    unwrap<any[]>(
      db
        .from("mixture_batch_weighings")
        .select("*, raw_materials(material_name, material_number), raw_material_batches(batch_number), profiles!mixture_batch_weighings_weighed_by_fkey(first_name, last_name)")
        .eq("batch_id", batchId)
        .order("weighed_at")
    ),
  recordWeighing: (args: {
    batch_id: string;
    step_id?: string | null;
    raw_material_id: string;
    raw_material_batch_id?: string | null;
    target_quantity?: number | null;
    actual_quantity: number;
    unit?: string;
    notes?: string | null;
  }) =>
    unwrap<string>(
      db.rpc("record_mixture_weighing", {
        _batch_id: args.batch_id,
        _step_id: args.step_id ?? null,
        _raw_material_id: args.raw_material_id,
        _raw_material_batch_id: args.raw_material_batch_id ?? null,
        _target_quantity: args.target_quantity ?? null,
        _actual_quantity: args.actual_quantity,
        _unit: args.unit ?? "kg",
        _notes: args.notes ?? null,
      })
    ),

  // Measurements
  listMeasurements: (batchId: string) =>
    unwrap<any[]>(
      db
        .from("mixture_batch_measurements")
        .select("*, profiles!mixture_batch_measurements_measured_by_fkey(first_name, last_name)")
        .eq("batch_id", batchId)
        .order("measured_at")
    ),
  recordMeasurement: (m: {
    batch_id: string;
    section_id?: string | null;
    planned_measurement_id?: string | null;
    parameter_name: string;
    unit?: string | null;
    target_value?: number | null;
    actual_value: number;
    comment?: string | null;
    measured_by?: string;
  }) => unwrap<any>(db.from("mixture_batch_measurements").insert(m).select().single()),

  // Deviations
  listDeviations: (batchId: string) =>
    unwrap<any[]>(
      db
        .from("mixture_batch_deviations")
        .select("*, profiles!mixture_batch_deviations_created_by_fkey(first_name, last_name)")
        .eq("batch_id", batchId)
        .order("created_at")
    ),
  recordDeviation: (d: {
    batch_id: string;
    section_id?: string | null;
    kind: "time" | "quantity" | "additional_raw" | "process";
    old_value?: string | null;
    new_value?: string | null;
    reason: string;
    created_by?: string;
  }) => unwrap<any>(db.from("mixture_batch_deviations").insert(d).select().single()),
};
