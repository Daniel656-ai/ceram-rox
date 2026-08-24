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
  /**
   * LEGACY: früher fest im Block gepflegte Kontextfelder. Neue Blöcke nutzen
   * ausschließlich echte Unterfelder (form_fields mit parent_field_id).
   */
  context_fields: MeasurementContextFieldDef[];
  /** Freies Layout der Unterfelder (identisch zum Repeater). */
  layout?: unknown;
}

/**
 * Rolle eines Unterfeldes innerhalb eines Messblocks.
 * - "label"   → liefert die Bezeichnung der Messung
 * - "context" → beschreibt den Messkontext (Präparation, Analyseart, …)
 * - "value"   → normales Feld / Messwert (Standard)
 *
 * Die Rollen sind frei konfigurierbar; es gibt KEINE fest codierten Unterfelder.
 */
export type BlockChildRole = "label" | "context" | "value";

export interface BlockChildDef {
  field_key: string;
  display_name?: string | null;
  role: BlockChildRole;
}

export const readBlockChildRole = (field: { metadata?: unknown }): BlockChildRole => {
  const m = (field?.metadata ?? {}) as Record<string, unknown>;
  const r = (m.block_role ?? (m.measurement_block_child as any)?.role) as string | undefined;
  return r === "label" || r === "context" ? r : "value";
};

export const writeBlockChildRole = (
  field: { metadata?: unknown },
  role: BlockChildRole
): Record<string, unknown> => ({
  ...((field?.metadata ?? {}) as Record<string, unknown>),
  block_role: role,
});

export const toBlockChildDefs = (
  children: Array<{ field_key: string; display_name?: string | null; metadata?: unknown }>
): BlockChildDef[] =>
  children.map((c) => ({
    field_key: c.field_key,
    display_name: c.display_name ?? null,
    role: readBlockChildRole(c),
  }));

export const readMeasurementBlockMeta = (field: FormField): MeasurementBlockMeta => {
  const m = (field.metadata ?? {}) as Record<string, unknown>;
  const b = (m.measurement_block ?? {}) as Partial<MeasurementBlockMeta>;
  const ctx = Array.isArray(b.context_fields) ? b.context_fields : [];
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

/**
 * Liest die Messungen eines Blocks aus dem gespeicherten Eintrags-Array.
 * Die Struktur ergibt sich vollständig aus den übergebenen Unterfeldern –
 * es werden keine Unterfelder vorausgesetzt.
 */
export function readInstances(
  raw: unknown,
  meta: MeasurementBlockMeta,
  children: BlockChildDef[] = []
): MeasurementInstance[] {
  const list = Array.isArray(raw) ? raw : [];
  const contextKeys = children.filter((c) => c.role === "context");
  const labelKeys = children.filter((c) => c.role === "label");

  return list.map((entry, index) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const ctxRaw = (e[INSTANCE_CONTEXT_KEY] ?? {}) as Record<string, unknown>;
    const context: Record<string, string> = {};
    // Legacy-Kontext (fest im Block gepflegt)
    for (const cf of meta.context_fields) {
      const v = ctxRaw[cf.key];
      if (v != null && String(v).trim() !== "") context[cf.key] = String(v);
    }
    // Kontext aus echten Unterfeldern
    for (const c of contextKeys) {
      const v = e[c.field_key];
      if (v != null && String(v).trim() !== "") context[c.field_key] = String(v);
    }
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e)) if (!isMetaKey(k)) values[k] = v;

    const explicit =
      (typeof e[INSTANCE_LABEL_KEY] === "string" ? (e[INSTANCE_LABEL_KEY] as string) : "") ||
      labelKeys.map((c) => e[c.field_key]).find((v) => v != null && String(v).trim() !== "")?.toString() ||
      "";

    return {
      instanceId: typeof e[INSTANCE_ID_KEY] === "string" ? (e[INSTANCE_ID_KEY] as string) : `idx_${index + 1}`,
      label: instanceLabel(explicit, context, meta, index),
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
  const parts = Object.values(context).filter((v) => v && v.trim() !== "");
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
