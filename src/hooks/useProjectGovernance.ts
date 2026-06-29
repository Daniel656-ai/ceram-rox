import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---------- Change Requests ----------
export function useProjectChangeRequests(projectId?: string) {
  return useQuery({
    queryKey: ["project_change_requests", projectId],
    queryFn: () => api.projectChangeRequests.list(projectId!),
    enabled: !!projectId,
  });
}
export function useChangeRequestMutations(projectId: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["project_change_requests", projectId] });
  return {
    create: useMutation({ mutationFn: api.projectChangeRequests.create, onSuccess: inv }),
    update: useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: any }) =>
        api.projectChangeRequests.update(id, updates),
      onSuccess: inv,
    }),
    decide: useMutation({
      mutationFn: ({ id, status, approverId }: { id: string; status: "approved" | "rejected" | "withdrawn"; approverId: string }) =>
        api.projectChangeRequests.decide(id, status, approverId),
      onSuccess: inv,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.projectChangeRequests.delete(id), onSuccess: inv }),
  };
}

// ---------- Decisions ----------
export function useProjectDecisions(projectId?: string) {
  return useQuery({
    queryKey: ["project_decisions", projectId],
    queryFn: () => api.projectDecisions.list(projectId!),
    enabled: !!projectId,
  });
}
export function useDecisionMutations(projectId: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["project_decisions", projectId] });
  return {
    create: useMutation({ mutationFn: api.projectDecisions.create, onSuccess: inv }),
    update: useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: any }) => api.projectDecisions.update(id, updates),
      onSuccess: inv,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.projectDecisions.delete(id), onSuccess: inv }),
  };
}

// ---------- Stakeholders ----------
export function useProjectStakeholders(projectId?: string) {
  return useQuery({
    queryKey: ["project_stakeholders", projectId],
    queryFn: () => api.projectStakeholders.list(projectId!),
    enabled: !!projectId,
  });
}
export function useStakeholderMutations(projectId: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["project_stakeholders", projectId] });
  return {
    create: useMutation({ mutationFn: api.projectStakeholders.create, onSuccess: inv }),
    update: useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: any }) => api.projectStakeholders.update(id, updates),
      onSuccess: inv,
    }),
    touch: useMutation({ mutationFn: (id: string) => api.projectStakeholders.touchContact(id), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => api.projectStakeholders.delete(id), onSuccess: inv }),
  };
}

// ---------- Lessons Learned ----------
export function useProjectLessonsLearned(projectId?: string) {
  return useQuery({
    queryKey: ["project_lessons_learned", projectId],
    queryFn: () => api.projectLessonsLearned.list(projectId!),
    enabled: !!projectId,
  });
}
export function useLessonsLearnedMutations(projectId: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["project_lessons_learned", projectId] });
  return {
    create: useMutation({ mutationFn: api.projectLessonsLearned.create, onSuccess: inv }),
    update: useMutation({
      mutationFn: ({ id, updates }: { id: string; updates: any }) => api.projectLessonsLearned.update(id, updates),
      onSuccess: inv,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.projectLessonsLearned.delete(id), onSuccess: inv }),
  };
}
