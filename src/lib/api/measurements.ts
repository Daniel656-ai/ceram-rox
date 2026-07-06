import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const MY_MEASUREMENT_SELECT = `*, measurement_services(service_name, category, hourly_rate, standard_duration_hours), workstations(id, name, responsible_user_id), measurement_orders(*, projects(project_number, project_name))`;

export const measurements = {
  /** Compact projection for ServiceStatistics widget, filtered by created_at range. */
  listForServiceStats: (fromIso: string, toIso: string) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .select("service_id, status, actual_duration_hours, planned_hours, updated_at, created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
    ),

  /** Measurements assigned to a user. */
  listAssignedTo: (userId: string) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .select(MY_MEASUREMENT_SELECT)
        .eq("assigned_to", userId)
    ),

  /** Measurements on workstations the user is responsible for. */
  async listForUserResponsibleWorkstations(userId: string) {
    const stations = await unwrap(
      dbClient.from("workstations").select("id").eq("responsible_user_id", userId)
    );
    const ids = (stations || []).map((s: any) => s.id);
    if (ids.length === 0) return [];
    return unwrap(
      dbClient
        .from("order_measurements")
        .select(MY_MEASUREMENT_SELECT)
        .in("workstation_id", ids)
    );
  },

  /** Lookup profiles by user_id for "creator" display. */
  fetchProfiles: (userIds: string[]) =>
    userIds.length === 0
      ? Promise.resolve([] as any[])
      : unwrap(
          dbClient
            .from("profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", userIds)
        ),

  /** All measurements assigned to a workstation. */
  listForWorkstation: (workstationId: string) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .select(
          "*, measurement_services(service_name, category), measurement_orders(*, projects(project_number, project_name))"
        )
        .eq("workstation_id", workstationId)
        .order("due_date")
    ),

  // ---- writes ----
  add: (m: {
    order_id: string;
    service_id: string;
    planned_hours?: number;
    due_date?: string;
    workstation_id?: string;
  }) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .insert({ ...m, measurement_number: "WILL_BE_OVERWRITTEN" } as any)
        .select()
        .single()
    ),

  /** Full detail for a single measurement (used by task execution view). */
  get: (id: string) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .select(
          "*, measurement_services(id, service_name, category, hourly_rate, standard_duration_hours), workstations(id, name), measurement_results(*), measurement_orders(id, order_number, order_type, notes, created_by, project_id, sample_id, projects(id, project_number, project_name), samples(id, sample_number, sample_name))"
        )
        .eq("id", id)
        .single()
    ),



  updateStatus: (id: string, status: string) =>
    run(
      dbClient
        .from("order_measurements")
        .update({ status: status as any })
        .eq("id", id)
    ),

  updateRanking: (id: string, ranking: number | null) =>
    run(
      dbClient
        .from("order_measurements")
        .update({ ranking } as any)
        .eq("id", id)
    ),

  assign: (id: string, assignedTo: string | null) =>
    run(
      dbClient
        .from("order_measurements")
        .update({ assigned_to: assignedTo })
        .eq("id", id)
    ),

  /** Generic update for a measurement by id. */
  update: (id: string, updates: Record<string, any>) =>
    run(dbClient.from("order_measurements").update(updates as any).eq("id", id)),

  /** Complete a measurement with actual duration and optional deviation reason. */
  complete: (id: string, actualDurationHours: number, deviationReason?: string) => {
    const payload: Record<string, any> = {
      actual_duration_hours: actualDurationHours,
      status: "completed",
    };
    if (deviationReason && deviationReason.trim()) {
      payload.duration_deviation_reason = deviationReason.trim();
    }
    return run(dbClient.from("order_measurements").update(payload as any).eq("id", id));
  },
};

export const workLogs = {
  add: (log: {
    order_measurement_id: string;
    user_id: string;
    work_date: string;
    hours: number;
    comment?: string;
  }) => unwrap(dbClient.from("work_logs").insert(log).select().single()),
};
