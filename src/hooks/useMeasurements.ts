import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => api.measurementServices.listActive(),
  });
}

export function useAllServices() {
  return useQuery({
    queryKey: ["all-services"],
    queryFn: () => api.measurementServices.listAll(),
  });
}

export function useMyMeasurements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-measurements", user?.id],
    queryFn: async () => {
      const [assigned, viaStation] = await Promise.all([
        api.measurements.listAssignedTo(user!.id),
        api.measurements.listForUserResponsibleWorkstations(user!.id),
      ]);

      const map = new Map<string, any>();
      [...(assigned || []), ...(viaStation || [])].forEach((m: any) => map.set(m.id, m));
      const merged = Array.from(map.values());

      const creatorIds = Array.from(
        new Set(merged.map((r: any) => r.measurement_orders?.created_by).filter(Boolean))
      );
      const profiles = await api.measurements.fetchProfiles(creatorIds as string[]);
      const creatorMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      merged.forEach((m: any) => {
        const cb = m.measurement_orders?.created_by;
        m.creator_profile = cb ? creatorMap.get(cb) || null : null;
      });

      const today = new Date().toISOString().slice(0, 10);
      const typeWeight = (t?: string) => (t === "produktionsauftrag" ? 0 : 1);
      merged.sort((a: any, b: any) => {
        const ac = a.status === "completed" ? 1 : 0;
        const bc = b.status === "completed" ? 1 : 0;
        if (ac !== bc) return ac - bc;
        const ao = a.due_date && a.due_date < today ? 0 : 1;
        const bo = b.due_date && b.due_date < today ? 0 : 1;
        if (ao !== bo) return ao - bo;
        if (ao === 0 && bo === 0) {
          const cmp = (a.due_date || "").localeCompare(b.due_date || "");
          if (cmp !== 0) return cmp;
        }
        const ra = a.ranking ?? 999, rb = b.ranking ?? 999;
        if (ra !== rb) return ra - rb;
        const ta = typeWeight(a.measurement_orders?.order_type);
        const tb = typeWeight(b.measurement_orders?.order_type);
        if (ta !== tb) return ta - tb;
        return (a.due_date || "9999").localeCompare(b.due_date || "9999");
      });
      return merged;
    },
    enabled: !!user,
  });
}

export function useAddOrderMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: { order_id: string; service_id: string; planned_hours?: number; due_date?: string; workstation_id?: string }) =>
      api.measurements.add(m),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateMeasurementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.measurements.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateMeasurementRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ranking }: { id: string; ranking: number | null }) =>
      api.measurements.updateRanking(id, ranking),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useAddWorkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (log: { order_measurement_id: string; user_id: string; work_date: string; hours: number; comment?: string }) =>
      api.workLogs.add(log),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["work-logs"] });
    },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; hourly_rate?: number; active?: boolean; service_name?: string; responsible_user_id?: string | null; workstation_id?: string | null; standard_duration_hours?: number }) =>
      api.measurementServices.update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}

export function useDurchfuehrer() {
  return useQuery({
    queryKey: ["durchfuehrer-users"],
    queryFn: () => api.measurementUsers.listDurchfuehrer(),
  });
}

export function useAssignMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigned_to }: { id: string; assigned_to: string | null }) =>
      api.measurements.assign(id, assigned_to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
    },
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (service: { service_name: string; category: string; hourly_rate: number; responsible_user_id?: string | null; workstation_id?: string | null }) =>
      api.measurementServices.create(service),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}

export function useUnassignedQualifiedMeasurements() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ["unassigned-qualified", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      const rows = role === "master"
        ? await api.measurements.listUnassignedAll()
        : await api.measurements.listUnassignedQualified(user.id);
      return rows || [];
    },
    enabled: !!user,
  });
}

export function useClaimMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.measurements.claim(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unassigned-qualified"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
