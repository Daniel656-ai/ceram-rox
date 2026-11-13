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
    onSuccess: async (_d, id) => {
      qc.removeQueries({ queryKey: ["order", id] });
      // All active order/task/sample views refetch; inactive caches become stale.
      // Includes the actual keys "unassigned-qualified" and "open-measurements-overview".
      await qc.invalidateQueries();
    },
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

export function useSetOrderBilled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => api.orders.setBilled(id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
