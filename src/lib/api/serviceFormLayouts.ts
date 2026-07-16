import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type FormRoleView = "customer" | "employee" | "public" | "report";

/**
 * Datenquellen für Ergebnisbericht-Bindings.
 * `free` = Bearbeiter füllt manuell aus (Freitext, Interpretation, etc.)
 * `computed` = Wert wird aus anderen Feldern berechnet (Formel in path)
 */
export type BindingSource =
  | "order"
  | "project"
  | "sample"
  | "customer_form"
  | "employee_form"
  | "measurement_parameter"
  | "measurement_result"
  | "workflow"
  | "raw_material"
  | "service"
  | "worklog"
  | "attachment"
  | "system"
  | "computed"
  | "free";

export interface FieldBinding {
  source: BindingSource;
  path?: string;
  editable?: boolean;
  hint?: string;
}

export interface FormFieldRef {
  id: string; // local row id
  field_id: string; // service_data_fields.id
  width: 12 | 9 | 8 | 6 | 4 | 3;
  readonly?: boolean;
  hidden?: boolean;
  /** Optional override for the field's display name at this placement only. */
  label_override?: string;
  /** Optional override for the field's help text at this placement only. */
  description_override?: string;
  /** Datenquellen-Bindung (primär für Ergebnisbericht). Ohne Binding = Freieingabe. */
  binding?: FieldBinding;
}

export interface RepeatableConfig {
  enabled: boolean;
  min?: number;
  max?: number;
  item_label?: string;
  add_label?: string;
  storage_key?: string;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  collapsed?: boolean;
  fields: FormFieldRef[];
  repeatable?: RepeatableConfig;
}

export interface FormLayoutData {
  sections: FormSection[];
}

export interface ServiceFormLayout {
  id: string;
  service_id: string;
  role_view: FormRoleView;
  layout: FormLayoutData;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY: FormLayoutData = { sections: [] };

/**
 * Statische Presets pro Datenquelle. Diese sind bewusst nicht erschöpfend —
 * beliebige Pfade können frei eingegeben werden, damit zukünftige Formulare
 * ohne Codeänderung eingebunden werden können.
 */
export const BINDING_PRESETS: Record<BindingSource, { label: string; presets: { path: string; label: string }[] }> = {
  order: {
    label: "Auftrag",
    presets: [
      { path: "order_number", label: "Auftragsnummer" },
      { path: "order_type", label: "Auftragstyp" },
      { path: "order_kind", label: "Auftragsart" },
      { path: "status", label: "Status" },
      { path: "workflow_status", label: "Workflow-Status" },
      { path: "priority", label: "Priorität" },
      { path: "due_date", label: "Fälligkeitsdatum" },
      { path: "created_at", label: "Erstellungsdatum" },
      { path: "started_at", label: "Startdatum" },
      { path: "completed_at", label: "Enddatum" },
      { path: "notes", label: "Anmerkungen" },
      { path: "pp_experiment_number", label: "Versuchsnummer" },
      { path: "pp_v2o5_percent", label: "% V₂O₅" },
      { path: "pp_masse_type", label: "Massetyp" },
      { path: "created_by_name", label: "Ersteller / Auftraggeber" },
      { path: "responsible_name", label: "Verantwortlicher" },
    ],
  },
  project: {
    label: "Projekt",
    presets: [
      { path: "project_number", label: "Projektnummer" },
      { path: "project_name", label: "Projektname" },
      { path: "project_manager", label: "Projektleiter" },
      { path: "customer", label: "Kunde" },
      { path: "start_date", label: "Projektstart" },
      { path: "end_date", label: "Projektende" },
      { path: "status", label: "Projektstatus" },
    ],
  },
  sample: {
    label: "Probe",
    presets: [
      { path: "sample_number", label: "Probennummer" },
      { path: "sample_name", label: "Probenname / Versuchsnummer" },
      { path: "description", label: "Beschreibung" },
      { path: "material_type", label: "Massetyp" },
      { path: "is_hazardous", label: "Gefahrgut" },
    ],
  },
  customer_form: {
    label: "Auftraggeberformular",
    presets: [
      { path: "*", label: "Alle Felder" },
      { path: "rezeptbasis", label: "Rezeptbasis" },
      { path: "hauptrohstoff", label: "Hauptrohstoff" },
      { path: "lotnummer", label: "Lotnummer" },
      { path: "variante", label: "Variante" },
      { path: "versuchsziel", label: "Versuchsziel" },
      { path: "zusatzstoffe", label: "Zusatzstoffe (Repeater)" },
      { path: "bemerkungen", label: "Bemerkungen" },
    ],
  },
  employee_form: {
    label: "Messdienstleisterformular",
    presets: [
      { path: "*", label: "Alle Felder" },
    ],
  },
  measurement_parameter: {
    label: "Prozessparameter (Messung)",
    presets: [
      { path: "*", label: "Alle Prozessparameter (Tabelle)" },
    ],
  },
  measurement_result: {
    label: "Messergebnis",
    presets: [
      { path: "*", label: "Alle Ergebnisse (Tabelle)" },
    ],
  },
  workflow: {
    label: "Workflow",
    presets: [
      { path: "steps", label: "Alle Prozessschritte (Tabelle)" },
      { path: "completed_steps", label: "Erledigte Schritte" },
      { path: "current_step", label: "Aktueller Schritt" },
      { path: "approvals", label: "Freigaben" },
    ],
  },
  raw_material: {
    label: "Rohstoffe",
    presets: [
      { path: "*", label: "Alle verwendeten Rohstoffe" },
      { path: "recipe", label: "Rezeptur (Tabelle)" },
      { path: "consumed_lots", label: "Verbrauchte Lotnummern" },
    ],
  },
  service: {
    label: "Dienstleistungen",
    presets: [
      { path: "*", label: "Alle Dienstleistungen (Tabelle)" },
      { path: "names", label: "Namen der Dienstleistungen" },
      { path: "categories", label: "Kategorien" },
    ],
  },
  worklog: {
    label: "Arbeitszeiten",
    presets: [
      { path: "*", label: "Alle Arbeitszeiten (Tabelle)" },
      { path: "total_hours", label: "Gesamtstunden" },
      { path: "by_user", label: "Stunden pro Mitarbeiter" },
    ],
  },
  attachment: {
    label: "Anhänge / Fotos",
    presets: [
      { path: "*", label: "Alle Anhänge (Liste)" },
      { path: "photos", label: "Nur Fotos" },
      { path: "documents", label: "Nur Dokumente" },
    ],
  },
  system: {
    label: "Systemdaten",
    presets: [
      { path: "generated_at", label: "Berichts-Erstellungsdatum" },
      { path: "generated_by", label: "Erzeugt von" },
      { path: "version_no", label: "Berichtsversion" },
      { path: "company_name", label: "Firmenname" },
    ],
  },
  computed: {
    label: "Berechnet",
    presets: [
      { path: "sum(measurement_result.value)", label: "Summe aller Ergebnisse" },
      { path: "avg(measurement_result.value)", label: "Mittelwert" },
      { path: "count(order_measurements)", label: "Anzahl Messungen" },
      { path: "sum(worklog.hours)", label: "Summe Arbeitszeiten" },
    ],
  },
  free: {
    label: "Freieingabe (Bearbeiter)",
    presets: [],
  },
};

export const serviceFormLayouts = {
  get: async (serviceId: string, roleView: FormRoleView): Promise<ServiceFormLayout | null> => {
    const rows = (await unwrap(
      dbClient
        .from("service_form_layouts" as any)
        .select("*")
        .eq("service_id", serviceId)
        .eq("role_view", roleView)
        .limit(1)
    )) as unknown as ServiceFormLayout[];
    return rows?.[0] ?? null;
  },

  upsert: (serviceId: string, roleView: FormRoleView, layout: FormLayoutData) =>
    run(
      dbClient.from("service_form_layouts" as any).upsert(
        {
          service_id: serviceId,
          role_view: roleView,
          layout: layout as any,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "service_id,role_view" }
      )
    ),

  empty: (): FormLayoutData => ({ ...EMPTY, sections: [] }),
};
