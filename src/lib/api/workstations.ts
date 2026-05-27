import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const workstations = {
  list: () =>
    unwrap(dbClient.from("workstations").select("*").order("name")),

  create: (ws: {
    name: string;
    description?: string;
    status?: string;
    responsible_user_id?: string | null;
  }) => unwrap(dbClient.from("workstations").insert(ws).select().single()),

  update: (
    id: string,
    updates: {
      name?: string;
      description?: string;
      status?: string;
      responsible_user_id?: string | null;
    }
  ) =>
    unwrap(
      dbClient.from("workstations").update(updates).eq("id", id).select().single()
    ),

  delete: (id: string) =>
    run(dbClient.from("workstations").delete().eq("id", id)),
};

export const workstationTasks = {
  list: (workstationId: string) =>
    unwrap(
      dbClient
        .from("workstation_tasks")
        .select("*")
        .eq("workstation_id", workstationId)
        .order("created_at", { ascending: false })
    ),

  create: (task: {
    workstation_id: string;
    title: string;
    description?: string;
    assigned_to?: string | null;
    due_date?: string | null;
    hourly_rate?: number;
    status?: "open" | "in_progress" | "completed";
  }) =>
    unwrap(
      dbClient.from("workstation_tasks").insert([task]).select().single()
    ),

  update: (
    id: string,
    updates: {
      title?: string;
      description?: string;
      assigned_to?: string | null;
      due_date?: string | null;
      hourly_rate?: number;
      status?: "open" | "in_progress" | "completed";
    }
  ) =>
    unwrap(
      dbClient
        .from("workstation_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
    ),

  delete: (id: string) =>
    run(dbClient.from("workstation_tasks").delete().eq("id", id)),
};
