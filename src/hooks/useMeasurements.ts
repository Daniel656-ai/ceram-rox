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
    queryKey: ["my-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_measurements")
        .select(`*, measurement_services(service_name, category, hourly_rate), measurement_orders(*, projects(project_number, project_name))`)
        .eq("assigned_to", user!.id)
        .order("priority", { ascending: false })
        .order("due_date");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAddOrderMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { order_id: string; service_id: string; planned_hours?: number; priority?: number; due_date?: string; workstation_id?: string }) => {
      const { data, error } = await supabase.from("order_measurements").insert(m).select().single();
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
    mutationFn: async ({ id, ...updates }: { id: string; hourly_rate?: number; active?: boolean; service_name?: string; responsible_user_id?: string | null; workstation_id?: string | null }) => {
      const { error } = await supabase.from("measurement_services").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["all-services"] });
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
