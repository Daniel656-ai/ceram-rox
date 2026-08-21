/**
 * Messdatenblock – wiederholbare Messungen mit Messkontext.
 *
 * Fachliche Idee: Innerhalb eines Formulars können mehrere eigenständige
 * Messungen derselben Probe durchgeführt werden (z. B. „kalibriert“ vs.
 * „Standardlos“). Jede Messung besitzt einen eigenen Messkontext
 * (Bezeichnung, Präparation, Analyseart …) und eigene Ergebniswerte.
 *
 * Technisch ist ein Messdatenblock ein Repeater mit zusätzlichem Kontext:
 * Die Einträge liegen unverändert als Array in `shared_form_data`, jeder
 * Eintrag trägt zusätzlich die Schlüssel `__instance_id`, `__label` und
 * `__context`. Dadurch bleibt die bestehende Import-Engine unverändert
 * nutzbar – der Import schreibt weiterhin in den Eintrags-Scope.
 */
import type { FormField } from "@/lib/api/formFields";

export const INSTANCE_ID_KEY = "__instance_id";
export const INSTANCE_LABEL_KEY = "__label";
export const INSTANCE_CONTEXT_KEY = "__context";

export interface MeasurementContextFieldDef {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  required?: boolean;
}

export interface MeasurementBlockMeta {
  min_entries: number;
  max_entries?: number;
  item_label: string;
  add_label: string;
  storage_key?: string;
  /** Frei definierbare Kontextfelder je Messung. */
  context_fields: MeasurementContextFieldDef[];
  /** Freies Layout der Ergebnisfelder (identisch zum Repeater). */
  layout?: unknown;
}

const DEFAULT_CONTEXT_FIELDS: MeasurementContextFieldDef[] = [
  { key: "preparation", label: "Präparation", type: "text" },
  { key: "analysis_type", label: "Analyseart", type: "text" },
];

export const readMeasurementBlockMeta = (field: FormField): MeasurementBlockMeta => {
  const m = (field.metadata ?? {}) as Record<string, unknown>;
  const b = (m.measurement_block ?? {}) as Partial<MeasurementBlockMeta>;
  const ctx = Array.isArray(b.context_fields) ? b.context_fields : DEFAULT_CONTEXT_FIELDS;
  return {
    min_entries: typeof b.min_entries === "number" ? b.min_entries : 1,
    max_entries: typeof b.max_entries === "number" ? b.max_entries : undefined,
    item_label: typeof b.item_label === "string" ? b.item_label : "Messung",
    add_label: typeof b.add_label === "string" ? b.add_label : "Messung hinzufügen",
    storage_key: typeof b.storage_key === "string" ? b.storage_key : undefined,
    context_fields: ctx
      .filter((c): c is MeasurementContextFieldDef => !!c && typeof c.key === "string" && c.key.trim() !== "")
      .map((c) => ({
        key: c.key.trim(),
        label: c.label?.trim() || c.key.trim(),
        type: c.type === "select" ? "select" : "text",
        options: Array.isArray(c.options) ? c.options.filter((o) => typeof o === "string") : [],
        required: c.required === true,
      })),
    layout: (b as any).layout ?? null,
  };
};

export const writeMeasurementBlockMeta = (
  field: FormField,
  patch: Partial<MeasurementBlockMeta>
): Record<string, unknown> => {
  const m = { ...((field.metadata ?? {}) as Record<string, unknown>) };
  const cur = (m.measurement_block ?? {}) as Partial<MeasurementBlockMeta>;
  m.measurement_block = { ...cur, ...patch };
  return m;
};

/** Stabile, eindeutige Kennung einer Messung innerhalb eines Formulars. */
export const newInstanceId = () =>
  `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export interface MeasurementInstance {
  instanceId: string;
  /** Fachliche Bezeichnung der Messung (z. B. „Kalibriert“). */
  label: string;
  context: Record<string, string>;
  /** Reine Ergebniswerte der Messung (ohne Kontext-Schlüssel). */
  values: Record<string, unknown>;
  index: number;
}

const isMetaKey = (k: string) => k.startsWith("__");

/** Liest die Messungen eines Blocks aus dem gespeicherten Eintrags-Array. */
export function readInstances(
  raw: unknown,
  meta: MeasurementBlockMeta
): MeasurementInstance[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((entry, index) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const ctxRaw = (e[INSTANCE_CONTEXT_KEY] ?? {}) as Record<string, unknown>;
    const context: Record<string, string> = {};
    for (const cf of meta.context_fields) {
      const v = ctxRaw[cf.key];
      if (v != null && String(v).trim() !== "") context[cf.key] = String(v);
    }
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e)) if (!isMetaKey(k)) values[k] = v;
    return {
      instanceId: typeof e[INSTANCE_ID_KEY] === "string" ? (e[INSTANCE_ID_KEY] as string) : `idx_${index + 1}`,
      label: instanceLabel(
        typeof e[INSTANCE_LABEL_KEY] === "string" ? (e[INSTANCE_LABEL_KEY] as string) : "",
        context,
        meta,
        index
      ),
      context,
      values,
      index,
    };
  });
}

/** Anzeigebezeichnung: eigener Name, sonst Kontext, sonst „Messung n“. */
export function instanceLabel(
  explicit: string,
  context: Record<string, string>,
  meta: MeasurementBlockMeta,
  index: number
): string {
  const name = (explicit || "").trim();
  if (name) return name;
  const parts = meta.context_fields
    .map((c) => context[c.key])
    .filter((v) => v && v.trim() !== "");
  if (parts.length) return parts.join(" · ");
  return `${meta.item_label} ${index + 1}`;
}

/** Eindeutiger Ergebnisschlüssel je Messung – verhindert Kollisionen. */
export const instanceResultKey = (
  prefix: string,
  storageKey: string,
  instanceId: string,
  fieldKey: string
) => `${prefix}${storageKey}[${instanceId}].${fieldKey}`;
