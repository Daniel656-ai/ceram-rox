import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const measurementServices = {
  /** Active services only (catalog) – excludes archived. */
  listActive: () =>
    unwrap(
      dbClient
        .from("measurement_services")
        .select("*")
        .eq("active", true)
        .is("archived_at", null)
        .order("category")
        .order("service_name")
    ),

  /** Compact projection used by stats widgets. */
  listForStats: () =>
    unwrap(
      dbClient
        .from("measurement_services")
        .select("id, service_name, category, standard_duration_hours, active")
        .order("service_name")
    ),

  /** All services incl. inactive (admin). */
  listAll: () =>
    unwrap(
      dbClient
        .from("measurement_services")
        .select("*")
        .order("category")
        .order("service_name")
    ),

  create: (service: {
    service_name: string;
    category: string;
    hourly_rate: number;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    department?: string | null;
    price?: number | null;
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
      category?: string;
      standard_duration_hours?: number;
      description?: string | null;
      icon?: string | null;
      color?: string | null;
      department?: string | null;
      price?: number | null;
      work_instructions?: string | null;
      archived_at?: string | null;
    }
  ) =>
    run(
      dbClient.from("measurement_services").update(updates as any).eq("id", id)
    ),

  getById: (id: string) =>
    unwrap(dbClient.from("measurement_services").select("*").eq("id", id).single()),

  archive: (id: string) =>
    run(
      dbClient
        .from("measurement_services")
        .update({ archived_at: new Date().toISOString(), active: false } as any)
        .eq("id", id)
    ),

  unarchive: (id: string) =>
    run(
      dbClient
        .from("measurement_services")
        .update({ archived_at: null } as any)
        .eq("id", id)
    ),

  countReferences: async (id: string) => {
    const { data, error } = await dbClient.rpc("count_service_references" as any, { _service_id: id });
    if (error) throw error;
    return (data ?? {
      order_measurements: 0,
      project_services: 0,
      template_items: 0,
      measurement_results: 0,
    }) as {
      order_measurements: number;
      project_services: number;
      template_items: number;
      measurement_results: number;
    };
  },

  deleteSafe: async (id: string) => {
    const { error } = await dbClient.rpc("delete_service_safe" as any, { _service_id: id });
    if (error) throw error;
  },
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

  /** Lookup of parameter_name/unit for a given set of definition ids in a service. */
  listByIdsForService: (serviceId: string, ids: string[]) =>
    unwrap(
      dbClient
        .from("service_parameter_definitions")
        .select("id, parameter_name, unit")
        .eq("service_id", serviceId)
        .in("id", ids)
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
