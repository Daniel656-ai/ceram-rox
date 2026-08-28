import { dbClient } from "./client";
import { unwrap } from "./_helpers";

/**
 * Generischer Workflow-Datenkontext.
 *
 * Ein Formularfeld kann Werte aus einem VORHERIGEN Workflow-Schritt beziehen.
 * Die Auflösung ist bewusst generisch: es gibt keinerlei Sonderlogik für
 * einzelne Dienstleistungen (Geometrie, Aktivität, NOx …).
 *
 * Verwendungsarten (`mode`):
 *  - `display` → Wert wird nur als Referenz angezeigt
 *  - `copy`    → Wert wird in das aktuelle Formular übernommen
 *  - `calc`    → Wert dient als Eingangsgröße einer Berechnung
 */
export type DataSourceMode = "display" | "copy" | "calc";

export interface WorkflowDataSource {
  mode: DataSourceMode;
  source: {
    kind: "workflow_step";
    /** Schlüssel des liefernden Workflow-Schritts (`process_steps.step_key`). */
    step_key: string;
    /** Feldschlüssel innerhalb des Schritt-Formulars bzw. Ergebnisname. */
    field_key: string;
    /** Optionaler Bezug auf die liefernde Dienstleistung (Herkunftsnachweis). */
    service_id?: string | null;
    /** Menschlich lesbare Herkunft, z. B. „Geometrievermessung → Durchmesser“. */
    label?: string | null;
  };
}

export const EMPTY_DATA_SOURCE: Record<string, never> = {};

export function isWorkflowDataSource(v: unknown): v is WorkflowDataSource {
  const d = v as WorkflowDataSource | null;
  return !!d && !!d.source && d.source.kind === "workflow_step" && !!d.source.step_key;
}

/** Herkunftsangabe für einen referenzierten Wert (bleibt am Ergebnis erhalten). */
export interface ValueProvenance {
  step_key: string;
  field_key: string;
  service_id?: string | null;
  service_name?: string | null;
  label?: string | null;
  resolved_at: string;
}

export interface AvailableSourceField {
  step_key: string;
  step_name: string;
  service_id: string | null;
  service_name: string | null;
  field_key: string;
  field_label: string;
  unit: string | null;
}

export const workflowContext = {
  /**
   * Liefert alle Felder, die vorherige Schritte einer Prozessvorlage bereitstellen.
   * `beforeOrderIndex` begrenzt auf tatsächlich VORHER liegende Schritte.
   */
  listAvailableFields: async (
    templateId: string,
    beforeOrderIndex?: number
  ): Promise<AvailableSourceField[]> => {
    const steps = (await unwrap(
      dbClient
        .from("process_steps" as any)
        .select("id, step_key, name, order_index, form_id, service_id, measurement_services(service_name)")
        .eq("template_id", templateId)
        .order("order_index")
    )) as any[];

    const relevant = steps.filter(
      (s) => beforeOrderIndex === undefined || s.order_index < beforeOrderIndex
    );
    const formIds = relevant.map((s) => s.form_id).filter(Boolean) as string[];
    if (formIds.length === 0) return [];

    const fields = (await unwrap(
      dbClient
        .from("form_fields" as any)
        .select("id, form_id, field_key, display_name, unit, sort_order")
        .in("form_id", formIds)
        .order("sort_order")
    )) as any[];

    const out: AvailableSourceField[] = [];
    for (const s of relevant) {
      for (const f of fields.filter((x) => x.form_id === s.form_id)) {
        out.push({
          step_key: s.step_key,
          step_name: s.name,
          service_id: s.service_id ?? null,
          service_name: s.measurement_services?.service_name ?? null,
          field_key: f.field_key,
          field_label: f.display_name || f.field_key,
          unit: f.unit ?? null,
        });
      }
    }
    return out;
  },

  /**
   * Datenquellen für ein Formular: findet den Schritt, dem das Formular zugeordnet
   * ist, und liefert die Felder aller vorhergehenden Schritte derselben Vorlage.
   */
  listSourcesForForm: async (formId: string): Promise<AvailableSourceField[]> => {
    const steps = (await unwrap(
      dbClient
        .from("process_steps" as any)
        .select("template_id, order_index")
        .eq("form_id", formId)
        .order("order_index")
    )) as any[];
    if (!steps || steps.length === 0) return [];
    const results = await Promise.all(
      steps.map((s) => workflowContext.listAvailableFields(s.template_id, s.order_index))
    );
    const seen = new Set<string>();
    return results.flat().filter((f) => {
      const k = `${f.step_key}.${f.field_key}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },

  /** Gesammelte Schrittdaten eines Auftrags (`order_instances.shared_data`). */
  loadSharedData: async (orderInstanceId: string): Promise<Record<string, any>> => {
    const row = (await unwrap(
      dbClient
        .from("order_instances" as any)
        .select("shared_data")
        .eq("id", orderInstanceId)
        .maybeSingle()
    )) as any;
    return (row?.shared_data ?? {}) as Record<string, any>;
  },

  /**
   * Löst eine Datenquelle gegen die Schrittdaten auf.
   * Gibt Wert und Herkunft zurück, damit die Nachvollziehbarkeit erhalten bleibt.
   */
  resolve: (
    sharedData: Record<string, any>,
    ds: WorkflowDataSource,
    serviceName?: string | null
  ): { value: unknown; provenance: ValueProvenance } => {
    const bucket = sharedData?.[ds.source.step_key] ?? {};
    return {
      value: bucket?.[ds.source.field_key],
      provenance: {
        step_key: ds.source.step_key,
        field_key: ds.source.field_key,
        service_id: ds.source.service_id ?? null,
        service_name: serviceName ?? null,
        label: ds.source.label ?? null,
        resolved_at: new Date().toISOString(),
      },
    };
  },
};
