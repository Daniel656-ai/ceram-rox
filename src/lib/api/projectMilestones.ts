import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const projectMilestones = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("milestone_date", { ascending: true, nullsFirst: false })
    ),

  listByWorkPackage: (workPackageId: string) =>
    unwrap(
      dbClient
        .from("project_milestones")
        .select("*")
        .eq("work_package_id", workPackageId)
        .order("milestone_date", { ascending: true, nullsFirst: false })
    ),

  create: (milestone: {
    project_id: string;
    title: string;
    description?: string;
    milestone_date?: string;
    status?: string;
    created_by: string;
    work_package_id?: string | null;
  }) =>
    unwrap(
      dbClient
        .from("project_milestones")
        .insert(milestone as any)
        .select()
        .single()
    ),

  update: (
    id: string,
    updates: {
      title?: string;
      description?: string;
      milestone_date?: string | null;
      status?: string;
      work_package_id?: string | null;
    }
  ) =>
    run(
      dbClient
        .from("project_milestones")
        .update(updates as any)
        .eq("id", id)
    ),

  delete: (id: string) =>
    run(dbClient.from("project_milestones").delete().eq("id", id)),
};
