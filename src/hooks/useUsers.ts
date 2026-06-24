import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => api.users.listWithRoles() });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role, customRoleId }: { userId: string; role: string; customRoleId?: string }) =>
      api.users.updateRole(userId, role, customRoleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.users.updateStatus(userId, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
      shortCode: string;
      customRoleId?: string;
    }) => api.users.adminInvoke({ action: "create", ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.users.adminInvoke({ action: "delete", userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; firstName: string; lastName: string; shortCode: string }) =>
      api.users.adminInvoke({ action: "update", ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; password: string }) =>
      api.users.adminInvoke({ action: "reset_password", ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

