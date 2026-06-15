import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  mixtures,
  mixtureRecipes,
  mixtureBatches,
  mixtureInventory,
  type MixtureCategory,
} from "@/lib/api/mixtures";
import { useAuth } from "@/contexts/AuthContext";

export function useMixtures() {
  return useQuery({
    queryKey: ["mixtures"],
    queryFn: () => mixtures.list(),
  });
}

export function useMixture(id: string | undefined) {
  return useQuery({
    queryKey: ["mixture", id],
    queryFn: () => mixtures.get(id!),
    enabled: !!id,
  });
}

export function useAddMixture() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (m: {
      name: string;
      mixture_number?: string | null;
      description?: string | null;
      category?: MixtureCategory;
      unit?: string;
      target_concentration?: string | null;
    }) => mixtures.create(m, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixtures"] }),
  });
}

export function useUpdateMixture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      mixture_number?: string | null;
      description?: string | null;
      category?: MixtureCategory;
      unit?: string;
      target_concentration?: string | null;
      is_active?: boolean;
    }) => mixtures.update(id, updates),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["mixtures"] });
      qc.invalidateQueries({ queryKey: ["mixture", v.id] });
    },
  });
}

export function useDeleteMixture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mixtures.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixtures"] }),
  });
}

// ---- Recipe ----
export function useMixtureRecipe(mixtureId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_recipe", mixtureId],
    queryFn: () => mixtureRecipes.list(mixtureId!),
    enabled: !!mixtureId,
  });
}

export function useAddRecipeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: {
      mixture_id: string;
      raw_material_id: string;
      quantity: number;
      unit?: string;
      position?: number;
      notes?: string | null;
    }) => mixtureRecipes.add(item),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: ["mixture_recipe", v.mixture_id] }),
  });
}

export function useUpdateRecipeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      mixture_id: _m,
      ...updates
    }: {
      id: string;
      mixture_id: string;
      raw_material_id?: string;
      quantity?: number;
      unit?: string;
      position?: number;
      notes?: string | null;
    }) => mixtureRecipes.update(id, updates),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: ["mixture_recipe", v.mixture_id] }),
  });
}

export function useDeleteRecipeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; mixture_id: string }) =>
      mixtureRecipes.delete(id),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: ["mixture_recipe", v.mixture_id] }),
  });
}

// ---- Batches ----
export function useMixtureBatches(mixtureId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_batches", mixtureId],
    queryFn: () => mixtureBatches.list(mixtureId),
    enabled: !!mixtureId,
  });
}

export function useProduceMixtureBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Parameters<typeof mixtureBatches.produce>[0]) =>
      mixtureBatches.produce(args),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["mixture_batches", v.mixture_id] });
      qc.invalidateQueries({ queryKey: ["mixture_inventory", v.mixture_id] });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
      qc.invalidateQueries({ queryKey: ["inventory_movements"] });
    },
  });
}

// ---- Inventory ----
export function useMixtureInventory(mixtureId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_inventory", mixtureId],
    queryFn: () => mixtureInventory.list(mixtureId!),
    enabled: !!mixtureId,
  });
}

// Re-export raw materials hook for selectors
export { useRawMaterials } from "./useRawMaterials";
