import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type StepRunStatus = "pending" | "in_progress" | "completed" | "skipped" | "blocked";

export interface OrderStepRun {
  id: string;
  order_id: string;
  step_id: string | null;
  step_key: string;
  step_snapshot: Record<string, unknown> | null;
  order_index: number;
  status: StepRunStatus;
  assigned_to: string | null;
  assigned_role: string | null;
  form_response: Record<string, unknown>;
  notes: string | null;
  opened_at: string | null;
  opened_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  time_entry_id: string | null;
  auto_time_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStepPosition {
  id: string;
  step_run_id: string;
  position_ref: string | null;
  sample_id: string | null;
  label: string | null;
  status: "open" | "in_progress" | "completed" | "not_feasible";
  result_value: string | null;
  result_data: Record<string, unknown> | null;
  remarks: string | null;
  not_feasible_reason: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const orderStepRuns = {
  listForOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_step_runs" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("order_index")
    ) as unknown as Promise<OrderStepRun[]>,

  get: (id: string) =>
    unwrap(
      dbClient.from("order_step_runs" as any).select("*").eq("id", id).maybeSingle()
    ) as unknown as Promise<OrderStepRun | null>,

  updateResponse: (id: string, response: Record<string, unknown>) =>
    run(
      dbClient
        .from("order_step_runs" as any)
        .update({ form_response: response } as any)
        .eq("id", id)
    ),
};

export const orderStepPositions = {
  listForRun: (runId: string) =>
    unwrap(
      dbClient
        .from("order_step_positions" as any)
        .select("*")
        .eq("step_run_id", runId)
        .order("created_at")
    ) as unknown as Promise<OrderStepPosition[]>,
};
