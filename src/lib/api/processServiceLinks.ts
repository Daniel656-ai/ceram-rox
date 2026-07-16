import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface ProcessServiceLink {
  id: string;
  process_template_id: string;
  service_id: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const TBL = "process_service_links" as const;

export const processServiceLinks = {
  listForProcess: (processId: string) =>
    unwrap(
      dbClient.from(TBL as any).select("*").eq("process_template_id", processId).order("order_index")
    ) as unknown as Promise<ProcessServiceLink[]>,

  listForService: (serviceId: string) =>
    unwrap(
      dbClient.from(TBL as any).select("*").eq("service_id", serviceId)
    ) as unknown as Promise<ProcessServiceLink[]>,

  add: (processId: string, serviceId: string, orderIndex: number) =>
    run(
      dbClient
        .from(TBL as any)
        .insert({ process_template_id: processId, service_id: serviceId, order_index: orderIndex } as any)
    ),

  remove: (id: string) => run(dbClient.from(TBL as any).delete().eq("id", id)),

  reorder: async (rows: Array<{ id: string; order_index: number }>) => {
    for (const r of rows) {
      await run(dbClient.from(TBL as any).update({ order_index: r.order_index } as any).eq("id", r.id));
    }
  },

  setForProcess: async (processId: string, serviceIds: string[]) => {
    await run(dbClient.from(TBL as any).delete().eq("process_template_id", processId));
    if (serviceIds.length === 0) return;
    await run(
      dbClient
        .from(TBL as any)
        .insert(
          serviceIds.map((service_id, i) => ({
            process_template_id: processId,
            service_id,
            order_index: i,
          })) as any
        )
    );
  },
};
