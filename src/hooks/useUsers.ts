import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [profilesRes, rolesRes, customRolesRes] = await Promise.all([
        api.from("profiles").select("*"),
        api.from("user_roles").select("user_id, role, custom_role_id"),
        api.from("custom_roles").select("id, name"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleMap = new Map(
        (rolesRes.data || []).map((r: any) => [r.user_id, r])
      );
      const customRoleMap = new Map(
        (customRolesRes.data || []).map((cr: any) => [cr.id, cr.name])
      );

      return (profilesRes.data || []).map((p: any) => {
        const userRole = roleMap.get(p.user_id);
        return {
          ...p,
          user_roles: [{ role: userRole?.role || "auftraggeber" }],
          custom_role_id: userRole?.custom_role_id || null,
          custom_role_name: userRole?.custom_role_id ? customRoleMap.get(userRole.custom_role_id) || null : null,
        };
      });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role, customRoleId }: { userId: string; role: string; customRoleId?: string }) => {
      const updateData: any = { role: role as any };
      if (customRoleId !== undefined) updateData.custom_role_id = customRoleId;
      const { error } = await api.from("user_roles").update(updateData).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await api.from("profiles").update({ is_active: isActive }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

async function callAdminUsers(body: Record<string, unknown>) {
  const { data: { session } } = await api.auth.getSession();
  if (!session) throw new Error("Nicht eingeloggt");

  const res = await api.functions.invoke("admin-users", {
    body,
  });

  if (res.error) throw new Error(res.error.message || "Fehler");
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
      shortCode: string;
      customRoleId?: string;
    }) => callAdminUsers({ action: "create", ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => callAdminUsers({ action: "delete", userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { userId: string; firstName: string; lastName: string; shortCode: string }) =>
      callAdminUsers({ action: "update", ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
