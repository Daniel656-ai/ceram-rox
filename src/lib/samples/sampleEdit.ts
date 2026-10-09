/**
 * Nachträgliche Probenbearbeitung: reine Logik (Formular, Diff, Berechtigung).
 * Nur Felder aus EDITABLE_SAMPLE_FIELDS dürfen gespeichert werden; alle
 * anderen (Probennummer, Erstelldatum, Auftrags-/PP-Verknüpfungen, Mutterprobe,
 * Ersteller, Mischcharge-Herkunft, Vorbereitungs-Kennzeichen, Status, Lagerort,
 * Probenhalter) laufen ausschließlich über ihre bestehenden Abläufe.
 */
import {
  categoryHasV2O5,
  sampleParametersToPayload,
  type SampleParameters,
} from "@/lib/sampleParameters";

export const EDITABLE_SAMPLE_FIELDS = [
  "sample_name",
  "project_id",
  "description",
  "category",
  "v2o5_content",
  "operating_hours",
  "is_used_catalyst",
  "raw_material_id",
  "raw_material_code",
  "lot_number",
  "bigbag_number",
  "post_measurement_action",
  "post_measurement_action_text",
  "storage_min_duration",
  "storage_hints",
  "storage_expiry_date",
  "disposal_method",
  "disposal_hints",
  "disposal_category",
  "is_hazardous",
  "hazard_categories",
  "tags",
] as const;

export type EditableSampleField = (typeof EDITABLE_SAMPLE_FIELDS)[number];

export interface SampleEditForm {
  sample_name: string;
  project_id: string;
  description: string;
  params: SampleParameters;
  post_measurement_action: string;
  post_measurement_action_text: string;
  storage_min_duration: string;
  storage_hints: string;
  storage_expiry_date: string;
  disposal_method: string;
  disposal_hints: string;
  disposal_category: string;
  is_hazardous: boolean;
  hazard_categories: string[];
  tags: string[];
}

export interface SampleFieldChange {
  field: EditableSampleField;
  old: unknown;
  new: unknown;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function buildSampleEditForm(s: Record<string, any>): SampleEditForm {
  return {
    sample_name: str(s.sample_name),
    project_id: str(s.project_id),
    description: str(s.description),
    params: {
      category: str(s.category),
      v2o5_content: str(s.v2o5_content),
      operating_hours: str(s.operating_hours),
      is_used_catalyst: !!s.is_used_catalyst,
      raw_material_id: str(s.raw_material_id),
      raw_material_code: str(s.raw_material_code),
      lot_number: str(s.lot_number),
      bigbag_number: str(s.bigbag_number),
    },
    post_measurement_action: str(s.post_measurement_action),
    post_measurement_action_text: str(s.post_measurement_action_text),
    storage_min_duration: str(s.storage_min_duration),
    storage_hints: str(s.storage_hints),
    storage_expiry_date: str(s.storage_expiry_date).slice(0, 10),
    disposal_method: str(s.disposal_method),
    disposal_hints: str(s.disposal_hints),
    disposal_category: str(s.disposal_category),
    is_hazardous: !!s.is_hazardous,
    hazard_categories: Array.isArray(s.hazard_categories) ? [...s.hazard_categories] : [],
    tags: Array.isArray(s.tags) ? [...s.tags] : [],
  };
}

/** Gefahrstoff-Schalter: Abwählen leert die Gefahrenklassen sofort sichtbar. */
export function setHazardous(form: SampleEditForm, on: boolean): SampleEditForm {
  return { ...form, is_hazardous: on, hazard_categories: on ? form.hazard_categories : [] };
}

/** Pflichtprüfung wie bei der Probenanlage. Liefert fehlende Felder. */
export function validateSampleEditForm(form: SampleEditForm): string[] {
  const missing: string[] = [];
  if (!form.sample_name.trim()) missing.push("sample_name");
  if (!form.project_id) missing.push("project_id");
  if (!form.description.trim()) missing.push("description");
  if (!form.post_measurement_action) missing.push("post_measurement_action");
  return missing;
}

function formToValues(form: SampleEditForm): Record<EditableSampleField, unknown> {
  const p = sampleParametersToPayload(form.params);
  const opt = (v: string) => (v.trim() ? v.trim() : null);
  return {
    sample_name: form.sample_name.trim(),
    project_id: form.project_id,
    description: form.description.trim(),
    ...p,
    post_measurement_action: form.post_measurement_action || null,
    post_measurement_action_text: opt(form.post_measurement_action_text),
    storage_min_duration: opt(form.storage_min_duration),
    storage_hints: opt(form.storage_hints),
    storage_expiry_date: form.storage_expiry_date || null,
    disposal_method: opt(form.disposal_method),
    disposal_hints: opt(form.disposal_hints),
    disposal_category: form.disposal_category || null,
    is_hazardous: form.is_hazardous,
    hazard_categories: form.is_hazardous ? form.hazard_categories : [],
    tags: form.tags,
  } as Record<EditableSampleField, unknown>;
}

function normalize(field: EditableSampleField, v: unknown): string {
  if (field === "hazard_categories" || field === "tags") {
    return JSON.stringify(Array.isArray(v) ? v : []);
  }
  if (field === "is_hazardous" || field === "is_used_catalyst") return String(!!v);
  if (field === "v2o5_content" || field === "operating_hours") {
    if (v === null || v === undefined || v === "") return "";
    return String(Number(v));
  }
  if (field === "storage_expiry_date") return str(v).slice(0, 10);
  return str(v);
}

/**
 * Vergleicht Original und Formular. `patch` enthält ausschließlich
 * geänderte, erlaubte Felder; unveränderte Felder werden nie mitgesendet.
 */
export function diffSampleEdit(original: Record<string, any>, form: SampleEditForm) {
  const next = formToValues(form);
  // V₂O₅ bei Kategorien ohne V₂O₅ unverändert lassen, falls bereits 0
  if (!categoryHasV2O5(form.params.category)) next.v2o5_content = 0;
  const patch: Partial<Record<EditableSampleField, unknown>> = {};
  const changes: SampleFieldChange[] = [];
  for (const field of EDITABLE_SAMPLE_FIELDS) {
    if (normalize(field, original[field]) !== normalize(field, next[field])) {
      patch[field] = next[field];
      changes.push({ field, old: original[field] ?? null, new: next[field] });
    }
  }
  const hazardCleared =
    !!original.is_hazardous &&
    !form.is_hazardous &&
    Array.isArray(original.hazard_categories) &&
    original.hazard_categories.length > 0;
  return { patch, changes, hazardCleared };
}

/** Entfernt alles, was nicht ausdrücklich bearbeitbar ist (Speicher-Schutz). */
export function sanitizeSamplePatch(patch: Record<string, unknown>) {
  const allowed = new Set<string>(EDITABLE_SAMPLE_FIELDS);
  return Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.has(k)));
}

/** Bestehende Regel (RLS „Creator and masters can update samples"). */
export function canEditSample(
  sample: { created_by?: string | null } | null | undefined,
  userId: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!sample || !userId) return false;
  return role === "master" || sample.created_by === userId;
}
