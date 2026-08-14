import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const SAMPLE_FIELDS =
  "id, sample_number, sample_name, description, is_hazardous, status, project_id";

/** Erweiterte Probenfelder für den Proben-Tab (Status, Lagerort, Entsorgung). */
const SAMPLE_FIELDS_FULL = `${SAMPLE_FIELDS}, location_id, disposal_method, disposal_category,
   post_measurement_action, updated_at, storage_locations:location_id(id, hall, room, shelf, position)`;


/**
 * Zuordnung Auftrag ↔ Proben (n:m).
 *
 * Ersetzt die bisherige Einzelzuordnung `measurement_orders.sample_id`,
 * die als „erste Probe" weiterhin gepflegt wird (Rückwärtskompatibilität).
 */
export const orderSamples = {
  list: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_samples")
        .select(
          `id, order_id, sample_id, created_at, is_replacement, replaces_order_sample_id,
           replaced_by_order_sample_id, replacement_reason, replacement_note, replaced_at, replaced_by,
           samples(${SAMPLE_FIELDS})`
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    ),

  /**
   * Bucht eine Ersatzprobe für eine bereits zugeordnete Probe.
   * Die ursprüngliche Zuordnung bleibt erhalten und wird lediglich verknüpft.
   */
  bookReplacement: (params: {
    orderId: string;
    originalSampleId: string;
    replacementSampleId: string;
    reason: string;
    note?: string | null;
  }) =>
    unwrap(
      (dbClient as any).rpc("book_replacement_sample", {
        p_order_id: params.orderId,
        p_original_sample_id: params.originalSampleId,
        p_replacement_sample_id: params.replacementSampleId,
        p_reason: params.reason,
        p_note: params.note ?? null,
      })
    ),

  add: async (orderId: string, sampleIds: string[], createdBy?: string) => {
    if (sampleIds.length === 0) return;
    await unwrap(
      dbClient
        .from("order_samples")
        .upsert(
          sampleIds.map((sample_id) => ({
            order_id: orderId,
            sample_id,
            created_by: createdBy ?? null,
          })) as any,
          { onConflict: "order_id,sample_id", ignoreDuplicates: true }
        )
        .select("id")
    );
    await orderSamples.syncPrimary(orderId);
  },

  remove: async (orderId: string, sampleId: string) => {
    await run(
      dbClient
        .from("order_samples")
        .delete()
        .eq("order_id", orderId)
        .eq("sample_id", sampleId)
    );
    await orderSamples.syncPrimary(orderId);
  },

  /**
   * Hält `measurement_orders.sample_id` auf der ersten zugeordneten Probe,
   * damit bestehende Ansichten/Reports weiter funktionieren.
   */
  syncPrimary: async (orderId: string) => {
    const rows: any = await unwrap(
      dbClient
        .from("order_samples")
        .select("sample_id, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
        .limit(1)
    );
    const first = rows?.[0]?.sample_id ?? null;
    await run(
      dbClient
        .from("measurement_orders")
        .update({ sample_id: first } as any)
        .eq("id", orderId)
    );
  },

  /**
   * Rohdaten für die aggregierte Ergebnisübersicht eines Auftrags:
   * Aufgaben je Probe inkl. Dienstleistung und Ergebniswerten.
   */
  resultsOverview: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .select(
          `id, sample_id, original_sample_id, service_id, status, measurement_number,
           measurement_services(id, service_name),
           samples:samples!order_measurements_sample_id_fkey(${SAMPLE_FIELDS}),
           original_sample:samples!order_measurements_original_sample_id_fkey(${SAMPLE_FIELDS}),
           measurement_results(id, result_name, display_label, value, unit, is_official, measured_at)`
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    ),
};
