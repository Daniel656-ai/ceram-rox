import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Phase 5: KI-gestützter Formularimport.
 * Rein additiv – bestehende Formulare/Felder bleiben unberührt.
 */

export type ImportFieldType =
  | "text" | "longtext" | "number" | "decimal" | "percent"
  | "date" | "time" | "datetime" | "boolean"
  | "select" | "multiselect" | "file" | "image" | "handwriting";

export interface ImportedField {
  label: string;
  field_key: string;
  field_type: ImportFieldType;
  unit: string | null;
  required: boolean;
  select_options: string[];
  match_binding_path: string | null;
  match_confidence: number;
  suggest_new_global: boolean;
  suggested_object_key: string | null;
  notes: string | null;
}

export interface ImportedSection {
  title: string;
  description: string | null;
  columns: 1 | 2 | 3;
  repeater: boolean;
  fields: ImportedField[];
}

export interface ImportAnalysis {
  form_name: string;
  sections: ImportedSection[];
}

export interface FormImportMapping {
  id: string;
  source_label: string;
  normalized_label: string;
  global_field_id: string | null;
  binding_path: string | null;
  unit: string | null;
  confirm_count: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface FormImportRun {
  id: string;
  form_id: string | null;
  file_name: string;
  file_type: string;
  analysis: Record<string, unknown>;
  field_count: number;
  new_global_field_count: number;
  created_at: string;
}

/** Normalisiert eine Beschriftung für den Lernabgleich ("Versuch Nr." -> "versuchnr"). */
export const normalizeLabel = (label: string): string =>
  label
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");

const sanitizeAnalysis = (raw: any): ImportAnalysis => {
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  return {
    form_name: typeof raw?.form_name === "string" && raw.form_name.trim() ? raw.form_name.trim() : "Importiertes Formular",
    sections: sections.map((s: any) => ({
      title: typeof s?.title === "string" ? s.title : "Abschnitt",
      description: typeof s?.description === "string" ? s.description : null,
      columns: [1, 2, 3].includes(s?.columns) ? s.columns : 1,
      repeater: !!s?.repeater,
      fields: (Array.isArray(s?.fields) ? s.fields : []).map((f: any) => ({
        label: typeof f?.label === "string" ? f.label : "Feld",
        field_key: typeof f?.field_key === "string" && f.field_key ? f.field_key : normalizeLabel(String(f?.label ?? "feld")),
        field_type: typeof f?.field_type === "string" ? f.field_type : "text",
        unit: typeof f?.unit === "string" && f.unit ? f.unit : null,
        required: !!f?.required,
        select_options: Array.isArray(f?.select_options) ? f.select_options.map(String) : [],
        match_binding_path: typeof f?.match_binding_path === "string" && f.match_binding_path ? f.match_binding_path : null,
        match_confidence: typeof f?.match_confidence === "number" ? f.match_confidence : 0,
        suggest_new_global: !!f?.suggest_new_global,
        suggested_object_key: typeof f?.suggested_object_key === "string" ? f.suggested_object_key : null,
        notes: typeof f?.notes === "string" ? f.notes : null,
      })) as ImportedField[],
    })) as ImportedSection[],
  };
};

export const formImport = {
  /** KI-Analyse eines hochgeladenen Formulars (PDF/Bild oder Excel-Textraster). */
  analyze: async (input: {
    file_name: string;
    mime_type: string;
    file_data?: string;
    sheet_text?: string;
    global_fields: Array<{ id: string; binding_path: string; display_name: string; data_type: string; unit?: string | null }>;
    learned_mappings: Array<{ label: string; binding_path: string }>;
  }): Promise<ImportAnalysis> => {
    const { data, error } = await dbClient.functions.invoke("ai-form-import", { body: input });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return sanitizeAnalysis((data as any)?.analysis);
  },

  mappings: {
    list: () =>
      unwrap(
        dbClient.from("form_import_mappings" as any).select("*").order("confirm_count", { ascending: false })
      ) as unknown as Promise<FormImportMapping[]>,

    /** Bestätigte Zuordnung merken bzw. Trefferzähler erhöhen. */
    confirm: async (input: { source_label: string; global_field_id: string; binding_path: string; unit?: string | null }) => {
      const normalized = normalizeLabel(input.source_label);
      const existing = (await unwrap(
        dbClient
          .from("form_import_mappings" as any)
          .select("*")
          .eq("normalized_label", normalized)
          .eq("global_field_id", input.global_field_id)
          .maybeSingle()
      )) as unknown as FormImportMapping | null;

      if (existing) {
        await run(
          dbClient
            .from("form_import_mappings" as any)
            .update({
              confirm_count: existing.confirm_count + 1,
              last_used_at: new Date().toISOString(),
              source_label: input.source_label,
            } as any)
            .eq("id", existing.id)
        );
        return;
      }
      await run(
        dbClient.from("form_import_mappings" as any).insert({
          source_label: input.source_label,
          normalized_label: normalized,
          global_field_id: input.global_field_id,
          binding_path: input.binding_path,
          unit: input.unit ?? null,
        } as any)
      );
    },

    remove: (id: string) => run(dbClient.from("form_import_mappings" as any).delete().eq("id", id)),
  },

  runs: {
    list: (limit = 50) =>
      unwrap(
        dbClient
          .from("form_import_runs" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit)
      ) as unknown as Promise<FormImportRun[]>,

    log: (input: {
      form_id: string | null;
      file_name: string;
      file_type: string;
      analysis: Record<string, unknown>;
      field_count: number;
      new_global_field_count: number;
    }) => run(dbClient.from("form_import_runs" as any).insert(input as any)),
  },
};
