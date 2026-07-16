import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface WorkflowProcessLink {
  id: string;
  workflow_template_id: string;
  process_template_id: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const TBL = "workflow_process_links" as const;

export const workflowProcessLinks = {
  listForWorkflow: (workflowId: string) =>
    unwrap(
      dbClient.from(TBL as any).select("*").eq("workflow_template_id", workflowId).order("order_index")
    ) as unknown as Promise<WorkflowProcessLink[]>,

  add: (workflowId: string, processId: string, orderIndex: number) =>
    run(
      dbClient
        .from(TBL as any)
        .insert({ workflow_template_id: workflowId, process_template_id: processId, order_index: orderIndex } as any)
    ),

  remove: (id: string) => run(dbClient.from(TBL as any).delete().eq("id", id)),

  reorder: async (rows: Array<{ id: string; order_index: number }>) => {
    for (const r of rows) {
      await run(dbClient.from(TBL as any).update({ order_index: r.order_index } as any).eq("id", r.id));
    }
  },

  setForWorkflow: async (workflowId: string, processIds: string[]) => {
    await run(dbClient.from(TBL as any).delete().eq("workflow_template_id", workflowId));
    if (processIds.length === 0) return;
    await run(
      dbClient
        .from(TBL as any)
        .insert(
          processIds.map((process_template_id, i) => ({
            workflow_template_id: workflowId,
            process_template_id,
            order_index: i,
          })) as any
        )
    );
  },
};
