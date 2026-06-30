import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface ServiceWorkflowRow {
  id: string;
  service_id: string;
  definition: any;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceWorkflows = {
  getForService: async (serviceId: string): Promise<ServiceWorkflowRow | null> => {
    const { data, error } = await dbClient
      .from("service_workflows" as any)
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as ServiceWorkflowRow) ?? null;
  },
  upsert: (serviceId: string, definition: any, updatedBy: string | null) =>
    run(
      dbClient
        .from("service_workflows" as any)
        .upsert({ service_id: serviceId, definition, updated_by: updatedBy } as any, { onConflict: "service_id" })
    ),
};
