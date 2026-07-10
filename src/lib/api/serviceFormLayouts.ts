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
  | "computed"
  | "free";

export interface FieldBinding {
  source: BindingSource;
  /** Pfad/Feldschlüssel/Formel innerhalb der Datenquelle (z.B. "order_number", "V2O5", "sum(results.value)"). */
  path?: string;
  /** Wenn true, darf der automatisch übernommene Wert im Bericht überschrieben werden. Standard: false (schreibgeschützt). */
  editable?: boolean;
  /** Optional: menschenlesbare Beschreibung der Quelle (nur für Designer-UI). */
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
      { path: "status", label: "Status" },
      { path: "priority", label: "Priorität" },
      { path: "due_date", label: "Fälligkeitsdatum" },
      { path: "created_at", label: "Erstellt am" },
      { path: "notes", label: "Anmerkungen" },
    ],
  },
  project: {
    label: "Projekt",
    presets: [
      { path: "project_number", label: "Projektnummer" },
      { path: "project_name", label: "Projektname" },
      { path: "project_manager", label: "Projektleiter" },
      { path: "customer", label: "Auftraggeber" },
      { path: "start_date", label: "Projektstart" },
    ],
  },
  sample: {
    label: "Probe",
    presets: [
      { path: "sample_number", label: "Probennummer" },
      { path: "sample_name", label: "Probenname / Versuchsnummer" },
      { path: "description", label: "Beschreibung" },
      { path: "material_type", label: "Massetyp" },
    ],
  },
  customer_form: {
    label: "Auftraggeberformular",
    presets: [
      { path: "V2O5", label: "%V₂O₅" },
      { path: "art_des_versuches", label: "Art des Versuches" },
      { path: "massetyp", label: "Massetyp" },
      { path: "frühere_versuche", label: "Frühere Versuche" },
    ],
  },
  employee_form: {
    label: "Messdienstleisterformular",
    presets: [],
  },
  measurement_parameter: {
    label: "Prozessparameter (Messung)",
    presets: [],
  },
  measurement_result: {
    label: "Messergebnis",
    presets: [
      { path: "*", label: "Alle Ergebnisse (Tabelle)" },
    ],
  },
  computed: {
    label: "Berechnet",
    presets: [
      { path: "sum(measurement_result.value)", label: "Summe aller Ergebnisse" },
      { path: "avg(measurement_result.value)", label: "Mittelwert" },
      { path: "count(order_measurements)", label: "Anzahl Messungen" },
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
