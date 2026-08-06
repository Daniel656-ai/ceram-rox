/**
 * Portfolio-Controlling: dynamische Auswertungen über frei wählbare Zeiträume
 * und beliebige Filterkombinationen.
 *
 * Es werden KEINE Auswertungsdaten gespeichert – alles wird live aus den
 * bestehenden Modulen berechnet (Single Source of Truth).
 */
import { dbClient } from "./client";
import { unwrap } from "./_helpers";

const f = (t: string) => (dbClient.from as any)(t);
const rpc = (name: string, args: Record<string, any>) =>
  unwrap((dbClient as any).rpc(name, args));

export interface ControllingFilters {
  start?: string | null;
  end?: string | null;
  portfolio_ids?: string[];
  project_ids?: string[];
  category_ids?: string[];
  leader_ids?: string[];
  person_ids?: string[];
  work_package_ids?: string[];
  task_ids?: string[];
  cost_centers?: string[];
  statuses?: string[];
  /** "ja" | "nein" | null */
  funding?: string | null;
}

export interface ControllingSummary {
  hours_total: number;
  entries_count: number;
  people_count: number;
  project_count: number;
  active_count: number;
  closed_count: number;
  wp_count: number;
  task_count: number;
  sample_count: number;
  service_count: number;
  orders_completed: number;
  orders_total: number;
  avg_lead_days: number | null;
  personnel_cost: number;
  material_cost: number;
  external_cost: number;
  travel_cost: number;
  other_cost: number;
  expenses_cost: number;
  cost_total: number;
  budget_total: number;
  budget_remaining: number;
}

export interface ControllingGroupRow {
  id?: string;
  code?: string | null;
  label: string;
  hours?: number;
  entries?: number;
  projects?: number;
  total?: number;
  kind?: string;
}

export interface ControllingCostProjectRow {
  id: string;
  code: string;
  label: string;
  hours: number;
  personnel: number;
  material: number;
  external: number;
  travel: number;
  other: number;
  total: number;
  budget: number;
  funded: boolean;
  status: string;
}

export interface ControllingMonthRow {
  month: string;
  hours: number;
  personal: number;
  material: number;
  external: number;
  travel: number;
  other: number;
  total: number;
}

export interface ControllingHoursJournalRow {
  id: string;
  date: string;
  project_number: string;
  project_name: string;
  person: string;
  work_package: string;
  task: string;
  focus: string;
  type: string;
  hours: number;
  note: string | null;
}

export interface ControllingCostJournalRow {
  date: string;
  kind: string;
  category: string;
  project_number: string;
  project_name: string;
  work_package: string;
  cost_center: string | null;
  description: string;
  amount: number;
}

export interface ControllingReport {
  can_view_personnel_costs: boolean;
  summary: ControllingSummary;
  hours_by_project: ControllingGroupRow[];
  hours_by_person: ControllingGroupRow[];
  hours_by_work_package: ControllingGroupRow[];
  hours_by_task: ControllingGroupRow[];
  hours_by_focus: ControllingGroupRow[];
  costs_by_project: ControllingCostProjectRow[];
  costs_by_work_package: ControllingGroupRow[];
  costs_by_category: ControllingGroupRow[];
  by_month: ControllingMonthRow[];
  hours_journal: ControllingHoursJournalRow[];
  cost_journal: ControllingCostJournalRow[];
}

export interface ControllingFilterOptions {
  portfolios: { id: string; label: string }[];
  projects: { id: string; label: string }[];
  categories: { id: string; label: string }[];
  people: { id: string; label: string }[];
  workPackages: { id: string; label: string }[];
  tasks: { id: string; label: string }[];
  costCenters: { id: string; label: string }[];
}

const sel = (s: string): string => s;

export const portfolioControlling = {
  report: (filters: ControllingFilters) =>
    rpc("get_portfolio_controlling_report", {
      _filters: {
        start: filters.start ?? null,
        end: filters.end ?? null,
        portfolio_ids: filters.portfolio_ids ?? [],
        project_ids: filters.project_ids ?? [],
        category_ids: filters.category_ids ?? [],
        leader_ids: filters.leader_ids ?? [],
        person_ids: filters.person_ids ?? [],
        work_package_ids: filters.work_package_ids ?? [],
        task_ids: filters.task_ids ?? [],
        cost_centers: filters.cost_centers ?? [],
        statuses: filters.statuses ?? [],
        funding: filters.funding ?? null,
      },
    }) as Promise<ControllingReport>,

  async filterOptions(): Promise<ControllingFilterOptions> {
    const [portfolios, projects, categories, people, pfWps, prWps, tasks, expenses] =
      await Promise.all([
        unwrap(f("project_portfolios").select(sel("id, name, short_code")).order("name")),
        unwrap(
          f("projects").select(sel("id, project_number, project_name")).order("project_number")
        ),
        unwrap(f("work_package_categories").select(sel("id, name")).order("sort_order")),
        unwrap(
          f("profiles").select(sel("user_id, first_name, last_name, short_code")).order("last_name")
        ),
        unwrap(f("portfolio_work_packages").select(sel("id, code, name")).order("code")),
        unwrap(f("project_work_packages").select(sel("id, title")).order("title")),
        unwrap(f("portfolio_tasks").select(sel("id, code, name")).order("code")),
        unwrap(f("project_expenses").select(sel("cost_center"))),
      ]);

    const uniqueCostCenters = Array.from(
      new Set(
        ((expenses ?? []) as any[])
          .map((r) => (r.cost_center ?? "").trim())
          .filter((v: string) => v.length > 0)
      )
    ).sort();

    return {
      portfolios: ((portfolios ?? []) as any[]).map((p) => ({
        id: p.id,
        label: p.short_code ? `${p.short_code} · ${p.name}` : p.name,
      })),
      projects: ((projects ?? []) as any[]).map((p) => ({
        id: p.id,
        label: `${p.project_number} · ${p.project_name}`,
      })),
      categories: ((categories ?? []) as any[]).map((c) => ({ id: c.id, label: c.name })),
      people: ((people ?? []) as any[]).map((p) => ({
        id: p.user_id,
        label:
          [p.first_name, p.last_name].filter(Boolean).join(" ") || p.short_code || "Unbekannt",
      })),
      workPackages: [
        ...((pfWps ?? []) as any[]).map((w) => ({
          id: w.id,
          label: `${w.code ? w.code + " · " : ""}${w.name} (Portfolio)`,
        })),
        ...((prWps ?? []) as any[]).map((w) => ({ id: w.id, label: `${w.title} (Projekt)` })),
      ],
      tasks: ((tasks ?? []) as any[]).map((t) => ({
        id: t.id,
        label: `${t.code ? t.code + " · " : ""}${t.name}`,
      })),
      costCenters: uniqueCostCenters.map((c) => ({ id: c, label: c })),
    };
  },
};
