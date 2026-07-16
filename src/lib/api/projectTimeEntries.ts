import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

type Scope =
  | { project_id: string; portfolio_id?: undefined }
  | { portfolio_id: string; project_id?: undefined };

export const projectTimeEntries = {
  list: (projectId: string, orderId?: string) => {
    let q = dbClient
      .from("project_time_entries")
      .select("*")
      .eq("project_id", projectId)
      .order("entry_date", { ascending: false });
    if (orderId) q = q.eq("order_id", orderId);
    return unwrap(q);
  },

  listForPortfolio: (portfolioId: string) =>
    unwrap(
      dbClient
        .from("project_time_entries")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("entry_date", { ascending: false })
    ),

  create: (entry: Scope & {
    person_id: string;
    entry_date: string;
    duration_minutes: number;
    note: string;
    order_id?: string;
    work_package_id?: string | null;
    portfolio_work_package_id?: string | null;
    portfolio_task_id?: string | null;
    created_by: string;
  }) =>
    unwrap(
      (dbClient.from("project_time_entries") as any)
        .insert({ ...entry, entry_type: "individual" })
        .select()
        .single()
    ),

  createMeeting: async (meeting: Scope & {
    person_ids: string[];
    entry_date: string;
    duration_minutes: number;
    note: string;
    order_id?: string;
    work_package_id?: string | null;
    portfolio_work_package_id?: string | null;
    portfolio_task_id?: string | null;
    created_by: string;
  }) => {
    const meeting_group_id = (globalThis.crypto as any).randomUUID();
    const rows = meeting.person_ids.map((pid) => ({
      project_id: (meeting as any).project_id ?? null,
      portfolio_id: (meeting as any).portfolio_id ?? null,
      person_id: pid,
      entry_date: meeting.entry_date,
      duration_minutes: meeting.duration_minutes,
      note: meeting.note,
      order_id: meeting.order_id,
      work_package_id: meeting.work_package_id ?? null,
      portfolio_work_package_id: meeting.portfolio_work_package_id ?? null,
      portfolio_task_id: meeting.portfolio_task_id ?? null,
      created_by: meeting.created_by,
      entry_type: "meeting",
      meeting_group_id,
    }));
    return unwrap((dbClient.from("project_time_entries") as any).insert(rows).select());
  },

  update: (
    id: string,
    updates: {
      person_id?: string;
      entry_date?: string;
      duration_minutes?: number;
      note?: string;
      work_package_id?: string | null;
      portfolio_work_package_id?: string | null;
      portfolio_task_id?: string | null;
    }
  ) => run((dbClient.from("project_time_entries") as any).update(updates).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("project_time_entries").delete().eq("id", id)),
};
