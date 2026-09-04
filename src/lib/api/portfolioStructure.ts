import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const f = (t: string) => (dbClient.from as any)(t);
const rpc = (name: string, args: Record<string, any>) => unwrap((dbClient as any).rpc(name, args));

export type PortfolioWorkPackageStatus =
  | "geplant"
  | "in_arbeit"
  | "abgeschlossen"
  | "on_hold"
  | "abgebrochen";

export interface PortfolioWorkPackage {
  id: string;
  portfolio_id: string;
  code: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  is_active: boolean;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  status: PortfolioWorkPackageStatus;
  responsible_user_id: string | null;
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
  start_date: string | null;
  end_date: string | null;
  planned_effort_hours: number | null;
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
    ) as Promise<
      (PortfolioWorkPackage & {
        category?: { id: string; name: string } | null;
      })[]
    >,

  get: (id: string) =>
    unwrap(f("portfolio_work_packages").select("*").eq("id", id).single()) as Promise<PortfolioWorkPackage>,

  create: (input: {
    portfolio_id: string;
    name: string;
    code?: string | null;
    description?: string | null;
    category_id?: string | null;
    sort_order?: number;
    start_date?: string | null;
    end_date?: string | null;
    budget?: number | null;
    status?: PortfolioWorkPackageStatus;
    responsible_user_id?: string | null;
    is_active?: boolean;
  }) => unwrap(f("portfolio_work_packages").insert(input).select().single()) as Promise<PortfolioWorkPackage>,

  update: (
    id: string,
    updates: Partial<Omit<PortfolioWorkPackage, "id" | "portfolio_id" | "created_at" | "updated_at">>
  ) => run(f("portfolio_work_packages").update(updates).eq("id", id)),

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
    ) as Promise<
      (PortfolioTask & {
        portfolio_work_package: { id: string; name: string; portfolio_id: string; sort_order: number };
      })[]
    >,

  get: (id: string) =>
    unwrap(f("portfolio_tasks").select("*").eq("id", id).single()) as Promise<PortfolioTask>,

  create: (input: {
    portfolio_work_package_id: string;
    name: string;
    code?: string | null;
    description?: string | null;
    sort_order?: number;
    status?: PortfolioTaskStatus;
    start_date?: string | null;
    end_date?: string | null;
    planned_effort_hours?: number | null;
  }) => unwrap(f("portfolio_tasks").insert(input).select().single()) as Promise<PortfolioTask>,

  update: (
    id: string,
    updates: Partial<Omit<PortfolioTask, "id" | "portfolio_work_package_id" | "created_at" | "updated_at">>
  ) => run(f("portfolio_tasks").update(updates).eq("id", id)),

  remove: (id: string) => run(f("portfolio_tasks").delete().eq("id", id)),
};

// ---------- Mapping: Portfolio-AP <-> Projekt-AP ----------
export interface PortfolioWpProjectWpMap {
  id: string;
  portfolio_work_package_id: string;
  project_work_package_id: string;
  funding_relevant: boolean;
  funding_share_pct: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type MappedProjectWp = PortfolioWpProjectWpMap & {
  project_work_package: {
    id: string;
    title: string;
    status: string | null;
    project: { id: string; project_number: string | null; project_name: string | null; project_status: string | null } | null;
  } | null;
};

export const portfolioWpProjectMap = {
  listByPortfolioWp: (portfolioWpId: string) =>
    unwrap(
      f("portfolio_wp_project_wp_map")
        .select(
          "*, project_work_package:project_work_packages(id,title,status,project:projects(id,project_number,project_name,project_status))"
        )
        .eq("portfolio_work_package_id", portfolioWpId)
        .order("created_at", { ascending: true })
    ) as Promise<MappedProjectWp[]>,

  add: (input: {
    portfolio_work_package_id: string;
    project_work_package_id: string;
    funding_relevant?: boolean;
    funding_share_pct?: number;
    note?: string | null;
  }) => unwrap(f("portfolio_wp_project_wp_map").insert(input).select().single()),

  update: (
    id: string,
    updates: Partial<Pick<PortfolioWpProjectWpMap, "funding_relevant" | "funding_share_pct" | "note">>
  ) => run(f("portfolio_wp_project_wp_map").update(updates).eq("id", id)),

  remove: (id: string) => run(f("portfolio_wp_project_wp_map").delete().eq("id", id)),
};

// ---------- Mapping: Portfolio-Task <-> Projekt-AP ----------
export interface PortfolioTaskProjectWpMap {
  id: string;
  portfolio_task_id: string;
  project_work_package_id: string;
  funding_relevant: boolean;
  funding_share_pct: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type MappedTaskProjectWp = PortfolioTaskProjectWpMap & {
  project_work_package: {
    id: string;
    title: string;
    status: string | null;
    project: { id: string; project_number: string | null; project_name: string | null; project_status: string | null } | null;
  } | null;
};

export const portfolioTaskProjectMap = {
  listByPortfolioTask: (portfolioTaskId: string) =>
    unwrap(
      f("portfolio_task_project_wp_map")
        .select(
          "*, project_work_package:project_work_packages(id,title,status,project:projects(id,project_number,project_name,project_status))"
        )
        .eq("portfolio_task_id", portfolioTaskId)
        .order("created_at", { ascending: true })
    ) as Promise<MappedTaskProjectWp[]>,

  add: (input: {
    portfolio_task_id: string;
    project_work_package_id: string;
    funding_relevant?: boolean;
    funding_share_pct?: number;
    note?: string | null;
  }) => unwrap(f("portfolio_task_project_wp_map").insert(input).select().single()),

  update: (
    id: string,
    updates: Partial<Pick<PortfolioTaskProjectWpMap, "funding_relevant" | "funding_share_pct" | "note">>
  ) => run(f("portfolio_task_project_wp_map").update(updates).eq("id", id)),

  remove: (id: string) => run(f("portfolio_task_project_wp_map").delete().eq("id", id)),
};

// ---------- Auswahlquelle: alle Projekt-APs mit Projekt-Info ----------
export const projectWorkPackagesLookup = {
  listAll: () =>
    unwrap(
      f("project_work_packages")
        .select("id,title,status,start_date,end_date,project:projects(id,project_number,project_name,project_status)")
        .order("created_at", { ascending: false })
        .limit(2000)
    ) as Promise<any[]>,
  /**
   * Nur Projekt-APs, deren Projekt Mitglied des Portfolios ist. Optional inaktive (completed) ausschließen.
   */
  listForPortfolio: async (
    portfolioId: string,
    opts: { activeOnly?: boolean; categoryId?: string | null } = { activeOnly: true }
  ) => {
    const members = (await unwrap(
      f("project_portfolio_members").select("project_id").eq("portfolio_id", portfolioId)
    )) as Array<{ project_id: string }>;
    const projectIds = members.map((m) => m.project_id);
    if (projectIds.length === 0) return [] as any[];
    let query = f("project_work_packages")
      .select("id,title,status,start_date,end_date,category_id,project:projects(id,project_number,project_name,project_status)")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (opts.activeOnly) query = query.in("status", ["planned", "in_progress"]);
    if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
    return (await unwrap(query)) as any[];
  },
  unassignedFunding: () =>
    unwrap(
      f("v_project_wp_without_funding")
        .select("*")
        .limit(500)
    ) as Promise<any[]>,
  /** Alle Projekt-AP -> Portfolio-AP Zuordnungen (mit Namen). */
  listAllWpAssignments: () =>
    unwrap(
      f("portfolio_wp_project_wp_map")
        .select("project_work_package_id, portfolio_work_package_id, portfolio_work_package:portfolio_work_packages(id,code,name)")
    ) as Promise<Array<{
      project_work_package_id: string;
      portfolio_work_package_id: string;
      portfolio_work_package: { id: string; code: string | null; name: string } | null;
    }>>,
  /** Alle Projekt-AP -> Portfolio-Task Zuordnungen (mit Namen und Parent-AP). */
  listAllTaskAssignments: () =>
    unwrap(
      f("portfolio_task_project_wp_map")
        .select("project_work_package_id, portfolio_task_id, portfolio_task:portfolio_tasks(id,code,name,portfolio_work_package_id)")
    ) as Promise<Array<{
      project_work_package_id: string;
      portfolio_task_id: string;
      portfolio_task: { id: string; code: string | null; name: string; portfolio_work_package_id: string } | null;
    }>>,
};

// ---------- Audit-Log ----------
export const portfolioStructureAudit = {
  listByPortfolio: (portfolioId: string, limit = 200) =>
    unwrap(
      f("portfolio_structure_audit_log")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("changed_at", { ascending: false })
        .limit(limit)
    ) as Promise<any[]>,
};

// ----- FFG analytics -----
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
  /** Stunden je Portfolio-Arbeitspaket; enthält eine Zeile „Nicht zugeordnet". */
  ffgSummary: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_ffg_summary", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<
      Array<{
        work_package_id: string | null;
        work_package_code: string | null;
        work_package_name: string;
        category_id: string | null;
        category_name: string | null;
        hours: number;
        entries_count: number;
      }>
    >,
  /** Stunden je Mitarbeiter und Projekt – direkt aus den Arbeitszeitbuchungen. */
  hoursByPersonProject: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_hours_by_person_project", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<
      Array<{
        person_id: string;
        person_name: string;
        short_code: string | null;
        project_id: string;
        project_number: string | null;
        project_name: string;
        work_package_id: string | null;
        work_package_name: string | null;
        hours: number;
        entries_count: number;
      }>
    >,
  /** Diagnose auffälliger Verknüpfungen (fehlende Zuordnungen, Dubletten …). */
  diagnostics: (portfolioId: string, start?: string | null, end?: string | null) =>
    rpc("get_portfolio_ffg_diagnostics", { _portfolio_id: portfolioId, _start: start ?? null, _end: end ?? null }) as Promise<
      Array<{ issue: string; severity: string; reference: string | null; detail: string | null; hours: number }>
    >,
};

