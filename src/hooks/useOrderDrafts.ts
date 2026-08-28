import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

/** Eigene Auftragsentwürfe. Nur aktiv, wenn die Berechtigung gesetzt ist. */
export function useMyOrderDrafts() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const enabled = !!user && hasPermission("orders.drafts.manage");

  return useQuery({
    queryKey: ["order-drafts", user?.id],
    queryFn: () => api.orderDrafts.listMine(user!.id),
    enabled,
  });
}

export function useOrderDraft(id: string | null) {
  return useQuery({
    queryKey: ["order-draft", id],
    queryFn: () => api.orderDrafts.get(id!),
    enabled: !!id,
  });
}

export function useDeleteOrderDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.orderDrafts.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-drafts"] }),
  });
}
