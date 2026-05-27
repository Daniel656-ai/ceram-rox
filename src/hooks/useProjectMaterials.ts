import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectConsumables(projectId?: string) {
  return useQuery({
    queryKey: ["project_consumables", projectId],
    queryFn: () => api.projectConsumables.list(projectId!),
    enabled: !!projectId,
  });
}

export function useAddProjectConsumable() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (c: { project_id: string; consumable_id: string; quantity: number; unit_price: number; comment?: string }) =>
      api.projectConsumables.add({ ...c, created_by: user!.id }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_consumables", v.project_id] }),
  });
}

export function useDeleteProjectConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; project_id: string }) =>
      api.projectConsumables.remove(id),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_consumables", v.project_id] }),
  });
}

export function useProjectKnetungMaterials(projectId?: string) {
  return useQuery({
    queryKey: ["project_knetung_materials", projectId],
    queryFn: () => api.projectKnetungMaterials.list(projectId!),
    enabled: !!projectId,
  });
}

export function useAddProjectKnetungMaterial() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (m: { project_id: string; raw_material_id: string; order_measurement_id?: string; quantity_kg: number; price_per_kg: number; comment?: string }) =>
      api.projectKnetungMaterials.add({ ...m, created_by: user!.id }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_knetung_materials", v.project_id] }),
  });
}

export function useDeleteProjectKnetungMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; project_id: string }) =>
      api.projectKnetungMaterials.remove(id),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_knetung_materials", v.project_id] }),
  });
}
