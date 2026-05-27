import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useServicePermissions() {
  return useQuery({
    queryKey: ["mdl-service-permissions"],
    queryFn: async () => {
      const { data, error } = await api
        .from("mdl_service_permissions")
        .select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useToggleServicePermission() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, serviceId, granted }: { userId: string; serviceId: string; granted: boolean }) => {
      if (granted) {
        const { error } = await api
          .from("mdl_service_permissions")
          .insert({ user_id: userId, service_id: serviceId, granted_by: user!.id });
        if (error) throw error;
      } else {
        const { error } = await api
          .from("mdl_service_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("service_id", serviceId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mdl-service-permissions"] }),
  });
}

export function usePermissionAuditLog() {
  return useQuery({
    queryKey: ["mdl-permission-audit"],
    queryFn: async () => {
      const { data, error } = await api
        .from("mdl_permission_audit_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}
