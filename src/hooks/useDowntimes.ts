import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface WorkstationDowntime {
  id: string;
  workstation_id: string;
  downtime_type: "wartung" | "reparatur" | "sonstiges";
  status: "geplant" | "aktiv" | "abgeschlossen";
  start_at: string;
  end_at: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useDowntimes(workstationId?: string) {
  return useQuery({
    queryKey: ["workstation_downtimes", workstationId],
    queryFn: async () => {
      let q = api.from("workstation_downtimes").select("*").order("start_at");
      if (workstationId) q = q.eq("workstation_id", workstationId);
      const { data, error } = await q;
      if (error) throw error;
      return data as WorkstationDowntime[];
    },
  });
}

export function useCreateDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: {
      workstation_id: string;
      downtime_type: WorkstationDowntime["downtime_type"];
      status?: WorkstationDowntime["status"];
      start_at: string;
      end_at: string;
      description?: string;
      created_by: string;
    }) => {
      const { data, error } = await api.from("workstation_downtimes").insert(d).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstation_downtimes"] }),
  });
}

export function useUpdateDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<WorkstationDowntime> & { id: string }) => {
      const { data, error } = await api.from("workstation_downtimes").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstation_downtimes"] }),
  });
}

export function useDeleteDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.from("workstation_downtimes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstation_downtimes"] }),
  });
}

export function useCheckDowntimeConflict() {
  return useMutation({
    mutationFn: async ({
      workstationId,
      start,
      end,
    }: {
      workstationId: string;
      start: string;
      end: string;
    }) => {
      const { data, error } = await api.rpc("check_workstation_downtime_conflict", {
        _workstation_id: workstationId,
        _start: start,
        _end: end,
      });
      if (error) throw error;
      return data as Array<{
        id: string;
        downtime_type: string;
        start_at: string;
        end_at: string;
        status: string;
      }>;
    },
  });
}
