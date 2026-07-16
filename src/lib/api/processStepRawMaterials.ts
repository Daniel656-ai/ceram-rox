import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface ProcessStepRawMaterial {
  id: string;
  step_id: string;
  raw_material_id: string;
  target_quantity: number;
  unit: string | null;
  tolerance_percent: number | null;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  raw_materials?: {
    id: string;
    material_name: string;
    material_number: string | null;
    unit: string | null;
  };
}

export interface RawMaterialAvailabilityRow {
  psrm_id: string;
  raw_material_id: string;
  material_name: string;
  material_number: string | null;
  required: number;
  available: number;
  missing: number;
  unit: string | null;
}

export const processStepRawMaterials = {
  listForStep: (stepId: string) =>
    unwrap(
      dbClient
        .from("process_step_raw_materials" as any)
        .select(
          "*, raw_materials(id, material_name, material_number, unit)"
        )
        .eq("step_id", stepId)
        .order("sort_order")
    ) as unknown as Promise<ProcessStepRawMaterial[]>,

  create: (input: {
    step_id: string;
    raw_material_id: string;
    target_quantity: number;
    unit?: string | null;
    tolerance_percent?: number | null;
    note?: string | null;
    sort_order?: number;
  }) =>
    unwrap(
      dbClient
        .from("process_step_raw_materials" as any)
        .insert(input as any)
        .select()
        .single()
    ) as unknown as Promise<ProcessStepRawMaterial>,

  update: (
    id: string,
    updates: Partial<Pick<ProcessStepRawMaterial, "target_quantity" | "unit" | "tolerance_percent" | "note" | "sort_order">>
  ) => run(dbClient.from("process_step_raw_materials" as any).update(updates as any).eq("id", id)),

  remove: (id: string) =>
    run(dbClient.from("process_step_raw_materials" as any).delete().eq("id", id)),

  availability: (stepId: string, scale: number = 1) =>
    unwrap(
      (dbClient as any).rpc("process_step_raw_material_availability", {
        _step_id: stepId,
        _scale: scale,
      })
    ) as unknown as Promise<RawMaterialAvailabilityRow[]>,
};
