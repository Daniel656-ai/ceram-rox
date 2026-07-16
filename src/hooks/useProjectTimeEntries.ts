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

export function usePortfolioTimeEntries(portfolioId?: string) {
  return useQuery({
    queryKey: ["portfolio_time_entries", portfolioId],
    queryFn: () => api.projectTimeEntries.listForPortfolio(portfolioId!),
    enabled: !!portfolioId,
  });
}

type ScopeInput =
  | { project_id: string; portfolio_id?: undefined }
  | { portfolio_id: string; project_id?: undefined };

export function useAddProjectTimeEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (entry: ScopeInput & {
      person_id: string;
      entry_date: string;
      duration_minutes: number;
      note: string;
      order_id?: string;
      work_package_id?: string | null;
      portfolio_work_package_id?: string | null;
      portfolio_task_id?: string | null;
    }) => api.projectTimeEntries.create({ ...entry, created_by: user!.id } as any),
    onSuccess: (_, v: any) => {
      if (v.project_id) qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] });
      if (v.portfolio_id) qc.invalidateQueries({ queryKey: ["portfolio_time_entries", v.portfolio_id] });
    },
  });
}

export function useAddProjectMeetingEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (meeting: ScopeInput & {
      person_ids: string[];
      entry_date: string;
      duration_minutes: number;
      note: string;
      order_id?: string;
      work_package_id?: string | null;
      portfolio_work_package_id?: string | null;
      portfolio_task_id?: string | null;
    }) => api.projectTimeEntries.createMeeting({ ...meeting, created_by: user!.id } as any),
    onSuccess: (_, v: any) => {
      if (v.project_id) qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] });
      if (v.portfolio_id) qc.invalidateQueries({ queryKey: ["portfolio_time_entries", v.portfolio_id] });
    },
  });
}

export function useUpdateProjectTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, project_id, portfolio_id, ...updates }: {
      id: string;
      project_id?: string;
      portfolio_id?: string;
      person_id?: string;
      entry_date?: string;
      duration_minutes?: number;
      note?: string;
      work_package_id?: string | null;
      portfolio_work_package_id?: string | null;
      portfolio_task_id?: string | null;
    }) => api.projectTimeEntries.update(id, updates),
    onSuccess: (_, v) => {
      if (v.project_id) qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] });
      if (v.portfolio_id) qc.invalidateQueries({ queryKey: ["portfolio_time_entries", v.portfolio_id] });
    },
  });
}

export function useDeleteProjectTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; project_id?: string; portfolio_id?: string }) =>
      api.projectTimeEntries.delete(id),
    onSuccess: (_, v) => {
      if (v.project_id) qc.invalidateQueries({ queryKey: ["project_time_entries", v.project_id] });
      if (v.portfolio_id) qc.invalidateQueries({ queryKey: ["portfolio_time_entries", v.portfolio_id] });
    },
  });
}
