import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { WpDependencyType } from "@/lib/api/workPackageDependencies";

export type { WorkPackageDependency, WpDependencyType } from "@/lib/api/workPackageDependencies";

export function useWorkPackageDependencies(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wp-dependencies", projectId],
    queryFn: () => api.workPackageDependencies.listByProject(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useCreateWorkPackageDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      project_id: string;
      predecessor_id: string;
      successor_id: string;
      dependency_type?: WpDependencyType;
      lag_days?: number;
      created_by?: string;
    }) => api.workPackageDependencies.create(params),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wp-dependencies", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["work-packages", vars.project_id] });
    },
  });
}

export function useUpdateWorkPackageDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      projectId,
      ...updates
    }: {
      id: string;
      projectId: string;
      dependency_type?: WpDependencyType;
      lag_days?: number;
    }) => api.workPackageDependencies.update(id, updates),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wp-dependencies", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["work-packages", vars.projectId] });
    },
  });
}

export function useDeleteWorkPackageDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      api.workPackageDependencies.delete(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wp-dependencies", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["work-packages", vars.projectId] });
    },
  });
}
