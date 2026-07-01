import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type WpDependencyType = "FS" | "FF" | "SS" | "SF";

export interface WorkPackageDependency {
  id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: WpDependencyType;
  lag_days: number;
  created_by: string | null;
  created_at: string;
}

export const workPackageDependencies = {
  listByProject: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_work_package_dependencies")
        .select("*")
        .eq("project_id", projectId)
    ) as Promise<WorkPackageDependency[]>,

  create: (params: {
    project_id: string;
    predecessor_id: string;
    successor_id: string;
    dependency_type?: WpDependencyType;
    lag_days?: number;
    created_by?: string;
  }) =>
    unwrap(
      dbClient
        .from("project_work_package_dependencies")
        .insert(params as any)
        .select()
        .single()
    ),

  update: (
    id: string,
    updates: { dependency_type?: WpDependencyType; lag_days?: number }
  ) =>
    run(
      dbClient
        .from("project_work_package_dependencies")
        .update(updates as any)
        .eq("id", id)
    ),

  delete: (id: string) =>
    run(
      dbClient.from("project_work_package_dependencies").delete().eq("id", id)
    ),
};
