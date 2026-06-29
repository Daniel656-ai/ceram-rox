import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const projectServices = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_services")
        .select("*, measurement_services(id, service_name, category, hourly_rate)")
        .eq("project_id", projectId)
        .order("booked_at", { ascending: false })
    ),

  create: (entry: { project_id: string; service_id: string; booked_by: string }) =>
    unwrap(dbClient.from("project_services").insert(entry as any).select().single()),

  delete: (id: string) => run(dbClient.from("project_services").delete().eq("id", id)),
};
