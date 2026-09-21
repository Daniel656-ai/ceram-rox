import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import { normalizeRoles, primaryRole, mergePermissions } from "@/lib/roles";

export interface UserWithRole {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  short_code: string | null;
  is_active: boolean;
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
  user_roles: { role: string }[];
  /** Primäre Rolle (größter Funktionsumfang) – Abwärtskompatibilität. */
  custom_role_id: string | null;
  custom_role_name: string | null;
  /** Alle zugewiesenen Rollen. */
  custom_role_ids: string[];
  custom_role_names: string[];
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

    const rowsByUser = new Map<string, any[]>();
    for (const r of (rolesRes.data || []) as any[]) {
      const list = rowsByUser.get(r.user_id) ?? [];
      list.push(r);
      rowsByUser.set(r.user_id, list);
    }
    const customRoleMap = new Map((customRolesRes.data || []).map((cr: any) => [cr.id, cr.name]));

    return (profilesRes.data || []).map((p: any) => {
      const rows = rowsByUser.get(p.user_id) ?? [];
      const roles = normalizeRoles(rows.map((r) => r.role));
      const effective = roles.length > 0 ? roles : (["auftraggeber"] as const);
      const ids = rows.map((r) => r.custom_role_id).filter(Boolean) as string[];
      const primary = primaryRole(effective as string[]);
      const primaryRow = rows.find((r) => r.role === primary) ?? rows[0];
      return {
        ...p,
        user_roles: effective.map((role) => ({ role })),
        custom_role_id: primaryRow?.custom_role_id || null,
        custom_role_name: primaryRow?.custom_role_id
          ? customRoleMap.get(primaryRow.custom_role_id) || null
          : null,
        custom_role_ids: ids,
        custom_role_names: ids.map((id) => customRoleMap.get(id) || "").filter(Boolean),
      } as UserWithRole;
    });
  },

  async updateRole(userId: string, role: string, customRoleId?: string): Promise<void> {
    const update: any = { role };
    if (customRoleId !== undefined) update.custom_role_id = customRoleId;
    await run(dbClient.from("user_roles").update(update).eq("user_id", userId));
  },

  /**
   * Mehrere Rollen gleichzeitig zuweisen. Je Basisrolle existiert genau eine
   * Zeile (bestehende Datenstruktur), die Rollen bleiben eigenständig.
   */
  async setRoles(
    userId: string,
    selection: { customRoleId: string; baseRole: string }[],
  ): Promise<void> {
    const byBase = new Map<string, string>();
    for (const s of selection) {
      if (byBase.has(s.baseRole)) {
        throw new Error(
          "Pro Rollenart ist gleichzeitig nur eine Rolle möglich (z. B. nicht Auftraggeber und PO zusammen).",
        );
      }
      byBase.set(s.baseRole, s.customRoleId);
    }
    const existing = ((await unwrap(
      dbClient.from("user_roles").select("id, role, custom_role_id").eq("user_id", userId),
    )) ?? []) as any[];

    const obsolete = existing.filter((r) => !byBase.has(r.role)).map((r) => r.id);
    if (obsolete.length > 0) {
      await run(dbClient.from("user_roles").delete().in("id", obsolete));
    }
    for (const [baseRole, customRoleId] of byBase) {
      const row = existing.find((r) => r.role === baseRole);
      if (row) {
        if (row.custom_role_id !== customRoleId) {
          await run(
            dbClient.from("user_roles").update({ custom_role_id: customRoleId }).eq("id", row.id),
          );
        }
      } else {
        await run(
          dbClient.from("user_roles").insert({ user_id: userId, role: baseRole as any, custom_role_id: customRoleId }),
        );
      }
    }
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
  /**
   * Load everything needed by the AuthContext for the given user in one call:
   * profile, all base roles, custom role ids+names and the union of all
   * permission keys of the assigned roles.
   */
  async loadAuthContext(userId: string) {
    const [profileRes, roleRes] = await Promise.all([
      dbClient.from("profiles").select("*").eq("user_id", userId).single(),
      dbClient.from("user_roles").select("role, custom_role_id").eq("user_id", userId),
    ]);

    const profile = profileRes.data ?? null;
    const rows = (roleRes.data ?? []) as any[];
    const roles = normalizeRoles(rows.map((r) => r.role));
    const role = primaryRole(roles);
    const customRoleIds = rows.map((r) => r.custom_role_id).filter(Boolean) as string[];
    const primaryRowId =
      (rows.find((r) => r.role === role)?.custom_role_id as string | undefined) ?? null;

    let customRoleNames: string[] = [];
    let permissions: string[] = [];

    if (customRoleIds.length > 0) {
      const [crRes, permRes] = await Promise.all([
        dbClient.from("custom_roles").select("id, name").in("id", customRoleIds),
        dbClient.from("role_permissions").select("permission_key").in("role_id", customRoleIds),
      ]);
      const nameById = new Map(((crRes.data ?? []) as any[]).map((r) => [r.id, r.name]));
      customRoleNames = customRoleIds.map((id) => nameById.get(id) || "").filter(Boolean);
      // Summe der Berechtigungen: keine Rolle überschreibt eine andere.
      permissions = mergePermissions([((permRes.data ?? []) as any[]).map((p) => p.permission_key)]);
    }

    const customRoleId = primaryRowId ?? customRoleIds[0] ?? null;
    const nameIndex = customRoleIds.indexOf(customRoleId ?? "");
    const customRoleName = nameIndex >= 0 ? customRoleNames[nameIndex] ?? null : null;

    return { profile, role, roles, customRoleId, customRoleName, customRoleIds, customRoleNames, permissions };
  },

  async clearMustChangePassword(userId: string): Promise<void> {
    await run(dbClient.from("profiles").update({ must_change_password: false }).eq("user_id", userId));
  },

  async logPasswordEvent(params: {
    targetUserId: string;
    performedBy: string | null;
    action: "admin_reset" | "self_change" | "forgot_reset" | "initial_set";
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await run(
      dbClient.from("password_reset_log").insert({
        target_user_id: params.targetUserId,
        performed_by: params.performedBy ?? undefined,
        action: params.action,
        metadata: (params.metadata ?? null) as any,
      })
    );
  },
};




export const profiles = {
  listByIds: (ids: string[]) =>
    unwrap(dbClient.from("profiles").select("user_id, first_name, last_name").in("user_id", ids)),
};
