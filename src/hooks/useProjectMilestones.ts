import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectMilestones(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: () => api.projectMilestones.list(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (milestone: {
      project_id: string;
      title: string;
      description?: string;
      milestone_date?: string;
      status?: string;
      created_by: string;
      work_package_id?: string | null;
    }) => api.projectMilestones.create(milestone),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-milestones", vars.project_id] });
    },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, ...updates }: {
      id: string;
      projectId: string;
      title?: string;
      description?: string;
      milestone_date?: string | null;
      status?: string;
    }) => api.projectMilestones.update(id, updates),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-milestones", vars.projectId] });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      api.projectMilestones.delete(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-milestones", vars.projectId] });
    },
  });
}
