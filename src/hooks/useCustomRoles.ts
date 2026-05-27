import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type { CustomRole } from "@/lib/api/customRoles";

export function useCustomRoles() {
  return useQuery({ queryKey: ["custom_roles"], queryFn: () => api.customRoles.listWithPermissions() });
}

export function useCreateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; description: string; base_role: string; permissions: string[] }) =>
      api.customRoles.create(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_roles"] }),
  });
}

export function useUpdateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; name: string; description: string; base_role: string; permissions: string[] }) =>
      api.customRoles.update(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom_roles"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.customRoles.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_roles"] }),
  });
}
