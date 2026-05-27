import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useConsumables() {
  return useQuery({
    queryKey: ["consumables"],
    queryFn: () => api.consumables.list(),
  });
}

export function useAddConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: { name: string; description?: string; price_per_unit: number; unit: string }) =>
      api.consumables.create(c),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consumables"] }),
  });
}

export function useUpdateConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; description?: string; price_per_unit?: number; unit?: string }) =>
      api.consumables.update(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consumables"] }),
  });
}

export function useDeleteConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.consumables.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consumables"] }),
  });
}
