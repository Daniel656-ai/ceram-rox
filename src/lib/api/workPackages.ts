import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface WorkPackage {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "planned" | "in_progress" | "completed";
  category_id: string;
  is_mandatory: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees: string[];
}

export const workPackages = {
  async listByProject(projectId: string): Promise<WorkPackage[]> {
    const wps = await unwrap(
      dbClient
        .from("project_work_packages")
        .select("*")
        .eq("project_id", projectId)
        .order("is_mandatory", { ascending: false })
        .order("start_date", { ascending: true, nullsFirst: false })
    );
    const ids = ((wps as any[]) || []).map((w: any) => w.id);
    let map = new Map<string, string[]>();
    if (ids.length > 0) {
      const assignees = await unwrap(
        dbClient
          .from("project_work_package_assignees")
          .select("work_package_id, user_id")
          .in("work_package_id", ids)
      );
      for (const a of (assignees as any[]) || []) {
        const arr = map.get(a.work_package_id) || [];
        arr.push(a.user_id);
        map.set(a.work_package_id, arr);
      }
    }
    return ((wps as any[]) || []).map((w: any) => ({ ...w, assignees: map.get(w.id) || [] }));
  },

  async create(params: {
    project_id: string;
    title: string;
    category_id: string;
    description?: string;
    start_date?: string | null;
    end_date?: string | null;
    milestone_id?: string | null;
    status?: string;
    assignee_ids?: string[];
    created_by: string;
  }) {
    const { assignee_ids, ...wp } = params;
    const created = await unwrap(
      dbClient.from("project_work_packages").insert(wp as any).select().single()
    );
    if (assignee_ids && assignee_ids.length > 0) {
      await run(
        dbClient.from("project_work_package_assignees").insert(
          assignee_ids.map((uid) => ({ work_package_id: (created as any).id, user_id: uid }))
        )
      );
    }
    return created;
  },

  async update(params: {
    id: string;
    title?: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    milestone_id?: string | null;
    status?: string;
    category_id?: string;
    assignee_ids?: string[];
  }) {
    const { id, assignee_ids, ...updates } = params;
    if (Object.keys(updates).length > 0) {
      await run(dbClient.from("project_work_packages").update(updates as any).eq("id", id));
    }
    if (assignee_ids !== undefined) {
      await run(dbClient.from("project_work_package_assignees").delete().eq("work_package_id", id));
      if (assignee_ids.length > 0) {
        await run(
          dbClient.from("project_work_package_assignees").insert(
            assignee_ids.map((uid) => ({ work_package_id: id, user_id: uid }))
          )
        );
      }
    }
  },

  delete: (id: string) => run(dbClient.from("project_work_packages").delete().eq("id", id)),
};
