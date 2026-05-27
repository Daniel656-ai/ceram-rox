import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAnyProjectLead() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-any-project-lead", user?.id],
    queryFn: () => api.projectMembers.isAnyLead(user!.id),
    enabled: !!user,
  });
}

export function useProjectMembers(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => api.projectMembers.list(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member: { project_id: string; user_id: string; role: string }) =>
      api.projectMembers.add(member),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-members", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-with-stats"] });
    },
  });
}

export function useUpdateProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string; projectId: string }) =>
      api.projectMembers.updateRole(id, role),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-members", vars.projectId] });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      api.projectMembers.remove(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-members", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-with-stats"] });
    },
  });
}
