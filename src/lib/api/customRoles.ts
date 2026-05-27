import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  base_role: string;
  is_system: boolean;
  created_at: string;
  permissions: string[];
}

export const customRoles = {
  async listWithPermissions(): Promise<CustomRole[]> {
    const [rolesRes, permsRes] = await Promise.all([
      dbClient.from("custom_roles").select("*").order("created_at"),
      dbClient.from("role_permissions").select("*"),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (permsRes.error) throw permsRes.error;
    const map = new Map<string, string[]>();
    for (const p of permsRes.data || []) {
      const arr = map.get(p.role_id) || [];
      arr.push(p.permission_key);
      map.set(p.role_id, arr);
    }
    return (rolesRes.data || []).map((r: any) => ({ ...r, permissions: map.get(r.id) || [] }));
  },

  async create(params: { name: string; description: string; base_role: string; permissions: string[] }) {
    const role = await unwrap(
      dbClient
        .from("custom_roles")
        .insert({ name: params.name, description: params.description, base_role: params.base_role as any })
        .select()
        .single()
    );
    if (params.permissions.length > 0) {
      await run(
        dbClient
          .from("role_permissions")
          .insert(params.permissions.map((p) => ({ role_id: (role as any).id, permission_key: p })))
      );
    }
    return role;
  },

  async update(params: { id: string; name: string; description: string; base_role: string; permissions: string[] }) {
    await run(
      dbClient
        .from("custom_roles")
        .update({ name: params.name, description: params.description, base_role: params.base_role as any })
        .eq("id", params.id)
    );
    await run(dbClient.from("role_permissions").delete().eq("role_id", params.id));
    if (params.permissions.length > 0) {
      await run(
        dbClient
          .from("role_permissions")
          .insert(params.permissions.map((p) => ({ role_id: params.id, permission_key: p })))
      );
    }
  },

  async delete(id: string) {
    await run(dbClient.from("custom_roles").delete().eq("id", id));
  },
};
