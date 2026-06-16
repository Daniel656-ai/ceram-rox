import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---- Recipe versions ----
export function useRecipeVersions(mixtureId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_recipe_versions", mixtureId],
    queryFn: () => api.recipeVersions.list(mixtureId!),
    enabled: !!mixtureId,
  });
}

export function useActiveRecipeVersion(mixtureId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_active_version", mixtureId],
    queryFn: () => api.recipeVersions.active(mixtureId!),
    enabled: !!mixtureId,
  });
}

export function useCreateRecipeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { mixtureId: string; copyFrom?: string | null; notes?: string | null }) =>
      api.recipeVersions.create(args.mixtureId, args.copyFrom, args.notes),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["mixture_recipe_versions", v.mixtureId] });
      qc.invalidateQueries({ queryKey: ["mixture_active_version", v.mixtureId] });
    },
  });
}

export function useActivateRecipeVersion(mixtureId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => api.recipeVersions.activate(versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mixture_recipe_versions", mixtureId] });
      qc.invalidateQueries({ queryKey: ["mixture_active_version", mixtureId] });
    },
  });
}

export function useRecipeAvailability(versionId: string | undefined, scale = 1) {
  return useQuery({
    queryKey: ["mixture_recipe_availability", versionId, scale],
    queryFn: () => api.recipeVersions.availability(versionId!, scale),
    enabled: !!versionId,
  });
}

// ---- Process sections / steps / planned measurements ----
export function useProcessSections(versionId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_process_sections", versionId],
    queryFn: () => api.processSections.list(versionId!),
    enabled: !!versionId,
  });
}

function invalidateSections(qc: ReturnType<typeof useQueryClient>, versionId?: string) {
  qc.invalidateQueries({ queryKey: ["mixture_process_sections", versionId] });
}

export function useAddSection(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.processSections.create,
    onSuccess: () => invalidateSections(qc, versionId),
  });
}
export function useUpdateSection(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & Record<string, any>) => api.processSections.update(v.id, v),
    onSuccess: () => invalidateSections(qc, versionId),
  });
}
export function useDeleteSection(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.processSections.delete,
    onSuccess: () => invalidateSections(qc, versionId),
  });
}

export function useAddStep(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.processSteps.create,
    onSuccess: () => invalidateSections(qc, versionId),
  });
}
export function useUpdateStep(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & Record<string, any>) => api.processSteps.update(v.id, v),
    onSuccess: () => invalidateSections(qc, versionId),
  });
}
export function useDeleteStep(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.processSteps.delete,
    onSuccess: () => invalidateSections(qc, versionId),
  });
}

export function useAddPlannedMeasurement(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.plannedMeasurements.create,
    onSuccess: () => invalidateSections(qc, versionId),
  });
}
export function useDeletePlannedMeasurement(versionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.plannedMeasurements.delete,
    onSuccess: () => invalidateSections(qc, versionId),
  });
}

// ---- Batch execution ----
export function useBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_batch", batchId],
    queryFn: () => api.mixtureExecution.getBatch(batchId!),
    enabled: !!batchId,
  });
}

export function useWeighings(batchId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_weighings", batchId],
    queryFn: () => api.mixtureExecution.listWeighings(batchId!),
    enabled: !!batchId,
  });
}

export function useBatchMeasurements(batchId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_batch_measurements", batchId],
    queryFn: () => api.mixtureExecution.listMeasurements(batchId!),
    enabled: !!batchId,
  });
}

export function useBatchDeviations(batchId: string | undefined) {
  return useQuery({
    queryKey: ["mixture_batch_deviations", batchId],
    queryFn: () => api.mixtureExecution.listDeviations(batchId!),
    enabled: !!batchId,
  });
}

export function useRecordWeighing(batchId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.mixtureExecution.recordWeighing,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mixture_weighings", batchId] });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
      qc.invalidateQueries({ queryKey: ["inventory_movements"] });
    },
  });
}

export function useRecordMeasurement(batchId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.mixtureExecution.recordMeasurement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixture_batch_measurements", batchId] }),
  });
}

export function useRecordDeviation(batchId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.mixtureExecution.recordDeviation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixture_batch_deviations", batchId] }),
  });
}

export function useStartBatch(batchId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.mixtureExecution.start(batchId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixture_batch", batchId] }),
  });
}

export function useCompleteBatch(batchId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (producedQuantity?: number | null) =>
      api.mixtureExecution.complete(batchId!, producedQuantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mixture_batch", batchId] });
      qc.invalidateQueries({ queryKey: ["mixture_inventory"] });
    },
  });
}

export function useReleaseBatch(batchId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.mixtureExecution.release(batchId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixture_batch", batchId] }),
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.mixtureExecution.createBatch,
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["mixture_batches", v.mixture_id] });
    },
  });
}
