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

  /**
   * Werte aller Globalen Formulare, die innerhalb desselben Auftrags (optional
   * derselben Probe) bereits erfasst wurden – Grundlage für die Wertquelle
   * „Wert aus verknüpftem Formular“.
   *
   * Rein lesend: es entsteht kein zweiter Speicherort. Die Werte liegen
   * weiterhin ausschließlich als Ergebnisse ihrer Ursprungsmessung vor
   * (`measurement_results.result_name = "form:<form_id>:<field_key>"`).
   *
   * Die bestehende Zuordnung Auftrag → Messung → Probe bleibt maßgeblich: Es
   * werden nur Messungen derselben Probe berücksichtigt, sofern eine Probe am
   * aktuellen Vorgang hängt. Dadurch bleiben getrennte Vermessungen
   * unterschiedlicher Proben strikt getrennt.
   */
  listFormValuesForOrder: async (
    orderId: string,
    sampleId?: string | null,
    excludeMeasurementId?: string | null,
  ): Promise<Record<string, Record<string, unknown>>> => {
    const rows = (await unwrap(
      dbClient
        .from("order_measurements")
        .select(
          `id, sample_id, updated_at,
           measurement_results(result_name, value, remarks, measured_at)`
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    )) as any[];

    const out: Record<string, Record<string, unknown>> = {};
    for (const m of rows ?? []) {
      if (excludeMeasurementId && m.id === excludeMeasurementId) continue;
      if (sampleId && m.sample_id && m.sample_id !== sampleId) continue;
      for (const r of m.measurement_results ?? []) {
        const name: string = r.result_name ?? "";
        if (!name.startsWith("form:")) continue;
        const rest = name.slice("form:".length);
        const idx = rest.indexOf(":");
        if (idx <= 0) continue;
        const formId = rest.slice(0, idx);
        const fieldKey = rest.slice(idx + 1);
        const value = r.value != null ? r.value : r.remarks;
        if (value == null || value === "") continue;
        (out[formId] ??= {})[fieldKey] = value;
      }
    }
    return out;
  },

  delete: (id: string) =>
    run(dbClient.from("measurement_results").delete().eq("id", id)),
};

