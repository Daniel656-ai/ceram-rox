import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type { WorkPackage } from "@/lib/api/workPackages";

export function useWorkPackages(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["work-packages", projectId],
    queryFn: () => api.workPackages.listByProject(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useCreateWorkPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      project_id: string;
      title: string;
      description?: string;
      start_date?: string | null;
      end_date?: string | null;
      milestone_id?: string | null;
      status?: string;
      assignee_ids?: string[];
      created_by: string;
    }) => api.workPackages.create(params),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["work-packages", vars.project_id] }),
  });
}

export function useUpdateWorkPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...params }: {
      id: string;
      projectId: string;
      title?: string;
      description?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      milestone_id?: string | null;
      status?: string;
      assignee_ids?: string[];
    }) => api.workPackages.update(params),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["work-packages", vars.projectId] }),
  });
}

export function useDeleteWorkPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => api.workPackages.delete(id),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["work-packages", vars.projectId] }),
  });
}
