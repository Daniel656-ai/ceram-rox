import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const f = (t: string) => (dbClient.from as any)(t);

export type PortfolioStatus = "planung" | "aktiv" | "pausiert" | "abgeschlossen" | "abgebrochen";
export type PortfolioMilestoneType = "antrag" | "genehmigung" | "zwischenbericht" | "review" | "abschluss" | "sonstiges";
export type PortfolioMilestoneStatus = "offen" | "erledigt" | "ueberfaellig";
export type PortfolioDocumentCategory =
  | "foerderantrag" | "foerdervertrag" | "zwischenbericht" | "endbericht"
  | "praesentation" | "publikation" | "patent" | "nachweis" | "sonstiges";

export interface Portfolio {
  id: string;
  name: string;
  short_code: string | null;
  description: string | null;
  category: string | null;
  funding_program: string | null;
  funding_body: string | null;
  start_date: string | null;
  end_date: string | null;
  status: PortfolioStatus;
  responsible_user_id: string | null;
  planned_budget: number | null;
  approved_budget: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const projectPortfolios = {
  list: () =>
    unwrap(f("project_portfolios").select("*").order("created_at", { ascending: false })) as Promise<Portfolio[]>,

  get: (id: string) =>
    unwrap(f("project_portfolios").select("*").eq("id", id).single()) as Promise<Portfolio>,

  create: (input: Partial<Portfolio>) =>
    unwrap(f("project_portfolios").insert(input).select().single()) as Promise<Portfolio>,

  update: (id: string, updates: Partial<Portfolio>) =>
    run(f("project_portfolios").update(updates).eq("id", id)),

  delete: (id: string) => run(f("project_portfolios").delete().eq("id", id)),
};

export const portfolioMembers = {
  listForPortfolio: (portfolioId: string) =>
    unwrap(
      f("project_portfolio_members")
        .select("*, projects(id, project_number, project_name, status, start_date, end_date)")
        .eq("portfolio_id", portfolioId)
        .order("created_at", { ascending: true })
    ),

  listForProject: (projectId: string) =>
    unwrap(f("project_portfolio_members").select("*, project_portfolios(id, name, short_code, status)").eq("project_id", projectId)),

  add: (input: { portfolio_id: string; project_id: string; contribution_goal?: string; contribution_summary?: string; current_status?: string; key_results?: string }) =>
    unwrap(f("project_portfolio_members").insert(input).select().single()),

  update: (id: string, updates: Record<string, any>) =>
    run(f("project_portfolio_members").update(updates).eq("id", id)),

  remove: (id: string) => run(f("project_portfolio_members").delete().eq("id", id)),
};

export const portfolioPeriods = {
  list: (portfolioId: string) =>
    unwrap(f("project_portfolio_periods").select("*").eq("portfolio_id", portfolioId).order("start_date", { ascending: true })),
  create: (input: { portfolio_id: string; name: string; start_date: string; end_date: string; notes?: string }) =>
    unwrap(f("project_portfolio_periods").insert(input).select().single()),
  update: (id: string, updates: Record<string, any>) =>
    run(f("project_portfolio_periods").update(updates).eq("id", id)),
  remove: (id: string) => run(f("project_portfolio_periods").delete().eq("id", id)),
};

export const portfolioMilestones = {
  list: (portfolioId: string) =>
    unwrap(f("project_portfolio_milestones").select("*").eq("portfolio_id", portfolioId).order("due_date", { ascending: true, nullsFirst: false })),
  create: (input: Record<string, any>) =>
    unwrap(f("project_portfolio_milestones").insert(input).select().single()),
  update: (id: string, updates: Record<string, any>) =>
    run(f("project_portfolio_milestones").update(updates).eq("id", id)),
  remove: (id: string) => run(f("project_portfolio_milestones").delete().eq("id", id)),
};

export const portfolioDocuments = {
  list: (portfolioId: string) =>
    unwrap(f("project_portfolio_documents").select("*").eq("portfolio_id", portfolioId).order("created_at", { ascending: false })),
  create: (input: Record<string, any>) =>
    unwrap(f("project_portfolio_documents").insert(input).select().single()),
  update: (id: string, updates: Record<string, any>) =>
    run(f("project_portfolio_documents").update(updates).eq("id", id)),
  remove: (id: string) => run(f("project_portfolio_documents").delete().eq("id", id)),
};
