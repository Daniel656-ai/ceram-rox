import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useConsumables() {
  return useQuery({
    queryKey: ["consumables"],
    queryFn: async () => {
      const { data, error } = await api
        .from("consumables")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { name: string; description?: string; price_per_unit: number; unit: string }) => {
      const { data, error } = await api.from("consumables").insert(c).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consumables"] }),
  });
}

export function useUpdateConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; price_per_unit?: number; unit?: string }) => {
      const { error } = await api.from("consumables").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consumables"] }),
  });
}

export function useDeleteConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.from("consumables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consumables"] }),
  });
}
