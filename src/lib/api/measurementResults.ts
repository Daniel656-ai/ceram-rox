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
  }) =>
    unwrap(
      dbClient.from("measurement_results").insert(result).select().single()
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
    }
  ) => run(dbClient.from("measurement_results").update(updates).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("measurement_results").delete().eq("id", id)),
};
