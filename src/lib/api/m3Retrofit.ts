import { dbClient } from "./client";
import { unwrap } from "./_helpers";

/** Proben-Nachprüfung bestehender m³-Beprobungsaufträge (Lesen + eine atomare Admin-RPC). */
export const m3Retrofit = {
  /** m³-Listen mit zugeordnetem Auftrag, inkl. Auftrag, Proben und Aufgaben (nur lesend). */
  listCandidates: () =>
    unwrap(
      dbClient
        .from("production_document_requests")
        .select(
          "id, order_id, based_on_release_id, form_values, measurement_orders(id, order_number, status, order_samples(sample_id, samples(id, sample_number, order_id)), order_measurements(id, service_id, sample_id, status, measurement_services(service_name), measurement_results(id)))"
        )
        .eq("doc_kind", "m3_list")
        .not("order_id", "is", null)
    ) as Promise<any[]>,

  samplesByNumbers: async (numbers: string[]) => {
    if (!numbers.length) return [] as Array<{ id: string; sample_number: string; order_id: string | null }>;
    return (await unwrap(dbClient.from("samples").select("id, sample_number, order_id").in("sample_number", numbers))) as Array<{ id: string; sample_number: string; order_id: string | null }>;
  },

  execute: async (orderId: string, plan: unknown) => {
    const { data, error } = await dbClient.rpc("m3_retrofit_order_samples" as any, { _order_id: orderId, _plan: plan as any });
    if (error) throw error;
    return data as { created: number; linked: number; assigned: number; new_tasks: number };
  },
};
