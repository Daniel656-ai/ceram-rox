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
      const assigned = await api.measurements.listAssignedTo(user!.id);
      const merged = [...(assigned || [])];

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
    mutationFn: (m: { order_id: string; service_id: string; sample_id?: string | null; planned_hours?: number; due_date?: string; source_package_id?: string | null; source_package_name_snapshot?: string | null; origin?: "booked" | "workflow"; source_measurement_id?: string | null; source_step_key?: string | null }) =>
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
    mutationFn: ({ id, ...updates }: { id: string; [k: string]: any }) =>
      api.measurementServices.update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}

export function useArchiveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.measurementServices.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}

export function useUnarchiveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.measurementServices.unarchive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.measurementServices.deleteSafe(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}

export function useServiceReferences(id: string | null) {
  return useQuery({
    queryKey: ["service-references", id],
    queryFn: () => api.measurementServices.countReferences(id!),
    enabled: !!id,
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
    mutationFn: (service: { service_name: string; category: string; hourly_rate: number }) =>
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
      qc.invalidateQueries({ queryKey: ["open-measurements-overview"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

/**
 * Sichtbare, aber (derzeit) nicht übernehmbare offene Aufgaben: fremd
 * zugewiesen oder ohne eigene Qualifikation. Rein lesend.
 */
export function useOpenMeasurementsOverview() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ["open-measurements-overview", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      const [rows, qualified] = await Promise.all([
        api.measurements.listOpenVisible(),
        api.measurements.listQualifiedServiceIds(user.id),
      ]);
      const q = new Set(qualified);
      const isMaster = role === "master";
      const others = ((rows || []) as any[]).filter(
        (m) => m.assigned_to !== user.id && (m.assigned_to !== null || (!isMaster && !q.has(m.service_id)))
      );
      const ids = Array.from(new Set(others.map((m) => m.assigned_to).filter(Boolean))) as string[];
      const profiles = await api.measurements.fetchProfiles(ids);
      const names = new Map((profiles || []).map((p: any) => [p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
      return others.map((m) => ({
        ...m,
        __qualified: isMaster || q.has(m.service_id),
        __assigneeName: m.assigned_to ? names.get(m.assigned_to) || "anderer Mitarbeiter" : null,
      }));
    },
    enabled: !!user,
  });
}

export function useReassignMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newUserId, reason }: { id: string; newUserId: string; reason: string }) =>
      api.measurements.reassign(id, newUserId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["open-measurements-overview"] });
      qc.invalidateQueries({ queryKey: ["unassigned-qualified"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["measurement"] });
    },
  });
}
