import { dbClient } from "./client";
import { unwrap } from "./_helpers";

const FIELDS = `id, change_type, order_id, order_measurement_id, measurement_result_id, service_id,
  parameter_name, parameter_label, unit, old_value, new_value, old_text, new_text,
  old_sample_id, new_sample_id, old_sample_number, new_sample_number,
  affected_result_count, reason, changed_by, changed_at`;

export interface ResultCorrection {
  id: string;
  change_type: "value" | "sample_reassignment";
  order_id: string | null;
  order_measurement_id: string;
  measurement_result_id: string | null;
  service_id: string | null;
  parameter_name: string | null;
  parameter_label: string | null;
  unit: string | null;
  old_value: number | null;
  new_value: number | null;
  old_text: string | null;
  new_text: string | null;
  old_sample_id: string | null;
  new_sample_id: string | null;
  old_sample_number: string | null;
  new_sample_number: string | null;
  affected_result_count: number | null;
  reason: string;
  changed_by: string;
  changed_at: string;
}

/**
 * Unveränderbarer Audit-Trail für nachträgliche Korrekturen an Messergebnissen.
 * Einträge entstehen ausschließlich serverseitig über die Korrektur-Funktionen.
 */
export const resultCorrections = {
  listForOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from("measurement_result_corrections")
        .select(FIELDS)
        .eq("order_id", orderId)
        .order("changed_at", { ascending: false })
    ) as Promise<ResultCorrection[]>,

  listForMeasurement: (measurementId: string) =>
    unwrap(
      dbClient
        .from("measurement_result_corrections")
        .select(FIELDS)
        .eq("order_measurement_id", measurementId)
        .order("changed_at", { ascending: false })
    ) as Promise<ResultCorrection[]>,

  listForResult: (resultId: string) =>
    unwrap(
      dbClient
        .from("measurement_result_corrections")
        .select(FIELDS)
        .eq("measurement_result_id", resultId)
        .order("changed_at", { ascending: false })
    ) as Promise<ResultCorrection[]>,

  /** Korrigiert einen einzelnen Ergebniswert (Begründung ist Pflicht). */
  correctValue: (params: { resultId: string; newValue: number; reason: string }) =>
    unwrap(
      (dbClient as any).rpc("correct_measurement_result", {
        p_result_id: params.resultId,
        p_new_value: params.newValue,
        p_reason: params.reason,
      })
    ),

  /** Ordnet einen kompletten Messdatensatz einer anderen Probe des Auftrags zu. */
  reassignSample: (params: { measurementId: string; newSampleId: string; reason: string }) =>
    unwrap(
      (dbClient as any).rpc("reassign_measurement_sample", {
        p_measurement_id: params.measurementId,
        p_new_sample_id: params.newSampleId,
        p_reason: params.reason,
      })
    ),
};
