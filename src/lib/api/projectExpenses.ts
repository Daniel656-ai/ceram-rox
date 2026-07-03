import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type ProjectExpenseInput = {
  project_id: string;
  work_package_id?: string | null;
  category_id?: string | null;
  name: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  total_price?: number | null;
  supplier?: string | null;
  cost_center?: string | null;
  project_leader_id?: string | null;
  expense_date?: string | null;
  notes?: string | null;
};

export const projectExpenseCategories = {
  list: () =>
    unwrap(
      dbClient
        .from("project_expense_categories")
        .select("*")
        .order("sort_order", { ascending: true })
    ),
};

export const projectExpenses = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_expenses")
        .select(
          "*, project_expense_categories(id, name_de, name_en), project_work_packages(id, title)"
        )
        .eq("project_id", projectId)
        .order("expense_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    ),

  listByWorkPackage: (workPackageId: string) =>
    unwrap(
      dbClient
        .from("project_expenses")
        .select("*, project_expense_categories(id, name_de, name_en)")
        .eq("work_package_id", workPackageId)
        .order("expense_date", { ascending: false, nullsFirst: false })
    ),

  create: (input: ProjectExpenseInput) =>
    unwrap(dbClient.from("project_expenses").insert(input as any).select().single()),

  update: (id: string, patch: Partial<ProjectExpenseInput>) =>
    unwrap(dbClient.from("project_expenses").update(patch as any).eq("id", id).select().single()),

  delete: (id: string) => run(dbClient.from("project_expenses").delete().eq("id", id)),
};
