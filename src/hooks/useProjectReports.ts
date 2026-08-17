import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectReports(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-reports", projectId],
    queryFn: () => api.projectReports.list(projectId!),
    enabled: !!user && !!projectId,
  });
}

/** Alle Bericht→Ergebnis-Referenzen des Projekts (keine Ergebniskopien). */
export function useProjectReportSelections(projectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-report-selections", projectId],
    queryFn: () => api.projectReports.listSelections(projectId!),
    enabled: !!user && !!projectId,
  });
}

export function useCreateProjectReport(projectId?: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: { title: string; report_kind?: string; note?: string | null }) =>
      api.projectReports.create({ ...input, project_id: projectId!, created_by: user?.id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-reports", projectId] }),
  });
}

export function useDeleteProjectReport(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projectReports.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-reports", projectId] });
      qc.invalidateQueries({ queryKey: ["project-report-selections", projectId] });
    },
  });
}

export function useSetProjectReportSelection(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, resultIds }: { reportId: string; resultIds: string[] }) =>
      api.projectReports.setSelection(reportId, resultIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-report-selections", projectId] }),
  });
}
