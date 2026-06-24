import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const PROJECT_DETAIL_ORDERS_SELECT = `
  *,
  samples(sample_number, sample_name),
  order_measurements(
    *,
    measurement_services(service_name, category, hourly_rate, standard_duration_hours),
    work_logs(*),
    measurement_results(*)
  )
`;

export const projects = {
  /** List all projects (newest first). */
  list: () =>
    unwrap(dbClient.from("projects").select("*").order("created_at", { ascending: false })),

  /** Single project by id. */
  get: (id: string) =>
    unwrap(dbClient.from("projects").select("*").eq("id", id).single()),

  /** Create a project and auto-assign creator as owner. */
  async create(project: {
    project_number: string;
    project_name?: string;
    description?: string;
    created_by: string;
  }) {
    const data = await unwrap(
      dbClient.from("projects").insert(project).select().single()
    );
    await run(
      dbClient.from("project_members").insert({
        project_id: data.id,
        user_id: project.created_by,
        role: "owner",
      } as any)
    );
    return data;
  },

  delete: (id: string) => run(dbClient.from("projects").delete().eq("id", id)),

  /** Orders for a project incl. measurements / services / work logs / results. */
  listOrdersWithDetails: (projectId: string) =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(PROJECT_DETAIL_ORDERS_SELECT)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    ),

  /** Samples that belong to a project (incl. storage location). */
  listSamples: (projectId: string) =>
    unwrap(
      dbClient
        .from("samples")
        .select("*, storage_locations:location_id(id, hall, room, shelf, position)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    ),

  // ---- raw rows used by the project-list aggregation ----
  listSampleIndex: () => unwrap(dbClient.from("samples").select("id, project_id")),
  listOrderIndex: () =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(
          "id, project_id, status, order_measurements(id, status, processing_time_hours, planned_hours, actual_duration_hours, measurement_services(hourly_rate), work_logs(hours))"
        )
    ),
  listConsumableCostIndex: () =>
    unwrap(dbClient.from("project_consumables").select("project_id, total_cost")),
  listKnetungCostIndex: () =>
    unwrap(dbClient.from("project_knetung_materials").select("project_id, total_cost")),
  listTimeEntryIndex: () =>
    unwrap(dbClient.from("project_time_entries").select("project_id, duration_minutes")),
  update: (id: string, updates: Record<string, any>) =>
    run(dbClient.from("projects").update(updates as any).eq("id", id)),
};

// ============================================================
// Project members
// ============================================================
export const projectMembers = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_members")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
    ),

  /** Lightweight index of all project memberships – used in the projects list. */
  listIndex: () =>
    unwrap(
      dbClient
        .from("project_members")
        .select("project_id, user_id, role")
    ),


  /** Is the user owner/leader on at least one project? */
  isAnyLead: (userId: string) =>
    unwrap(
      dbClient
        .from("project_members")
        .select("id")
        .eq("user_id", userId)
        .in("role", ["owner", "leader"])
        .limit(1)
    ).then((rows) => (rows?.length ?? 0) > 0),

  add: (member: { project_id: string; user_id: string; role: string }) =>
    unwrap(dbClient.from("project_members").insert(member as any).select().single()),

  updateRole: (id: string, role: string) =>
    run(dbClient.from("project_members").update({ role } as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("project_members").delete().eq("id", id)),
};

// ============================================================
// Project sample history (aggregate)
// ============================================================
export const projectSampleHistory = {
  listForSampleIds: async (sampleIds: string[]) => {
    if (sampleIds.length === 0) return [];
    return unwrap(
      dbClient
        .from("sample_history")
        .select("*")
        .in("sample_id", sampleIds)
        .order("created_at", { ascending: false })
    );
  },
};
