import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const db = dbClient as any;

export type BatchKind = "raw" | "mixture";

export interface UnifiedBatch {
  id: string;
  batch_kind: BatchKind;
  batch_number: string;
  product_name: string;
  recipe_id: string | null;
  recipe_name: string | null;
  produced_at: string | null;
  produced_by: string | null;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null;
  status: string;
  source_id: string;
  notes: string | null;
  created_at: string;
}

export const batches = {
  /** Unified list of raw-material and mixture batches. */
  list: (kind: BatchKind | "all" = "all") => {
    let q = db
      .from("unified_batches")
      .select("*")
      .order("created_at", { ascending: false });
    if (kind !== "all") q = q.eq("batch_kind", kind);
    return unwrap<UnifiedBatch[]>(q);
  },

  /** Samples linked to a given mixture batch. */
  samplesForMixtureBatch: (mixtureBatchId: string) =>
    unwrap<any>(
      db
        .from("samples")
        .select("id, sample_number, sample_name, status, created_at")
        .eq("mixture_batch_id", mixtureBatchId)
        .order("created_at", { ascending: false })
    ),

  /** Samples not yet linked to any mixture batch (for retro-linking). */
  unlinkedSamples: () =>
    unwrap<any>(
      db
        .from("samples")
        .select("id, sample_number, sample_name, project_id")
        .is("mixture_batch_id", null)
        .order("created_at", { ascending: false })
        .limit(500)
    ),

  /** Link an existing sample to a mixture batch (retro-traceability). */
  linkSampleToMixtureBatch: (sampleId: string, mixtureBatchId: string) =>
    run(
      db
        .from("samples")
        .update({ mixture_batch_id: mixtureBatchId })
        .eq("id", sampleId)
    ),

  /** Update batch status (active / blocked). */
  setMixtureBatchStatus: (id: string, status: "produced" | "discarded") =>
    run(db.from("mixture_batches").update({ status }).eq("id", id)),

  /** Update expiry date. */
  setMixtureBatchExpiry: (id: string, expiry_date: string | null) =>
    run(db.from("mixture_batches").update({ expiry_date }).eq("id", id)),
};
