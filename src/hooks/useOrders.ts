import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderType, OrderPriority } from "@/lib/types";

export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => api.orders.list(),
    enabled: !!user,
  });
}

export function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.orders.get(orderId!),
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: Parameters<typeof api.orders.create>[0]) =>
      api.orders.create(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.orders.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string } & Parameters<typeof api.orders.update>[1]) =>
      api.orders.update(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.orders.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

/** Kopiert einen Auftrag als unabhängigen neuen Entwurf. */
export function useCopyOrder() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.copy(orderId, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}


export function useUpdateOrderRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ranking }: { id: string; ranking: number | null }) => api.orders.updateRanking(id, ranking),
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
    queryFn: () => api.orders.auditLog(orderId!),
    enabled: !!orderId,
  });
}
