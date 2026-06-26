import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectTimeEntries(projectId?: string, orderId?: string) {
  return useQuery({
    queryKey: ["project_time_entries", projectId, orderId],
    queryFn: () => api.projectTimeEntries.list(projectId!, orderId),
    enabled: !!projectId,
  });
}

export function useAddProjectTimeEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (entry: {
      project_id: string;
      person_id: string;
      entry_date: string;
      duration_minutes: number;
      note: string;
      order_id?: string;
    }) => api.projectTimeEntries.create({ ...entry, created_by: user!.id }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] }),
  });
}

export function useAddProjectMeetingEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (meeting: {
      project_id: string;
      person_ids: string[];
      entry_date: string;
      duration_minutes: number;
      note: string;
      order_id?: string;
    }) => api.projectTimeEntries.createMeeting({ ...meeting, created_by: user!.id }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] }),
  });
}

export function useUpdateProjectTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, project_id, ...updates }: {
      id: string;
      project_id: string;
      person_id?: string;
      entry_date?: string;
      duration_minutes?: number;
      note?: string;
    }) => api.projectTimeEntries.update(id, updates),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] }),
  });
}

export function useDeleteProjectTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; project_id: string }) =>
      api.projectTimeEntries.delete(id),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] }),
  });
}
