import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useServicePermissions() {
  return useQuery({
    queryKey: ["mdl-service-permissions"],
    queryFn: () => api.servicePermissions.list(),
  });
}

export function useToggleServicePermission() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ userId, serviceId, granted }: { userId: string; serviceId: string; granted: boolean }) =>
      granted
        ? api.servicePermissions.grant(userId, serviceId, user!.id)
        : api.servicePermissions.revoke(userId, serviceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mdl-service-permissions"] }),
  });
}

export function usePermissionAuditLog() {
  return useQuery({
    queryKey: ["mdl-permission-audit"],
    queryFn: () => api.servicePermissions.auditLog(),
  });
}
