import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

async function callAdminUsers(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Nicht eingeloggt");

  const res = await supabase.functions.invoke("admin-users", {
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
    mutationFn: async (params: { userId: string; firstName: string; lastName: string }) =>
      callAdminUsers({ action: "update", ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
