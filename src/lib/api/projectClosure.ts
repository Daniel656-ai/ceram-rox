import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type ClosureStatus = "draft" | "in_approval" | "approved";

export interface DeliveredResult { title: string; description?: string; status?: "ok" | "partial" | "missing" }
export interface OpenItem { title: string; owner?: string; due_date?: string; notes?: string }

export interface ProjectClosureReport {
  id: string;
  project_id: string;
  status: ClosureStatus;
  original_goals: string | null;
  achieved_goals: string | null;
  missed_goals: string | null;
  deviation_reasons: string | null;
  planned_end_date: string | null;
  actual_end_date: string | null;
  schedule_deviation_days: number | null;
  schedule_root_cause: string | null;
  budget_planned: number | null;
  budget_actual: number | null;
  budget_currency: string | null;
  budget_deviation_explanation: string | null;
  delivered_results: DeliveredResult[];
  quality_assessment: string | null;
  customer_satisfaction: number | null;
  open_items: OpenItem[];
  went_well: string | null;
  went_wrong: string | null;
  risks_occurred: string | null;
  success_factors: string | null;
  recommendations: string | null;
  key_decisions_summary: string | null;
  related_decision_ids: string[];
  key_changes_summary: string | null;
  related_change_request_ids: string[];
  project_leader_id: string | null;
  project_leader_signed_at: string | null;
  sponsor_id: string | null;
  sponsor_name: string | null;
  sponsor_signed_at: string | null;
  approval_date: string | null;
  final_remarks: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const projectClosure = {
  async get(projectId: string): Promise<ProjectClosureReport | null> {
    const { data, error } = await dbClient
      .from("project_closure_reports" as any)
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as ProjectClosureReport) ?? null;
  },

  create: (payload: { project_id: string; created_by: string } & Partial<ProjectClosureReport>) =>
    unwrap(
      dbClient.from("project_closure_reports" as any).insert(payload as any).select().single()
    ) as unknown as Promise<ProjectClosureReport>,

  update: (id: string, updates: Partial<ProjectClosureReport>) =>
    run(dbClient.from("project_closure_reports" as any).update(updates as any).eq("id", id)),

  finalize: async (closureId: string) => {
    const { error } = await dbClient.rpc("finalize_project_closure" as any, {
      _closure_id: closureId,
    });
    if (error) throw error;
  },

  delete: (id: string) =>
    run(dbClient.from("project_closure_reports" as any).delete().eq("id", id)),
};
