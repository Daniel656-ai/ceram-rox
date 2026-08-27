import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const measurementResults = {
  list: (measurementId: string) =>
    unwrap(
      dbClient
        .from("measurement_results")
        .select("*")
        .eq("order_measurement_id", measurementId)
        .order("created_at")
    ),

  create: (result: {
    order_measurement_id: string;
    result_name: string;
    unit?: string;
    value?: number;
    temperature_range_from?: number;
    temperature_range_to?: number;
    temperature_unit?: string;
    remarks?: string;
    measured_at?: string;
    measured_by?: string;
    /** Nur als „Offizielles Ergebnis" markierte Werte erscheinen in der Ergebnisdatenbank. */
    is_official?: boolean;
    /** Fachliche Bezeichnung für die Anzeige (nie technische IDs). */
    display_label?: string | null;
    /** Kennung der konkreten Messung innerhalb eines Messdatenblocks. */
    instance_key?: string | null;
    /** Fachliche Bezeichnung der Messung (z. B. „Kalibriert“). */
    instance_label?: string | null;
    /** Messkontext (Präparation, Analyseart …). */
    instance_context?: Record<string, string> | null;
  }) =>
    unwrap(
      dbClient.from("measurement_results").insert(result as any).select().single()
    ),

  update: (
    id: string,
    updates: {
      result_name?: string;
      unit?: string;
      value?: number;
      temperature_range_from?: number;
      temperature_range_to?: number;
      temperature_unit?: string;
      remarks?: string;
      measured_at?: string;
      measured_by?: string;
      is_official?: boolean;
      display_label?: string | null;
      instance_key?: string | null;
      instance_label?: string | null;
      instance_context?: Record<string, string> | null;
    }
  ) => run(dbClient.from("measurement_results").update(updates as any).eq("id", id)),


  /**
   * Alle Ergebniswerte eines Auftrags inkl. `remarks` (JSON-Werte komplexer
   * Feldtypen, z. B. Bildsammlungen der Fotodokumentation).
   */
  listForOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .select(
          `id, measurement_number,
           measurement_services(service_name),
           samples:samples!order_measurements_sample_id_fkey(sample_number, sample_name),
           measurement_results(id, result_name, display_label, remarks, measured_at)`
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    ),

  delete: (id: string) =>
    run(dbClient.from("measurement_results").delete().eq("id", id)),
};

