import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import { buildLinkedFormValues } from "@/lib/linkedFormValues";
import type { PrecisionDefinitions } from "@/lib/resultDisplayPrecision";

export const measurementResults = {
  /** Official result database, with read-only order identity metadata. */
  listOfficialDatabase: () => unwrap(
    dbClient.from("order_measurements").select(`
      id, measurement_number, status, assigned_to, actual_duration_hours, service_id,
      created_at, updated_at, sample_id, original_sample_id,
      samples!order_measurements_sample_id_fkey(id, sample_number, sample_name),
      original_sample:samples!order_measurements_original_sample_id_fkey(id, sample_number, sample_name),
      measurement_services(service_name, category, standard_duration_hours),
      measurement_orders(
        id, order_number, order_type, order_kind, pp_experiment_number, created_by, notes,
        order_measurements(measurement_services(category)),
        projects(project_number, project_name),
        samples!measurement_orders_sample_id_fkey(id, sample_number, sample_name)
      ),
      measurement_results!inner(id, result_name, value, unit, temperature_range_from, temperature_range_to, temperature_unit, remarks, measured_at, display_label, is_official, instance_key, instance_label, instance_context)
    `).eq("measurement_results.is_official", true).order("updated_at", { ascending: false })
  ),
  listDatabaseProfiles: () => unwrap(dbClient.from("profiles").select("user_id, first_name, last_name")),
  /** Read-only display metadata. Missing access/schema retains the old formatting. */
  listDisplayPrecisionDefinitions: async (serviceIds: string[], formIds: string[]): Promise<PrecisionDefinitions> => {
    const [fields, calculations, serviceFields] = await Promise.all([
      formIds.length ? unwrap(dbClient.from("form_fields").select("id,form_id,field_key,decimal_places,parent_field_id,field_type,metadata").in("form_id", formIds)).catch(() => []) : [],
      formIds.length ? unwrap(dbClient.from("form_calculations").select("form_id,calc_key,decimals").in("form_id", formIds)).catch(() => []) : [],
      serviceIds.length ? unwrap(dbClient.from("service_data_fields").select("service_id,field_key,decimal_places").in("service_id", serviceIds)).catch(() => []) : [],
    ]);
    return { fields, calculations, serviceFields } as PrecisionDefinitions;
  },

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
           measurement_results(result_name, value, remarks, measured_at, is_official)`
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    )) as any[];

    // Auflösung inkl. messungsbezogener Ergebnisse aus Messdatenblöcken
    // (`<block>[<messung>].<field_key>`), siehe `@/lib/linkedFormValues`.
    return buildLinkedFormValues(rows as any, { sampleId, excludeMeasurementId });
  },

  delete: (id: string) =>
    run(dbClient.from("measurement_results").delete().eq("id", id)),
};

