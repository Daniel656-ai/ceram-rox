import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { buildOrderReleaseLabels } from "@/lib/orders/orderReleaseLabel";

/** Anzeigetext der Fertigungsfreigabe je Auftrag (für Aufträge ohne Projekt), z. B. "0020-5438 · Rev0". */
export function useOrderReleaseLabels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orders", "release-labels"],
    queryFn: async () => {
      const { releases, requests } = await api.productionReleases.listOrderLinks();
      return buildOrderReleaseLabels(releases, requests);
    },
    enabled: !!user,
  });
}

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
    mutationFn: (v: string | { id: string; confirmNumber?: string }) =>
      typeof v === "string" ? api.orders.delete(v) : api.orders.delete(v.id, v.confirmNumber),
    onSuccess: async (_d, v) => {
      const id = typeof v === "string" ? v : v.id;
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
