import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/** Eine Zuordnung "Quell-Parameter aus der Messsoftware" -> "Formularfeld". */
export interface ImportMapping {
  /** Alle Schreibweisen, unter denen der Parameter geliefert werden kann. */
  source_names: string[];
  /** field_key des Zielfelds im Formular. */
  target_field_key: string;
  /** Erwartete Einheit (nur informativ / für die Vorschau). */
  unit?: string | null;
  /** Optionaler Faktor, z.B. 0.01 wenn Quelle in % und Ziel als Anteil geführt wird. */
  factor?: number | null;
  label?: string | null;
}

export type ImportFormat = "auto" | "key_value" | "table_params_in_rows" | "table_params_in_columns";

export interface MeasurementImportProfile {
  id: string;
  name: string;
  description: string | null;
  source: string;
  format: ImportFormat;
  /** "auto" | "," | "." */
  decimal_separator: string;
  default_unit: string | null;
  mappings: ImportMapping[];
  options: Record<string, unknown>;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "measurement_import_profiles" as any;

export const measurementImportProfiles = {
  list: () =>
    unwrap(
      dbClient.from(TABLE).select("*").order("name", { ascending: true })
    ) as unknown as Promise<MeasurementImportProfile[]>,

  get: async (id: string) =>
    (await unwrap(
      dbClient.from(TABLE).select("*").eq("id", id).maybeSingle()
    )) as unknown as MeasurementImportProfile | null,

  create: (input: Partial<MeasurementImportProfile> & { name: string }) =>
    unwrap(
      dbClient.from(TABLE).insert(input as any).select().single()
    ) as unknown as Promise<MeasurementImportProfile>,

  update: (id: string, updates: Partial<MeasurementImportProfile>) =>
    run(dbClient.from(TABLE).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from(TABLE).delete().eq("id", id)),
};
