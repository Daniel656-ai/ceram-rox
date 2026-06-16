import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const db = dbClient as any;

export interface RecipeVersion {
  id: string;
  mixture_id: string;
  version_no: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const recipeVersions = {
  list: (mixtureId: string) =>
    unwrap<RecipeVersion[]>(
      db.from("mixture_recipe_versions").select("*").eq("mixture_id", mixtureId).order("version_no", { ascending: false })
    ),
  active: (mixtureId: string) =>
    unwrap<RecipeVersion>(
      db.from("mixture_recipe_versions").select("*").eq("mixture_id", mixtureId).eq("is_active", true).maybeSingle()
    ),
  create: (mixtureId: string, copyFrom?: string | null, notes?: string | null) =>
    unwrap<string>(
      db.rpc("create_mixture_recipe_version", {
        _mixture_id: mixtureId,
        _copy_from: copyFrom ?? null,
        _notes: notes ?? null,
      })
    ),
  activate: (versionId: string) =>
    run(db.rpc("activate_mixture_recipe_version", { _version_id: versionId })),
  availability: (versionId: string, scale = 1) =>
    unwrap<any[]>(db.rpc("mixture_recipe_availability", { _version_id: versionId, _scale: scale })),
};

export const processSections = {
  list: (versionId: string) =>
    unwrap<any[]>(
      db
        .from("mixture_process_sections")
        .select("*, mixture_process_steps(*, raw_materials(material_name, material_number, unit)), mixture_planned_measurements(*)")
        .eq("recipe_version_id", versionId)
        .order("sort_order")
    ),
  create: (s: {
    recipe_version_id: string;
    name: string;
    description?: string | null;
    sort_order?: number;
    planned_duration_min?: number | null;
    target_temperature?: number | null;
    target_unit?: string | null;
    remarks?: string | null;
  }) => unwrap<any>(db.from("mixture_process_sections").insert(s).select().single()),
  update: (id: string, updates: Partial<any>) =>
    run(db.from("mixture_process_sections").update(updates).eq("id", id)),
  delete: (id: string) => run(db.from("mixture_process_sections").delete().eq("id", id)),
};

export const processSteps = {
  create: (s: {
    section_id: string;
    raw_material_id?: string | null;
    instruction?: string | null;
    planned_quantity?: number | null;
    unit?: string | null;
    offset_minutes?: number | null;
    window_minutes?: number | null;
    sort_order?: number;
  }) => unwrap<any>(db.from("mixture_process_steps").insert(s).select().single()),
  update: (id: string, updates: Partial<any>) =>
    run(db.from("mixture_process_steps").update(updates).eq("id", id)),
  delete: (id: string) => run(db.from("mixture_process_steps").delete().eq("id", id)),
};

export const plannedMeasurements = {
  create: (m: {
    section_id: string;
    parameter_name: string;
    unit?: string | null;
    target_value?: number | null;
    tolerance?: number | null;
    offset_minutes?: number | null;
    sort_order?: number;
  }) => unwrap<any>(db.from("mixture_planned_measurements").insert(m).select().single()),
  update: (id: string, updates: Partial<any>) =>
    run(db.from("mixture_planned_measurements").update(updates).eq("id", id)),
  delete: (id: string) => run(db.from("mixture_planned_measurements").delete().eq("id", id)),
};
