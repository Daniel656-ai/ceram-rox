import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_services")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("service_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAllServices() {
  return useQuery({
    queryKey: ["all-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_services")
        .select("*, workstations(id, name)")
        .order("category")
        .order("service_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useMyMeasurements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-measurements", user?.id],
    queryFn: async () => {
      const select = `*, measurement_services(service_name, category, hourly_rate, standard_duration_hours), workstations(id, name, responsible_user_id), measurement_orders(*, projects(project_number, project_name))`;
      const fetchCreators = async (rows: any[]) => {
        const ids = Array.from(new Set(rows.map((r) => r.measurement_orders?.created_by).filter(Boolean)));
        if (ids.length === 0) return new Map<string, any>();
        const { data } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", ids);
        return new Map((data || []).map((p: any) => [p.user_id, p]));
      };
      // Assigned to me
      const { data: assigned, error: e1 } = await supabase
        .from("order_measurements")
        .select(select)
        .eq("assigned_to", user!.id);
      if (e1) throw e1;
      // Workstations I'm responsible for
      const { data: myStations, error: eS } = await supabase
        .from("workstations")
        .select("id")
        .eq("responsible_user_id", user!.id);
      if (eS) throw eS;
      let viaStation: any[] = [];
      const stationIds = (myStations || []).map((s: any) => s.id);
      if (stationIds.length > 0) {
        const { data, error: e2 } = await supabase
          .from("order_measurements")
          .select(select)
          .in("workstation_id", stationIds);
        if (e2) throw e2;
        viaStation = data || [];
      }
      const map = new Map<string, any>();
      [...(assigned || []), ...viaStation].forEach((m: any) => map.set(m.id, m));
      const merged = Array.from(map.values());
      const creators = await fetchCreators(merged);
      merged.forEach((m: any) => {
        const cb = m.measurement_orders?.created_by;
        m.creator_profile = cb ? creators.get(cb) || null : null;
      });
      merged.sort((a: any, b: any) => {
        const ra = a.ranking ?? 999, rb = b.ranking ?? 999;
        if (ra !== rb) return ra - rb;
        if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
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
    mutationFn: async (m: { order_id: string; service_id: string; planned_hours?: number; due_date?: string; workstation_id?: string }) => {
      const { data, error } = await supabase.from("order_measurements").insert({ ...m, measurement_number: "WILL_BE_OVERWRITTEN" } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateMeasurementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("order_measurements").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateMeasurementRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ranking }: { id: string; ranking: number | null }) => {
      const { error } = await supabase.from("order_measurements").update({ ranking } as any).eq("id", id);
      if (error) throw error;
    },
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
    mutationFn: async (log: { order_measurement_id: string; user_id: string; work_date: string; hours: number; comment?: string }) => {
      const { data, error } = await supabase.from("work_logs").insert(log).select().single();
      if (error) throw error;
      return data;
    },
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
    mutationFn: async ({ id, ...updates }: { id: string; hourly_rate?: number; active?: boolean; service_name?: string; responsible_user_id?: string | null; workstation_id?: string | null; standard_duration_hours?: number }) => {
      const { error } = await supabase.from("measurement_services").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}

export function useDurchfuehrer() {
  return useQuery({
    queryKey: ["durchfuehrer-users"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["durchfuehrer", "master"]);
      if (rolesErr) throw rolesErr;
      const userIds = (roles || []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds)
        .eq("is_active", true);
      if (profErr) throw profErr;
      return profiles || [];
    },
  });
}

export function useAssignMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string | null }) => {
      const { error } = await supabase.from("order_measurements").update({ assigned_to }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
    },
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (service: { service_name: string; category: string; hourly_rate: number; responsible_user_id?: string | null; workstation_id?: string | null }) => {
      const { data, error } = await supabase.from("measurement_services").insert(service as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
    },
  });
}
