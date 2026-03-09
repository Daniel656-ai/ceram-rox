import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  base_role: string;
  is_system: boolean;
  created_at: string;
  permissions: string[];
}

export function useCustomRoles() {
  return useQuery({
    queryKey: ["custom_roles"],
    queryFn: async () => {
      const [rolesRes, permsRes] = await Promise.all([
        supabase.from("custom_roles").select("*").order("created_at"),
        supabase.from("role_permissions").select("*"),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (permsRes.error) throw permsRes.error;

      const permsByRole = new Map<string, string[]>();
      for (const p of permsRes.data || []) {
        const existing = permsByRole.get(p.role_id) || [];
        existing.push(p.permission_key);
        permsByRole.set(p.role_id, existing);
      }

      return (rolesRes.data || []).map((r: any) => ({
        ...r,
        permissions: permsByRole.get(r.id) || [],
      })) as CustomRole[];
    },
  });
}

export function useCreateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; description: string; base_role: string; permissions: string[] }) => {
      const { data: role, error } = await supabase
        .from("custom_roles")
        .insert({ name: params.name, description: params.description, base_role: params.base_role as any })
        .select()
        .single();
      if (error) throw error;

      if (params.permissions.length > 0) {
        const { error: permError } = await supabase
          .from("role_permissions")
          .insert(params.permissions.map((p) => ({ role_id: role.id, permission_key: p })));
        if (permError) throw permError;
      }
      return role;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_roles"] }),
  });
}

export function useUpdateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; name: string; description: string; base_role: string; permissions: string[] }) => {
      const { error } = await supabase
        .from("custom_roles")
        .update({ name: params.name, description: params.description, base_role: params.base_role as any })
        .eq("id", params.id);
      if (error) throw error;

      // Delete existing permissions and re-insert
      const { error: delError } = await supabase.from("role_permissions").delete().eq("role_id", params.id);
      if (delError) throw delError;

      if (params.permissions.length > 0) {
        const { error: permError } = await supabase
          .from("role_permissions")
          .insert(params.permissions.map((p) => ({ role_id: params.id, permission_key: p })));
        if (permError) throw permError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom_roles"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_roles"] }),
  });
}
