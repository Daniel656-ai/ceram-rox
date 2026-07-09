import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import type { OrderType, OrderPriority } from "@/lib/types";

const ORDER_LIST_SELECT =
  "*, projects(project_number, project_name), order_measurements(assigned_to, workstations(responsible_user_id))";

const ORDER_DETAIL_SELECT = `*, projects(project_number, project_name), samples!measurement_orders_sample_id_fkey(id, sample_number, sample_name, description, is_hazardous, location_id, storage_locations(hall, room, shelf, position)), order_measurements(*, measurement_services(service_name, category, hourly_rate, standard_duration_hours), measurement_parameters(*), measurement_results(*), work_logs(*), documents(*), workstations(id, name))`;

export const orders = {
  list: () =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(ORDER_LIST_SELECT)
        .order("ranking", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
    ),

  get: (id: string) =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(ORDER_DETAIL_SELECT)
        .eq("id", id)
        .maybeSingle()
    ),

  create: (order: {
    project_id: string;
    order_type: OrderType;
    created_by: string;
    due_date?: string;
    notes?: string;
    priority?: OrderPriority;
    sample_id?: string;
    order_kind?: "pilot_plant" | "labor" | "combined" | "legacy";
    pp_experiment_number?: string | null;
    pp_v2o5_percent?: number | null;
    pp_experiment_date?: string | null;
    pp_issuer_user_id?: string | null;
    pp_previous_experiments?: string | null;
    pp_experiment_kind?: string | null;
    pp_masse_type?: "DK" | "GK" | "KK" | "MK" | "PK" | null;
    pp_remarks?: string | null;
  }) =>
    unwrap(dbClient.from("measurement_orders").insert(order as any).select().single()),

  update: (
    id: string,
    fields: Partial<{
      order_type: OrderType;
      due_date: string | null;
      notes: string | null;
      priority: OrderPriority;
      order_kind: "pilot_plant" | "labor" | "combined" | "legacy";
      pp_experiment_number: string | null;
      pp_v2o5_percent: number | null;
      pp_experiment_date: string | null;
      pp_issuer_user_id: string | null;
      pp_previous_experiments: string | null;
      pp_experiment_kind: string | null;
      pp_masse_type: "DK" | "GK" | "KK" | "MK" | "PK" | null;
      pp_remarks: string | null;
      workflow_status:
        | "entwurf" | "geplant" | "pp_in_progress" | "pp_completed"
        | "samples_created" | "waiting_analysis" | "analysis_in_progress"
        | "results_complete" | "abgeschlossen";
    }>
  ) =>
    run(
      dbClient
        .from("measurement_orders")
        .update(fields as any)
        .eq("id", id)
    ),

  updateStatus: (id: string, status: string) =>
    run(
      dbClient
        .from("measurement_orders")
        .update({ status: status as any })
        .eq("id", id)
    ),

  updateRanking: (id: string, ranking: number | null) =>
    run(
      dbClient
        .from("measurement_orders")
        .update({ ranking } as any)
        .eq("id", id)
    ),

  delete: (id: string) =>
    run(dbClient.from("measurement_orders").delete().eq("id", id)),

  /** Reduced list used by the ETA calculator. */
  listOpenForETA: () =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(
          "id, sample_id, priority, created_at, status, order_measurements(id, status, processing_time_hours, planned_hours)"
        )
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true })
    ),

  auditLog: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_audit_log")
        .select("*")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: false })
    ),
};
