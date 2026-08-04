import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useSamples() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["samples"],
    queryFn: () => api.samples.list(),
    enabled: !!user,
  });
}

export function useSampleDetail(id?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sample", id],
    queryFn: () => api.samples.get(id!),
    enabled: !!user && !!id,
  });
}

export function useSampleHistory(sampleId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sample_history", sampleId],
    queryFn: () => api.sampleHistory.list(sampleId!),
    enabled: !!user && !!sampleId,
  });
}

export function useSampleDocuments(sampleId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sample_documents", sampleId],
    queryFn: () => api.sampleDocuments.list(sampleId!),
    enabled: !!user && !!sampleId,
  });
}

export function useSubSamples(parentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subsamples", parentId],
    queryFn: () => api.samples.listChildren(parentId!),
    enabled: !!user && !!parentId,
  });
}

export function useSampleMeasurements(sampleId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sample_measurements", sampleId],
    queryFn: () => api.samples.listMeasurements(sampleId!),
    enabled: !!user && !!sampleId,
  });
}

export function useCreateSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sample: {
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
      category?: string | null;
      v2o5_content?: number | null;
      operating_hours?: number | null;
      is_used_catalyst?: boolean;
      raw_material_id?: string | null;
      raw_material_code?: string | null;
      lot_number?: string | null;
      bigbag_number?: string | null;
    }) => api.samples.create(sample),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["samples"] });
    },
  });
}

export function useDeleteSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.samples.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["samples"] }),
  });
}

export function useUpdateSampleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: string; userId: string; comment?: string }) =>
      api.samples.updateStatus(args),
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
    mutationFn: (args: { id: string; locationId: string | null; userId: string; comment?: string }) =>
      api.samples.updateLocation(args),
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
    mutationFn: (args: { id: string; fromUserId: string; toUserId: string; comment?: string }) =>
      api.samples.handover(args),
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
    mutationFn: (doc: {
      sample_id: string;
      file_name: string;
      file_type: string;
      storage_path: string;
      document_type: string;
      uploaded_by: string;
    }) => api.sampleDocuments.add(doc),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sample_documents"] }),
  });
}

export function useAddSampleHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: { sample_id: string; action: string; user_id: string; comment?: string; metadata?: any }) =>
      api.sampleHistory.add(entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sample_history"] }),
  });
}
