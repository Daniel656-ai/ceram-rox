import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const measurementServices = {
  /** Active services only (catalog). */
  listActive: () =>
    unwrap(
      dbClient
        .from("measurement_services")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("service_name")
    ),

  /** All services incl. inactive, with workstation join (admin). */
  listAll: () =>
    unwrap(
      dbClient
        .from("measurement_services")
        .select("*, workstations(id, name)")
        .order("category")
        .order("service_name")
    ),

  create: (service: {
    service_name: string;
    category: string;
    hourly_rate: number;
    responsible_user_id?: string | null;
    workstation_id?: string | null;
  }) =>
    unwrap(
      dbClient.from("measurement_services").insert(service as any).select().single()
    ),

  update: (
    id: string,
    updates: {
      hourly_rate?: number;
      active?: boolean;
      service_name?: string;
      responsible_user_id?: string | null;
      workstation_id?: string | null;
      standard_duration_hours?: number;
    }
  ) =>
    run(
      dbClient.from("measurement_services").update(updates as any).eq("id", id)
    ),
};

export const measurementUsers = {
  /** Users with roles 'durchfuehrer' or 'master', joined with their active profile. */
  async listDurchfuehrer() {
    const roles = await unwrap(
      dbClient
        .from("user_roles")
        .select("user_id")
        .in("role", ["durchfuehrer", "master"])
    );
    const ids = (roles || []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];
    return unwrap(
      dbClient
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", ids)
        .eq("is_active", true)
    );
  },
};

// ============================================================
// Service parameter definitions
// ============================================================
export const serviceParameters = {
  listForService: (serviceId: string) =>
    unwrap(
      dbClient
        .from("service_parameter_definitions")
        .select("*")
        .eq("service_id", serviceId)
        .order("parameter_category")
        .order("sort_order")
    ),

  listAll: () =>
    unwrap(
      dbClient
        .from("service_parameter_definitions")
        .select("*")
        .order("sort_order")
    ),

  create: (def: Record<string, any>) =>
    unwrap(
      dbClient
        .from("service_parameter_definitions")
        .insert(def as any)
        .select()
        .single()
    ),

  update: (id: string, updates: Record<string, any>) =>
    run(
      dbClient
        .from("service_parameter_definitions")
        .update(updates as any)
        .eq("id", id)
    ),

  delete: (id: string) =>
    run(dbClient.from("service_parameter_definitions").delete().eq("id", id)),
};

// ============================================================
// MDL service permissions (competence matrix)
// ============================================================
export const servicePermissions = {
  list: () =>
    unwrap(dbClient.from("mdl_service_permissions").select("*")),

  grant: (userId: string, serviceId: string, grantedBy: string) =>
    run(
      dbClient
        .from("mdl_service_permissions")
        .insert({ user_id: userId, service_id: serviceId, granted_by: grantedBy })
    ),

  revoke: (userId: string, serviceId: string) =>
    run(
      dbClient
        .from("mdl_service_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("service_id", serviceId)
    ),

  auditLog: () =>
    unwrap(
      dbClient
        .from("mdl_permission_audit_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(100)
    ),
};
