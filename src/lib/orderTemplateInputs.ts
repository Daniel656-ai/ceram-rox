import type { FormField } from "@/lib/api/formFields";
import { containerLayout } from "@/lib/scopedMeasurementValues";

type InputDefinition = Partial<Omit<FormField, "field_type">> & { field_key: string; field_type: string };
const excludedKeys = new Set(["versuchsnummer", "pp_experiment_number", "order_number", "sample_number", "measurement_number"]);
export function templateInputAllowed(field: InputDefinition) {
  return !field.is_result && !["computed", "file", "image", "measurement_import"].includes(field.field_type)
    && !excludedKeys.has(field.field_key) && field.binding_path !== "order.versuchsnummer";
}
export function parseTemplateInput(raw: unknown, field: InputDefinition): unknown {
  if (raw == null) return raw;
  if (typeof raw !== "string") return raw;
  if (["number", "decimal", "percent"].includes(field.field_type)) {
    if (raw.trim() === "") return "";
    const number = Number(raw);
    if (!Number.isFinite(number)) throw new Error(`Ungültiger Zahlenwert: ${field.display_name ?? field.field_key}`);
    return number;
  }
  if (field.field_type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new Error(`Uneindeutiger Wahrheitswert: ${field.field_key}`);
  }
  if (["multiselect", "repeater", "measurement_block", "raw_material_recipe"].includes(field.field_type)) {
    try { return JSON.parse(raw); } catch { throw new Error(`Nicht lesbarer Formularwert: ${field.field_key}`); }
  }
  return raw;
}

/** Allowlist inputs per owning definition; calculations and previous run identities never travel. */
export function copyTemplateInputs(values: Record<string, unknown>, fields: InputDefinition[], definitionScope: InputDefinition[] = fields): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    if (!templateInputAllowed(field)) continue;
    const meta = field.metadata as { repeater?: { storage_key?: string }; measurement_block?: { storage_key?: string } } | undefined;
    const key = meta?.repeater?.storage_key ?? meta?.measurement_block?.storage_key ?? field.field_key;
    if (!(key in values)) continue;
    const raw = parseTemplateInput(values[key], field);
    if (["repeater", "measurement_block"].includes(field.field_type) && Array.isArray(raw)) {
      const layout = containerLayout(field as FormField, definitionScope as FormField[]);
      const leaves = layout.items.flatMap(item => item.type === "group" ? item.children : [item]);
      const children = leaves.flatMap(item => {
        if (item.type !== "field") return [];
        const def = definitionScope.find(f => item.field_id ? f.id === item.field_id : f.field_key === item.key);
        return def ? [{ ...def, field_key: item.value_key ?? item.key }] : [];
      });
      output[key] = raw.map(entry => {
        if (!entry || typeof entry !== "object") throw new Error(`Nicht lesbarer Wiederholungsbereich: ${key}`);
        return { ...copyTemplateInputs(entry as Record<string, unknown>, children, definitionScope), __instance_id: crypto.randomUUID() };
      });
    } else output[key] = structuredClone(raw);
  }
  return output;
}

/** Drafts have no separate result records; remove identity/file markers even in legacy JSON. */
export function cleanDraftTemplateValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanDraftTemplateValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (excludedKeys.has(key) || ["pendingFile", "previewUrl", "storagePath", "templateId", "__draft_file_missing"].includes(key)) continue;
      if (key === "__id" || key === "__instance_id") out[key] = crypto.randomUUID();
      else out[key] = cleanDraftTemplateValue(v);
    }
    return out;
  }
  return value;
}
