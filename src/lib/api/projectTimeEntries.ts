import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

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

  create: (entry: {
    project_id: string;
    person_id: string;
    entry_date: string;
    duration_minutes: number;
    note: string;
    order_id?: string;
    created_by: string;
  }) =>
    unwrap(
      dbClient
        .from("project_time_entries")
        .insert(entry)
        .select()
        .single()
    ),

  update: (
    id: string,
    updates: {
      person_id?: string;
      entry_date?: string;
      duration_minutes?: number;
      note?: string;
    }
  ) => run(dbClient.from("project_time_entries").update(updates).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("project_time_entries").delete().eq("id", id)),
};
