import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LabelLayout, LabelTemplate } from "@/lib/api/labelTemplates";

export const LABEL_TPL_KEY = ["label_templates"];

export function useLabelTemplates() {
  return useQuery({ queryKey: LABEL_TPL_KEY, queryFn: () => api.labelTemplates.list() });
}

export function useCreateLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; category: string; width_mm: number; height_mm: number; layout: LabelLayout; is_default?: boolean; created_by?: string | null }) =>
      api.labelTemplates.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: LABEL_TPL_KEY }),
  });
}

export function useUpdateLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LabelTemplate> }) =>
      api.labelTemplates.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: LABEL_TPL_KEY }),
  });
}

export function useDeleteLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.labelTemplates.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LABEL_TPL_KEY }),
  });
}

export function useDuplicateLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.labelTemplates.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LABEL_TPL_KEY }),
  });
}

export function usePrintHistoryByContainer(containerId: string | undefined) {
  return useQuery({
    queryKey: ["label_print_history", "container", containerId],
    queryFn: () => api.labelPrintHistory.listByContainer(containerId!),
    enabled: !!containerId,
  });
}

export function useLogPrintHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.labelPrintHistory.log,
    onSuccess: (_d, vars) => {
      if (vars.container_id) {
        qc.invalidateQueries({ queryKey: ["label_print_history", "container", vars.container_id] });
      }
    },
  });
}
