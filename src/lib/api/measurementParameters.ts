import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface MeasurementParameter {
  id: string;
  order_measurement_id: string;
  parameter_name: string;
  parameter_value: string | null;
  unit: string | null;
}

export const measurementParameters = {
  deleteByMeasurement: (measurementId: string) =>
    run(dbClient.from("measurement_parameters").delete().eq("order_measurement_id", measurementId)),
  bulkInsert: (rows: Array<{ order_measurement_id: string; parameter_name: string; parameter_value?: string | null; unit?: string | null }>) =>
    run(dbClient.from("measurement_parameters").insert(rows as any)),
  update: (
    id: string,
    updates: { parameter_name?: string; parameter_value?: string | null; unit?: string | null }
  ) => run(dbClient.from("measurement_parameters").update(updates).eq("id", id)),
  delete: (id: string) => run(dbClient.from("measurement_parameters").delete().eq("id", id)),
  insertOne: (row: { order_measurement_id: string; parameter_name: string; parameter_value?: string | null; unit?: string | null }) =>
    run(dbClient.from("measurement_parameters").insert(row as any)),
  /**
   * Nachträgliche Änderung einer bestehenden Auftraggeber-Vorgabe.
   * Serverseitig atomar (Wert + activity_log-Eintrag), prüft Berechtigung
   * (Master / Auftragsersteller), Status ≠ completed und Pflicht-Begründung.
   */
  amend: (parameterId: string, newValue: string, reason: string, label?: string) =>
    unwrap(
      dbClient.rpc("amend_order_spec" as any, {
        p_parameter_id: parameterId,
        p_new_value: newValue,
        p_reason: reason,
        p_label: label ?? null,
      }) as any
    ) as Promise<string>,
};
