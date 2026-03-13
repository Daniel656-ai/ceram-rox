import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---- Storage Locations ----
export function useStorageLocations() {
  return useQuery({
    queryKey: ["storage_locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storage_locations")
        .select("*")
        .order("hall")
        .order("room")
        .order("shelf");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddStorageLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loc: { hall: string; room?: string; shelf?: string; position?: string }) => {
      const { data, error } = await supabase.from("storage_locations").insert(loc).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["storage_locations"] }),
  });
}

// ---- Raw Materials ----
export function useRawMaterials() {
  return useQuery({
    queryKey: ["raw_materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("*, storage_locations(*)")
        .order("material_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useRawMaterialDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["raw_material", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("*, storage_locations(*), raw_material_batches(*), raw_material_documents(*), raw_material_analyses(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useAddRawMaterial() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (m: { material_name: string; material_number: string; supplier?: string; description?: string; unit?: string; default_location_id?: string }) => {
      const { data, error } = await supabase
        .from("raw_materials")
        .insert({ ...m, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["raw_materials"] }),
  });
}

export function useUpdateRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; material_name?: string; supplier?: string; description?: string; unit?: string; default_location_id?: string | null; price_per_kg?: number }) => {
      const { error } = await supabase.from("raw_materials").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
      qc.invalidateQueries({ queryKey: ["raw_material", v.id] });
    },
  });
}

// ---- Batches ----
export function useAddBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { raw_material_id: string; batch_number: string; delivery_date?: string; delivery_quantity?: number; supplier?: string; notes?: string }) => {
      const { data, error } = await supabase.from("raw_material_batches").insert(b).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; raw_material_id: string }) => {
      const { error } = await supabase.from("raw_material_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

// ---- Analyses ----
export function useAddAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { raw_material_id: string; batch_id?: string; analysis_type?: string; parameter_name: string; value?: number; text_value?: string; unit?: string; min_limit?: number; max_limit?: number; remarks?: string }) => {
      const { data, error } = await supabase.from("raw_material_analyses").insert(a).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

export function useDeleteAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; raw_material_id: string }) => {
      const { error } = await supabase.from("raw_material_analyses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

// ---- Inventory Movements ----
export function useInventoryMovements(materialId?: string) {
  return useQuery({
    queryKey: ["inventory_movements", materialId],
    queryFn: async () => {
      let q = supabase.from("inventory_movements").select("*, raw_material_batches(batch_number)").order("movement_date", { ascending: false });
      if (materialId) q = q.eq("raw_material_id", materialId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useAddMovement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (m: { raw_material_id: string; batch_id?: string; movement_type: string; quantity: number; movement_date?: string; supplier?: string; project_reference?: string; comment?: string }) => {
      const { data, error } = await supabase.from("inventory_movements").insert({ ...m, created_by: user!.id }).select().single();
      if (error) throw error;
      return data;
    },
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
    mutationFn: async ({ file, raw_material_id, batch_id, document_type }: { file: File; raw_material_id: string; batch_id?: string; document_type: string }) => {
      const path = `${user!.id}/${raw_material_id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("raw-material-documents").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { error: dbErr } = await supabase.from("raw_material_documents").insert({
        raw_material_id,
        batch_id: batch_id || null,
        document_type,
        file_name: file.name,
        file_type: file.type,
        storage_path: path,
        uploaded_by: user!.id,
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ["raw_material", v.raw_material_id] }),
  });
}

// ---- Stock calculation helper ----
export function calculateStock(movements: Array<{ movement_type: string; quantity: number }>) {
  return movements.reduce((sum, m) => {
    return m.movement_type === "eingang" ? sum + Number(m.quantity) : sum - Number(m.quantity);
  }, 0);
}
