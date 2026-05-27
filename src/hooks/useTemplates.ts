import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["measurement-templates"],
    queryFn: () => api.templates.list(),
    enabled: !!user,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: { name: string; category?: string; description?: string; created_by: string; items: { service_id: string; sort_order: number }[] }) =>
      api.templates.create(template),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurement-templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; name: string; category?: string; description?: string; items: { service_id: string; sort_order: number }[] }) =>
      api.templates.update(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurement-templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.templates.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurement-templates"] }),
  });
}

// Apply template to samples - creates orders + measurements
export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      templateId: string;
      projectId: string;
      sampleIds: string[];
      createdBy: string;
      orderType: string;
      priority?: string;
      dueDate?: string;
    }) => api.templates.apply(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
