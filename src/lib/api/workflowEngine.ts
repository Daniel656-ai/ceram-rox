import { dbClient } from "./client";

/**
 * Thin wrapper around the wf_* RPCs defined in Phase 2.
 * All state transitions of an order_instance MUST go through here.
 */
export const workflowEngine = {
  seedFromTemplate: async (orderInstanceId: string, templateId: string) => {
    const { data, error } = await dbClient.rpc("wf_seed_from_template" as any, {
      _order_id: orderInstanceId,
      _template_id: templateId,
    } as any);
    if (error) throw error;
    return data as number;
  },

  startStep: async (stepRunId: string) => {
    const { error } = await dbClient.rpc("wf_start_step" as any, { _run_id: stepRunId } as any);
    if (error) throw error;
  },

  completeStep: async (
    stepRunId: string,
    response: Record<string, unknown> = {},
    notes: string | null = null
  ) => {
    const { error } = await dbClient.rpc("wf_complete_step" as any, {
      _run_id: stepRunId,
      _response: response as any,
      _notes: notes,
    } as any);
    if (error) throw error;
  },

  finalizeOrder: async (orderInstanceId: string) => {
    const { error } = await dbClient.rpc("wf_finalize_order" as any, {
      _order_id: orderInstanceId,
    } as any);
    if (error) throw error;
  },
};
