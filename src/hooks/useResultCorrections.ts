import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

/** Darf der aktuelle Benutzer gespeicherte Messergebnisse korrigieren? */
export function useCanCorrectResults(): boolean {
  const { role } = useAuth();
  const { hasPermission } = usePermissions();
  return role === "master" || hasPermission("results.correct" as any);
}

export function useOrderCorrections(orderId: string | undefined) {
  return useQuery({
    queryKey: ["result-corrections", "order", orderId],
    queryFn: () => api.resultCorrections.listForOrder(orderId!),
    enabled: !!orderId,
  });
}

export function useMeasurementCorrections(measurementId: string | undefined) {
  return useQuery({
    queryKey: ["result-corrections", "measurement", measurementId],
    queryFn: () => api.resultCorrections.listForMeasurement(measurementId!),
    enabled: !!measurementId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["result-corrections"] });
    qc.invalidateQueries({ queryKey: ["order-results-overview"] });
    qc.invalidateQueries({ queryKey: ["measurement-results"] });
    qc.invalidateQueries({ queryKey: ["results-database"] });
    qc.invalidateQueries({ queryKey: ["order"] });
  };
}

export function useCorrectResultValue() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (params: { resultId: string; newValue: number; reason: string }) =>
      api.resultCorrections.correctValue(params),
    onSuccess: invalidate,
  });
}

export function useReassignMeasurementSample() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (params: { measurementId: string; newSampleId: string; reason: string }) =>
      api.resultCorrections.reassignSample(params),
    onSuccess: invalidate,
  });
}

/** Namen der ändernden Benutzer für die Historie auflösen. */
export function useCorrectionAuthors(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["correction-authors", ids.join(",")],
    queryFn: async () => {
      const rows: any[] = ids.length ? await api.profiles.listByIds(ids) : [];
      return new Map(rows.map((p) => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]));
    },
    enabled: ids.length > 0,
    initialData: new Map<string, string>(),
  });
}
