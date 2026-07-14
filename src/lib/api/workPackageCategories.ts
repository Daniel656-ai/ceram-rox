import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface WorkPackageCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

const f = (t: string) => (dbClient.from as any)(t);

export const workPackageCategories = {
  list: () =>
    unwrap(
      f("work_package_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    ) as Promise<WorkPackageCategory[]>,

  create: (input: { name: string; description?: string | null; sort_order?: number }) =>
    unwrap(
      f("work_package_categories")
        .insert({ ...input, is_system: false })
        .select()
        .single()
    ) as Promise<WorkPackageCategory>,

  update: (id: string, updates: Partial<Pick<WorkPackageCategory, "name" | "description" | "sort_order">>) =>
    run(f("work_package_categories").update(updates).eq("id", id)),

  remove: (id: string) => run(f("work_package_categories").delete().eq("id", id)),
};
