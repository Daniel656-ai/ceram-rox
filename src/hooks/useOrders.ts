import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderType, OrderPriority } from "@/lib/types";

export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await api
        .from("measurement_orders")
        .select(`*, projects(project_number, project_name), order_measurements(assigned_to, workstations(responsible_user_id))`)
        .order("ranking", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await api
        .from("measurement_orders")
        .select(`*, projects(project_number, project_name), samples(id, sample_number, sample_name, description, is_hazardous, location_id, storage_locations(hall, room, shelf, position)), order_measurements(*, measurement_services(service_name, category, hourly_rate, standard_duration_hours), measurement_parameters(*), measurement_results(*), work_logs(*), documents(*), workstations(id, name))`)
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: { project_id: string; order_type: OrderType; created_by: string; due_date?: string; notes?: string; priority?: OrderPriority; sample_id?: string }) => {
      const { data, error } = await api.from("measurement_orders").insert(order).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await api.from("measurement_orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; order_type?: OrderType; due_date?: string | null; notes?: string | null; priority?: OrderPriority }) => {
      const { error } = await api.from("measurement_orders").update(fields as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.from("measurement_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrderRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ranking }: { id: string; ranking: number | null }) => {
      const { error } = await api.from("measurement_orders").update({ ranking } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["lab-planning-measurements"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
    },
  });
}

export function useOrderAuditLog(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-audit-log", orderId],
    queryFn: async () => {
      const { data, error } = await api
        .from("order_audit_log")
        .select("*")
        .eq("order_id", orderId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}
