import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSamples() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*, projects(project_number, project_name), storage_locations:location_id(id, hall, room, shelf, position)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSampleDetail(id?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sample", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*, projects(project_number, project_name), storage_locations:location_id(id, hall, room, shelf, position)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });
}

export function useSampleHistory(sampleId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sample_history", sampleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sample_history")
        .select("*")
        .eq("sample_id", sampleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!sampleId,
  });
}

export function useSampleDocuments(sampleId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sample_documents", sampleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sample_documents")
        .select("*")
        .eq("sample_id", sampleId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!sampleId,
  });
}

export function useSubSamples(parentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subsamples", parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*, projects(project_number, project_name), storage_locations:location_id(id, hall, room, shelf, position)")
        .eq("parent_sample_id", parentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!parentId,
  });
}

export function useCreateSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sample: {
      sample_name: string;
      project_id: string;
      description: string;
      created_by: string;
      post_measurement_action?: string;
      post_measurement_action_text?: string;
      storage_min_duration?: string;
      storage_hints?: string;
      storage_expiry_date?: string;
      disposal_method?: string;
      disposal_hints?: string;
      disposal_category?: string;
      hazard_categories?: string[];
      is_hazardous?: boolean;
      location_id?: string;
      parent_sample_id?: string;
      tags?: string[];
    }) => {
      const { data, error } = await supabase
        .from("samples")
        .insert({
          ...sample,
          sample_number: "WILL_BE_OVERWRITTEN",
          hazard_categories: sample.hazard_categories || [],
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Create history entry
      await supabase.from("sample_history").insert({
        sample_id: data.id,
        action: "created",
        user_id: sample.created_by,
        comment: null,
        metadata: {},
      } as any);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["samples"] });
    },
  });
}

export function useDeleteSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("samples").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["samples"] }),
  });
}

export function useUpdateSampleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, userId, comment }: { id: string; status: string; userId: string; comment?: string }) => {
      const { error } = await supabase
        .from("samples")
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;

      await supabase.from("sample_history").insert({
        sample_id: id,
        action: "status_changed",
        user_id: userId,
        comment,
        metadata: { new_status: status },
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["samples"] });
      qc.invalidateQueries({ queryKey: ["sample"] });
      qc.invalidateQueries({ queryKey: ["sample_history"] });
    },
  });
}

export function useUpdateSampleLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, locationId, userId, comment }: { id: string; locationId: string | null; userId: string; comment?: string }) => {
      const { error } = await supabase
        .from("samples")
        .update({ location_id: locationId } as any)
        .eq("id", id);
      if (error) throw error;

      await supabase.from("sample_history").insert({
        sample_id: id,
        action: "location_changed",
        user_id: userId,
        comment,
        metadata: { new_location_id: locationId },
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["samples"] });
      qc.invalidateQueries({ queryKey: ["sample"] });
      qc.invalidateQueries({ queryKey: ["sample_history"] });
    },
  });
}

export function useHandoverSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fromUserId, toUserId, comment }: { id: string; fromUserId: string; toUserId: string; comment?: string }) => {
      const { error } = await supabase
        .from("samples")
        .update({ current_holder_id: toUserId } as any)
        .eq("id", id);
      if (error) throw error;

      await supabase.from("sample_history").insert({
        sample_id: id,
        action: "handover",
        user_id: fromUserId,
        comment,
        metadata: { from_user: fromUserId, to_user: toUserId },
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["samples"] });
      qc.invalidateQueries({ queryKey: ["sample"] });
      qc.invalidateQueries({ queryKey: ["sample_history"] });
    },
  });
}

export function useAddSampleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: { sample_id: string; file_name: string; file_type: string; storage_path: string; document_type: string; uploaded_by: string }) => {
      const { data, error } = await supabase
        .from("sample_documents")
        .insert(doc as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sample_documents"] }),
  });
}

export function useAddSampleHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { sample_id: string; action: string; user_id: string; comment?: string; metadata?: any }) => {
      const { data, error } = await supabase
        .from("sample_history")
        .insert({
          ...entry,
          metadata: entry.metadata || {},
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sample_history"] }),
  });
}
