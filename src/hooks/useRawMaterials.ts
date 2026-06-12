import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ---- Storage Locations ----
export function useStorageLocations() {
  return useQuery({
    queryKey: ["storage_locations"],
    queryFn: () => api.storageLocations.list(),
  });
}

export function useAddStorageLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (loc: { hall: string; room?: string; shelf?: string; position?: string }) =>
      api.storageLocations.add(loc),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["storage_locations"] }),
  });
}

// ---- Raw Materials ----
export function useRawMaterials() {
  return useQuery({
    queryKey: ["raw_materials"],
    queryFn: () => api.rawMaterials.list(),
  });
}

export function useRawMaterialDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["raw_material", id],
    queryFn: () => api.rawMaterials.get(id!),
    enabled: !!id,
  });
}

export function useAddRawMaterial() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (m: { material_name: string; material_number: string; supplier?: string; description?: string; unit?: string; default_location_id?: string; is_hazardous?: boolean; hazard_categories?: string[] }) =>
      api.rawMaterials.create(m, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export function useUpdateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; material_name?: string; supplier?: string; description?: string; unit?: string; default_location_id?: string | null; price_per_kg?: number; is_hazardous?: boolean; hazard_categories?: string[] }) =>
      api.rawMaterials.update(id, updates),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
      qc.invalidateQueries({ queryKey: ["raw_material", v.id] });
    },
  });
}

export function useDeleteRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.rawMaterials.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });
}

// ---- Batches ----
export function useAddBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { raw_material_id: string; batch_number: string; delivery_date?: string; delivery_quantity?: number; supplier?: string; notes?: string }) =>
      api.rawMaterialBatches.add(b),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; raw_material_id: string }) =>
      api.rawMaterialBatches.delete(id),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

// ---- Analyses ----
export function useAddAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { raw_material_id: string; batch_id?: string; analysis_type?: string; parameter_name: string; value?: number; text_value?: string; unit?: string; min_limit?: number; max_limit?: number; remarks?: string }) =>
      api.rawMaterialAnalyses.add(a),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

export function useDeleteAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; raw_material_id: string }) =>
      api.rawMaterialAnalyses.delete(id),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

// ---- Inventory Movements ----
export function useInventoryMovements(materialId?: string) {
  return useQuery({
    queryKey: ["inventory_movements", materialId],
    queryFn: () => api.inventoryMovements.list(materialId),
  });
}

export function useAddMovement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (m: { raw_material_id: string; batch_id?: string; movement_type: string; quantity: number; movement_date?: string; supplier?: string; project_reference?: string; comment?: string }) =>
      api.inventoryMovements.add(m, user!.id),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["inventory_movements", v.raw_material_id] });
      qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });
}

// ---- Documents ----
export function useAddRawMaterialDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ file, raw_material_id, batch_id, document_type }: { file: File; raw_material_id: string; batch_id?: string; document_type: string }) =>
      api.rawMaterialDocuments.upload({ file, raw_material_id, batch_id, document_type, uploaded_by: user!.id }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

// ---- Stock calculation helper ----
export function calculateStock(movements: Array<{ movement_type: string; quantity: number }>) {
  return movements.reduce((sum, m) => {
    return m.movement_type === "eingang" ? sum + Number(m.quantity) : sum - Number(m.quantity);
  }, 0);
}
