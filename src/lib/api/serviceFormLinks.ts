import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface ServiceFormLink {
  id: string;
  service_id: string;
  form_definition_id: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const TBL = "service_form_links" as const;

export const serviceFormLinks = {
  listForService: (serviceId: string) =>
    unwrap(
      dbClient.from(TBL as any).select("*").eq("service_id", serviceId).order("order_index")
    ) as unknown as Promise<ServiceFormLink[]>,

  listForForm: (formId: string) =>
    unwrap(
      dbClient.from(TBL as any).select("*").eq("form_definition_id", formId)
    ) as unknown as Promise<ServiceFormLink[]>,

  add: (serviceId: string, formId: string, orderIndex: number) =>
    run(
      dbClient
        .from(TBL as any)
        .insert({ service_id: serviceId, form_definition_id: formId, order_index: orderIndex } as any)
    ),

  remove: (id: string) => run(dbClient.from(TBL as any).delete().eq("id", id)),

  reorder: async (rows: Array<{ id: string; order_index: number }>) => {
    for (const r of rows) {
      await run(dbClient.from(TBL as any).update({ order_index: r.order_index } as any).eq("id", r.id));
    }
  },

  setForService: async (serviceId: string, formIds: string[]) => {
    await run(dbClient.from(TBL as any).delete().eq("service_id", serviceId));
    if (formIds.length === 0) return;
    await run(
      dbClient
        .from(TBL as any)
        .insert(
          formIds.map((form_definition_id, i) => ({
            service_id: serviceId,
            form_definition_id,
            order_index: i,
          })) as any
        )
    );
  },
};
