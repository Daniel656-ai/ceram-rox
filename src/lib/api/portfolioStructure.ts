import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const f = (t: string) => (dbClient.from as any)(t);
const rpc = (name: string, args: Record<string, any>) => unwrap((dbClient as any).rpc(name, args));

export interface PortfolioWorkPackage {
  id: string;
  portfolio_id: string;
  code: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PortfolioTaskStatus = "offen" | "in_arbeit" | "erledigt";

export interface PortfolioTask {
  id: string;
  portfolio_work_package_id: string;
  code: string | null;
  name: string;
  description: string | null;
  status: PortfolioTaskStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const portfolioWorkPackages = {
  listByPortfolio: (portfolioId: string) =>
    unwrap(
      f("portfolio_work_packages")
        .select("*, category:work_package_categories(id,name)")
        .eq("portfolio_id", portfolioId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    ) as Promise<(PortfolioWorkPackage & { category?: { id: string; name: string } | null })[]>,

  create: (input: {
    portfolio_id: string;
    name: string;
    code?: string | null;
    description?: string | null;
    category_id?: string | null;
    sort_order?: number;
  }) => unwrap(f("portfolio_work_packages").insert(input).select().single()) as Promise<PortfolioWorkPackage>,

  update: (id: string, updates: Partial<Omit<PortfolioWorkPackage, "id" | "portfolio_id" | "created_at" | "updated_at">>) =>
    run(f("portfolio_work_packages").update(updates).eq("id", id)),

  remove: (id: string) => run(f("portfolio_work_packages").delete().eq("id", id)),
};

export const portfolioTasks = {
  listByWorkPackage: (workPackageId: string) =>
    unwrap(
      f("portfolio_tasks")
        .select("*")
        .eq("portfolio_work_package_id", workPackageId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    ) as Promise<PortfolioTask[]>,

  listByPortfolio: (portfolioId: string) =>
    unwrap(
      f("portfolio_tasks")
        .select("*, portfolio_work_package:portfolio_work_packages!inner(id,name,portfolio_id,sort_order)")
        .eq("portfolio_work_package.portfolio_id", portfolioId)
        .order("sort_order", { ascending: true })
    ) as Promise<(PortfolioTask & { portfolio_work_package: { id: string; name: string; portfolio_id: string; sort_order: number } })[]>,

  create: (input: {
    portfolio_work_package_id: string;
    name: string;
    code?: string | null;
    description?: string | null;
    sort_order?: number;
  }) => unwrap(f("portfolio_tasks").insert(input).select().single()) as Promise<PortfolioTask>,

  update: (id: string, updates: Partial<Omit<PortfolioTask, "id" | "portfolio_work_package_id" | "created_at" | "updated_at">>) =>
    run(f("portfolio_tasks").update(updates).eq("id", id)),

  remove: (id: string) => run(f("portfolio_tasks").delete().eq("id", id)),
};

// ----- New FFG analytics -----
export const portfolioFfgAnalytics = {
  hoursByWorkPackage: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_hours_by_work_package", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<any[]>,
  hoursByTask: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_hours_by_task", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<any[]>,
  hoursByCategory: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_hours_by_category", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<any[]>,
  costsByWorkPackage: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_costs_by_work_package", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<any[]>,
  costsByCategory: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_costs_by_category", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<any[]>,
  ffgSummary: (portfolioId: string) =>
    rpc("get_portfolio_ffg_summary", { _portfolio_id: portfolioId }) as Promise<
      Array<{
        work_package_id: string;
        work_package_code: string | null;
        work_package_name: string;
        category_id: string | null;
        category_name: string | null;
        hours: number;
      }>
    >,
};
