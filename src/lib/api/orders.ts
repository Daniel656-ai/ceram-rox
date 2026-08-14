import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import type { OrderType, OrderPriority } from "@/lib/types";

const ORDER_LIST_SELECT =
  "*, projects(project_number, project_name), order_measurements(assigned_to)";

const ORDER_DETAIL_SELECT = `*, projects(project_number, project_name), samples!measurement_orders_sample_id_fkey(id, sample_number, sample_name, description, is_hazardous, location_id, storage_locations(hall, room, shelf, position)), order_samples(id, sample_id, created_at, samples(id, sample_number, sample_name, description, is_hazardous)), order_measurements(*, samples!order_measurements_sample_id_fkey(id, sample_number, sample_name), original_sample:samples!order_measurements_original_sample_id_fkey(id, sample_number, sample_name), measurement_services(service_name, category, hourly_rate, standard_duration_hours), measurement_parameters(*), measurement_results(*), work_logs(*), documents(*))`;

export const orders = {
  list: () =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(ORDER_LIST_SELECT)
        .order("ranking", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
    ),

  get: (id: string) =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(ORDER_DETAIL_SELECT)
        .eq("id", id)
        .maybeSingle()
    ),

  create: (order: {
    project_id: string;
    order_type: OrderType;
    created_by: string;
    due_date?: string;
    notes?: string;
    priority?: OrderPriority;
    sample_id?: string;
    order_kind?: "pilot_plant" | "labor" | "combined" | "legacy";
    pp_experiment_number?: string | null;
    pp_v2o5_percent?: number | null;
    pp_experiment_date?: string | null;
    pp_issuer_user_id?: string | null;
    pp_previous_experiments?: string | null;
    pp_experiment_kind?: string | null;
    pp_masse_type?: "DK" | "GK" | "KK" | "MK" | "PK" | null;
    pp_remarks?: string | null;
  }) =>
    unwrap(dbClient.from("measurement_orders").insert(order as any).select().single()),

  update: (
    id: string,
    fields: Partial<{
      order_type: OrderType;
      due_date: string | null;
      notes: string | null;
      priority: OrderPriority;
      order_kind: "pilot_plant" | "labor" | "combined" | "legacy";
      pp_experiment_number: string | null;
      pp_v2o5_percent: number | null;
      pp_experiment_date: string | null;
      pp_issuer_user_id: string | null;
      pp_previous_experiments: string | null;
      pp_experiment_kind: string | null;
      pp_masse_type: "DK" | "GK" | "KK" | "MK" | "PK" | null;
      pp_remarks: string | null;
      workflow_status:
        | "entwurf" | "geplant" | "pp_in_progress" | "pp_completed"
        | "samples_created" | "waiting_analysis" | "analysis_in_progress"
        | "results_complete" | "abgeschlossen";
    }>
  ) =>
    run(
      dbClient
        .from("measurement_orders")
        .update(fields as any)
        .eq("id", id)
    ),

  updateStatus: (id: string, status: string) =>
    run(
      dbClient
        .from("measurement_orders")
        .update({ status: status as any })
        .eq("id", id)
    ),

  updateRanking: (id: string, ranking: number | null) =>
    run(
      dbClient
        .from("measurement_orders")
        .update({ ranking } as any)
        .eq("id", id)
    ),

  delete: async (id: string) => {
    const rows: any = await unwrap(
      dbClient.from("measurement_orders").delete().eq("id", id).select("id")
    );
    if (!rows || rows.length === 0) {
      throw new Error(
        "Auftrag konnte nicht gelöscht werden (keine Berechtigung oder Auftrag ist gesperrt)."
      );
    }
  },

  /** Reduced list used by the ETA calculator. */
  listOpenForETA: () =>
    unwrap(
      dbClient
        .from("measurement_orders")
        .select(
          "id, sample_id, priority, created_at, status, order_measurements(id, status, processing_time_hours, planned_hours)"
        )
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true })
    ),

  auditLog: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_audit_log")
        .select("*")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: false })
    ),

  /**
   * Kopiert einen bestehenden Auftrag als neuen, vollständig unabhängigen
   * Entwurf. Der Originalauftrag bleibt unverändert.
   *
   * Übernommen: Auftraggeber (created_by = kopierender Benutzer), Projekt,
   * Auftragsart, Dienstleistungen/Aufgaben inkl. Parameter & Formularwerte,
   * Prozess-/Workflow-Konfiguration (Vorlage), Anhänge, Beschreibungen,
   * Bemerkungen und sämtliche Konfigurationsfelder.
   *
   * Nicht übernommen: Auftragsnummer, Aufgaben-/Bearbeitungsstatus,
   * Zuweisungen, Messwerte, Ergebnisse, Berichte, Zeitbuchungen, Historie,
   * Workflow-Instanzen und alle systemseitig erzeugten Identifikatoren.
   */
  async copy(orderId: string, createdBy: string): Promise<{ id: string }> {
    const src: any = await unwrap(
      dbClient.from("measurement_orders").select("*").eq("id", orderId).single()
    );

    const newOrder: any = await unwrap(
      dbClient
        .from("measurement_orders")
        .insert({
          project_id: src.project_id,
          order_type: src.order_type,
          order_kind: src.order_kind,
          created_by: createdBy,
          due_date: src.due_date,
          notes: src.notes,
          priority: src.priority,
          customer_name: src.customer_name,
          origin: src.origin,
          reference_type: src.reference_type,
          is_pilot_plant_process: src.is_pilot_plant_process,
          shared_form_data: src.shared_form_data ?? {},
          pp_experiment_number: src.pp_experiment_number,
          pp_v2o5_percent: src.pp_v2o5_percent,
          pp_experiment_date: src.pp_experiment_date,
          pp_issuer_user_id: src.pp_issuer_user_id,
          pp_previous_experiments: src.pp_previous_experiments,
          pp_experiment_kind: src.pp_experiment_kind,
          pp_masse_type: src.pp_masse_type,
          pp_remarks: src.pp_remarks,
          status: "open",
          workflow_status: "entwurf",
          // Bewusst NICHT kopiert: order_number, reference_number, ranking,
          // sample_id (Proben-IDs werden neu vergeben).
        } as any)
        .select()
        .single()
    );

    // --- Aufgaben / Dienstleistungen ---
    const srcMeasurements: any[] =
      (await unwrap(
        dbClient
          .from("order_measurements")
          .select("*, measurement_parameters(*)")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true })
      )) || [];

    for (const m of srcMeasurements) {
      const created: any = await unwrap(
        dbClient
          .from("order_measurements")
          .insert({
            order_id: newOrder.id,
            service_id: m.service_id,
            planned_hours: m.planned_hours,
            processing_time_hours: m.processing_time_hours,
            priority: m.priority,
            due_date: m.due_date,
            source_package_id: m.source_package_id,
            source_package_name_snapshot: m.source_package_name_snapshot,
            measurement_number: "WILL_BE_OVERWRITTEN",
            status: "open",
          } as any)
          .select()
          .single()
      );

      const params = (m.measurement_parameters || []).map((p: any) => ({
        order_measurement_id: created.id,
        parameter_name: p.parameter_name,
        parameter_value: p.parameter_value,
        unit: p.unit,
      }));
      if (params.length > 0) {
        await run(dbClient.from("measurement_parameters").insert(params as any));
      }

      // --- Anhänge (Dateien werden im Storage dupliziert) ---
      const uploads: any[] =
        (await unwrap(
          dbClient
            .from("order_upload_files" as any)
            .select("*")
            .eq("measurement_id", m.id)
        )) || [];
      for (const u of uploads) {
        const ext = u.storage_path.split("/").pop();
        const target = `orders/${created.id}/${u.field_key}/${Date.now()}_${ext}`;
        const { error: copyErr } = await dbClient.storage
          .from("order-uploads")
          .copy(u.storage_path, target);
        if (copyErr) continue; // Anhang optional – Kopie darf daran nicht scheitern
        await run(
          dbClient.from("order_upload_files" as any).insert({
            measurement_id: created.id,
            field_key: u.field_key,
            entry_index: u.entry_index,
            template_id: u.template_id,
            storage_path: target,
            file_name: u.file_name,
            file_type: u.file_type,
            file_size_bytes: u.file_size_bytes,
            uploaded_by: createdBy,
          } as any)
        );
      }
    }

    // --- Pilot-Plant-Bausteine frisch erzeugen (keine Statusübernahme) ---
    if (src.order_kind === "pilot_plant" || src.is_pilot_plant_process) {
      try {
        await dbClient.rpc("pp_seed_blocks" as any, { _order_id: newOrder.id } as any);
      } catch { /* optional */ }
    }

    // --- Prozess-/Workflow-Konfiguration: neue Instanz aus gleicher Vorlage ---
    const srcInstance: any = await unwrap(
      dbClient
        .from("order_instances" as any)
        .select("*")
        .eq("legacy_order_id", orderId)
        .maybeSingle()
    );
    if (srcInstance) {
      try {
        const inst: any = await unwrap(
          dbClient
            .from("order_instances" as any)
            .insert({
              template_id: srcInstance.template_id,
              template_snapshot: srcInstance.template_snapshot,
              project_id: srcInstance.project_id,
              legacy_order_id: newOrder.id,
              title: srcInstance.title,
              status: "draft",
              shared_data: {},
              created_by: createdBy,
            } as any)
            .select()
            .single()
        );
        if (srcInstance.template_id) {
          await dbClient.rpc("wf_seed_from_template" as any, {
            _order_id: inst.id,
            _template_id: srcInstance.template_id,
          } as any);
        }
      } catch { /* Prozessinstanz optional */ }
    }

    return { id: newOrder.id };
  },
};

