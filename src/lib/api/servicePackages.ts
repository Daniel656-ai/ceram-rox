import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServicePackageItem {
  id: string;
  package_id: string;
  service_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServicePackageWithItems extends ServicePackage {
  items: (ServicePackageItem & {
    measurement_services: {
      id: string;
      service_name: string;
      category: string | null;
      hourly_rate: number | null;
      standard_duration_hours: number | null;
      workstation_id: string | null;
      active: boolean;
      archived_at: string | null;
    } | null;
  })[];
}

export const servicePackages = {
  list: (opts?: { includeInactive?: boolean }) =>
    unwrap(
      dbClient
        .from("service_packages" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    ).then((rows: any[]) =>
      (opts?.includeInactive ? rows : rows.filter((r) => r.is_active)) as ServicePackage[]
    ),

  listWithItems: async (opts?: { includeInactive?: boolean }): Promise<ServicePackageWithItems[]> => {
    const { data, error } = await dbClient
      .from("service_packages" as any)
      .select(
        `*, items:service_package_items(*, measurement_services(id, service_name, category, hourly_rate, standard_duration_hours, workstation_id, active, archived_at))`
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as any[];
    const filtered = opts?.includeInactive ? rows : rows.filter((r) => r.is_active);
    return filtered.map((r) => ({
      ...r,
      items: (r.items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    })) as ServicePackageWithItems[];
  },

  getById: async (id: string): Promise<ServicePackageWithItems | null> => {
    const { data, error } = await dbClient
      .from("service_packages" as any)
      .select(
        `*, items:service_package_items(*, measurement_services(id, service_name, category, hourly_rate, standard_duration_hours, workstation_id, active, archived_at))`
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as any;
    return {
      ...row,
      items: (row.items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    } as ServicePackageWithItems;
  },

  create: (input: { name: string; description?: string | null; is_active?: boolean; sort_order?: number; created_by?: string | null }) =>
    unwrap(
      dbClient
        .from("service_packages" as any)
        .insert({
          name: input.name,
          description: input.description ?? null,
          is_active: input.is_active ?? true,
          sort_order: input.sort_order ?? 0,
          created_by: input.created_by ?? null,
        } as any)
        .select()
        .single()
    ) as unknown as Promise<ServicePackage>,

  update: (id: string, patch: Partial<Pick<ServicePackage, "name" | "description" | "is_active" | "sort_order">>) =>
    run(dbClient.from("service_packages" as any).update(patch as any).eq("id", id)),

  delete: (id: string) => run(dbClient.from("service_packages" as any).delete().eq("id", id)),

  // Items
  addItem: (packageId: string, serviceId: string, sortOrder?: number) =>
    run(
      dbClient
        .from("service_package_items" as any)
        .insert({ package_id: packageId, service_id: serviceId, sort_order: sortOrder ?? 0 } as any)
    ),

  removeItem: (itemId: string) =>
    run(dbClient.from("service_package_items" as any).delete().eq("id", itemId)),

  reorderItems: async (orders: Array<{ id: string; sort_order: number }>) => {
    for (const o of orders) {
      await run(
        dbClient
          .from("service_package_items" as any)
          .update({ sort_order: o.sort_order } as any)
          .eq("id", o.id)
      );
    }
  },
};
