import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

// ============================================================
// Change Requests
// ============================================================
export const projectChangeRequests = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_change_requests" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    ),

  create: (cr: {
    project_id: string;
    title: string;
    description?: string;
    requested_by: string;
    impact_budget?: number | null;
    impact_schedule_days?: number | null;
    impact_description?: string;
    related_milestone_id?: string | null;
  }) =>
    unwrap(
      dbClient
        .from("project_change_requests" as any)
        .insert(cr as any)
        .select()
        .single()
    ),

  update: (id: string, updates: Record<string, any>) =>
    run(dbClient.from("project_change_requests" as any).update(updates as any).eq("id", id)),

  decide: (id: string, status: "approved" | "rejected" | "withdrawn", approverId: string) =>
    run(
      dbClient
        .from("project_change_requests" as any)
        .update({
          approval_status: status,
          approver_id: approverId,
          approval_date: new Date().toISOString(),
        } as any)
        .eq("id", id)
    ),

  delete: (id: string) =>
    run(dbClient.from("project_change_requests" as any).delete().eq("id", id)),
};

// ============================================================
// Decisions
// ============================================================
export const projectDecisions = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_decisions" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("decision_date", { ascending: false })
    ),

  create: (d: {
    project_id: string;
    title: string;
    decision_date?: string;
    rationale?: string;
    decided_by?: string | null;
    affected_areas?: string[];
    related_milestone_id?: string | null;
    created_by: string;
  }) =>
    unwrap(
      dbClient.from("project_decisions" as any).insert(d as any).select().single()
    ),

  update: (id: string, updates: Record<string, any>) =>
    run(dbClient.from("project_decisions" as any).update(updates as any).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("project_decisions" as any).delete().eq("id", id)),
};

// ============================================================
// Stakeholders
// ============================================================
export const projectStakeholders = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_stakeholders" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("name", { ascending: true })
    ),

  create: (s: {
    project_id: string;
    name: string;
    organization?: string;
    role?: string;
    contact_email?: string;
    contact_phone?: string;
    channel?: string;
    frequency?: string;
    responsible_user_id?: string | null;
    notes?: string;
    created_by: string;
  }) =>
    unwrap(
      dbClient.from("project_stakeholders" as any).insert(s as any).select().single()
    ),

  update: (id: string, updates: Record<string, any>) =>
    run(dbClient.from("project_stakeholders" as any).update(updates as any).eq("id", id)),

  touchContact: (id: string) =>
    run(
      dbClient
        .from("project_stakeholders" as any)
        .update({ last_contact_at: new Date().toISOString() } as any)
        .eq("id", id)
    ),

  delete: (id: string) =>
    run(dbClient.from("project_stakeholders" as any).delete().eq("id", id)),
};

// ============================================================
// Lessons Learned
// ============================================================
export const projectLessonsLearned = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_lessons_learned" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
    ),

  create: (l: {
    project_id: string;
    went_well?: string;
    went_wrong?: string;
    recommendations?: string;
    overall_rating?: number | null;
    follow_up_actions?: string;
    related_weekly_review_ids?: string[];
    created_by: string;
  }) =>
    unwrap(
      dbClient.from("project_lessons_learned" as any).insert(l as any).select().single()
    ),

  update: (id: string, updates: Record<string, any>) =>
    run(dbClient.from("project_lessons_learned" as any).update(updates as any).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("project_lessons_learned" as any).delete().eq("id", id)),
};
