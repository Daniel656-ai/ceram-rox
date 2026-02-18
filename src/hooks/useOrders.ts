import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderType, OrderPriority } from "@/lib/types";

export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_orders")
        .select(`*, projects(project_number, project_name)`)
        .order("created_at", { ascending: false });
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
      const { data, error } = await supabase
        .from("measurement_orders")
        .select(`*, projects(project_number, project_name), order_measurements(*, measurement_services(service_name, category, hourly_rate), measurement_parameters(*), work_logs(*), documents(*), workstations(id, name))`)
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
    mutationFn: async (order: { project_id: string; order_type: OrderType; created_by: string; due_date?: string; notes?: string; priority?: OrderPriority }) => {
      const { data, error } = await supabase.from("measurement_orders").insert(order).select().single();
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
      const { error } = await supabase.from("measurement_orders").update({ status: status as any }).eq("id", id);
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
      const { error } = await supabase.from("measurement_orders").update(fields as any).eq("id", id);
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
      const { error } = await supabase.from("measurement_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useOrderAuditLog(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-audit-log", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
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
