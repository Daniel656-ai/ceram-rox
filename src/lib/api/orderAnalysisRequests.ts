import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const orderAnalysisRequests = {
  listForOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_analysis_requests")
        .select(
          "*, measurement_services(id, service_name, category, standard_duration_hours)"
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    ),

  create: (req: {
    order_id: string;
    service_id: string;
    quantity?: number;
    notes?: string | null;
    created_by?: string | null;
  }) =>
    unwrap(
      dbClient
        .from("order_analysis_requests")
        .insert({
          order_id: req.order_id,
          service_id: req.service_id,
          quantity: req.quantity ?? 1,
          notes: req.notes ?? null,
          created_by: req.created_by ?? null,
        } as any)
        .select()
        .single()
    ),

  update: (
    id: string,
    fields: { quantity?: number; notes?: string | null }
  ) =>
    run(
      dbClient
        .from("order_analysis_requests")
        .update(fields as any)
        .eq("id", id)
    ),

  delete: (id: string) =>
    run(dbClient.from("order_analysis_requests").delete().eq("id", id)),

  /** Turn a request into an actual order_measurement bound to a sample. */
  assignToSample: async (requestId: string, sampleId: string) => {
    const { data, error } = await (dbClient as any).rpc(
      "assign_analysis_request_to_sample",
      { _request_id: requestId, _sample_id: sampleId }
    );
    if (error) throw error;
    return data as string;
  },
};
