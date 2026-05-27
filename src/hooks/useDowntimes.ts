import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type { WorkstationDowntime } from "@/lib/api/downtimes";
import type { WorkstationDowntime } from "@/lib/api/downtimes";

export function useDowntimes(workstationId?: string) {
  return useQuery({
    queryKey: ["workstation_downtimes", workstationId],
    queryFn: () => api.downtimes.list(workstationId),
  });
}

export function useCreateDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: {
      workstation_id: string;
      downtime_type: WorkstationDowntime["downtime_type"];
      status?: WorkstationDowntime["status"];
      start_at: string;
      end_at: string;
      description?: string;
      created_by: string;
    }) => api.downtimes.create(d as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstation_downtimes"] }),
  });
}

export function useUpdateDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<WorkstationDowntime> & { id: string }) => api.downtimes.update(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstation_downtimes"] }),
  });
}

export function useDeleteDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.downtimes.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstation_downtimes"] }),
  });
}

export function useCheckDowntimeConflict() {
  return useMutation({
    mutationFn: ({ workstationId, start, end }: { workstationId: string; start: string; end: string }) =>
      api.downtimes.checkConflict(workstationId, start, end) as Promise<
        Array<{ id: string; downtime_type: string; start_at: string; end_at: string; status: string }>
      >,
  });
}
