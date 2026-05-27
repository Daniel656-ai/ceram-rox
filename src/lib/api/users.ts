import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface UserWithRole {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  short_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_roles: { role: string }[];
  custom_role_id: string | null;
  custom_role_name: string | null;
}

export const users = {
  async listWithRoles(): Promise<UserWithRole[]> {
    const [profilesRes, rolesRes, customRolesRes] = await Promise.all([
      dbClient.from("profiles").select("*"),
      dbClient.from("user_roles").select("user_id, role, custom_role_id"),
      dbClient.from("custom_roles").select("id, name"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (customRolesRes.error) throw customRolesRes.error;

    const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r]));
    const customRoleMap = new Map((customRolesRes.data || []).map((cr: any) => [cr.id, cr.name]));

    return (profilesRes.data || []).map((p: any) => {
      const ur = roleMap.get(p.user_id);
      return {
        ...p,
        user_roles: [{ role: ur?.role || "auftraggeber" }],
        custom_role_id: ur?.custom_role_id || null,
        custom_role_name: ur?.custom_role_id ? customRoleMap.get(ur.custom_role_id) || null : null,
      } as UserWithRole;
    });
  },

  async updateRole(userId: string, role: string, customRoleId?: string): Promise<void> {
    const update: any = { role };
    if (customRoleId !== undefined) update.custom_role_id = customRoleId;
    await run(dbClient.from("user_roles").update(update).eq("user_id", userId));
  },

  async updateStatus(userId: string, isActive: boolean): Promise<void> {
    await run(dbClient.from("profiles").update({ is_active: isActive }).eq("user_id", userId));
  },

  async adminInvoke(body: Record<string, unknown>) {
    const { data: { session } } = await dbClient.auth.getSession();
    if (!session) throw new Error("Nicht eingeloggt");
    const res = await dbClient.functions.invoke("admin-users", { body });
    if (res.error) throw new Error(res.error.message || "Fehler");
    if ((res.data as any)?.error) throw new Error((res.data as any).error);
    return res.data;
  },
};

export const profiles = {
  listByIds: (ids: string[]) =>
    unwrap(dbClient.from("profiles").select("user_id, first_name, last_name").in("user_id", ids)),
};
