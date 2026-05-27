import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useProjectConsumables(projectId?: string) {
  return useQuery({
    queryKey: ["project_consumables", projectId],
    queryFn: async () => {
      const { data, error } = await api
        .from("project_consumables")
        .select("*, consumables(name, unit)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useAddProjectConsumable() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (c: { project_id: string; consumable_id: string; quantity: number; unit_price: number; comment?: string }) => {
      const { data, error } = await api
        .from("project_consumables")
        .insert({ ...c, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_consumables", v.project_id] }),
  });
}

export function useDeleteProjectConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await api.from("project_consumables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_consumables", v.project_id] }),
  });
}

export function useProjectKnetungMaterials(projectId?: string) {
  return useQuery({
    queryKey: ["project_knetung_materials", projectId],
    queryFn: async () => {
      const { data, error } = await api
        .from("project_knetung_materials")
        .select("*, raw_materials(material_name, unit)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useAddProjectKnetungMaterial() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (m: { project_id: string; raw_material_id: string; order_measurement_id?: string; quantity_kg: number; price_per_kg: number; comment?: string }) => {
      const { data, error } = await api
        .from("project_knetung_materials")
        .insert({ ...m, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_knetung_materials", v.project_id] }),
  });
}

export function useDeleteProjectKnetungMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await api.from("project_knetung_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["project_knetung_materials", v.project_id] }),
  });
}
