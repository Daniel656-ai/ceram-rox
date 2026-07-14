import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type PilotPlantBlockKey =
  | "stammdaten" | "rezeptur" | "knetung" | "extrusion" | "trocknung"
  | "brennen" | "probenentnahme" | "uebergabe" | "abschluss";

export type PilotPlantBlockStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface PilotPlantBlock {
  id: string;
  order_id: string;
  block_key: PilotPlantBlockKey;
  order_index: number;
  status: PilotPlantBlockStatus;
  assigned_role: string | null;
  assigned_to: string | null;
  data: Record<string, any>;
  notes: string | null;
  started_at: string | null;
  started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PilotPlantProducedSample {
  id: string;
  order_id: string;
  block_id: string | null;
  label: string;
  quantity: number;
  marking: string | null;
  notes: string | null;
  created_sample_id: string | null;
  created_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export const PILOT_PLANT_BLOCK_LABELS: Record<PilotPlantBlockKey, string> = {
  stammdaten: "Stammdaten",
  rezeptur: "Rezeptur / Rohstoffe",
  knetung: "Knetung",
  extrusion: "Extrusion",
  trocknung: "Trocknung",
  brennen: "Brennen",
  probenentnahme: "Probenentnahme",
  uebergabe: "Übergabe an das Labor",
  abschluss: "Abschluss",
};

export const pilotPlantBlocks = {
  listForOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from("pilot_plant_blocks" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("order_index", { ascending: true })
    ) as unknown as Promise<PilotPlantBlock[]>,

  update: (id: string, updates: Partial<PilotPlantBlock>) =>
    run(dbClient.from("pilot_plant_blocks" as any).update(updates as any).eq("id", id)),

  saveDraft: (id: string, data: Record<string, any>, notes?: string | null) =>
    run(
      dbClient
        .from("pilot_plant_blocks" as any)
        .update({ data, notes: notes ?? null } as any)
        .eq("id", id)
    ),

  assign: (id: string, patch: { assigned_to?: string | null; assigned_role?: string | null }) =>
    run(dbClient.from("pilot_plant_blocks" as any).update(patch as any).eq("id", id)),

  start: (id: string) =>
    run(dbClient.rpc("pp_start_block" as any, { _block_id: id } as any)),

  complete: (id: string, data: Record<string, any>, notes?: string | null) =>
    run(
      dbClient.rpc("pp_complete_block" as any, {
        _block_id: id,
        _data: data,
        _notes: notes ?? null,
      } as any)
    ),

  seed: (orderId: string) =>
    run(dbClient.rpc("pp_seed_blocks" as any, { _order_id: orderId } as any)),
};

export const pilotPlantProducedSamples = {
  listForOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from("pilot_plant_produced_samples" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    ) as unknown as Promise<PilotPlantProducedSample[]>,

  create: (row: Partial<PilotPlantProducedSample> & { order_id: string; label: string }) =>
    unwrap(
      dbClient.from("pilot_plant_produced_samples" as any).insert(row as any).select().single()
    ) as unknown as Promise<PilotPlantProducedSample>,

  update: (id: string, updates: Partial<PilotPlantProducedSample>) =>
    run(dbClient.from("pilot_plant_produced_samples" as any).update(updates as any).eq("id", id)),

  remove: (id: string) =>
    run(dbClient.from("pilot_plant_produced_samples" as any).delete().eq("id", id)),
};
