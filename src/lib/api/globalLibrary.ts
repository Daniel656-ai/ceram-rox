import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Phase 3 des zentralen Datenmodells: wiederverwendbare Listen, Berechnungen
 * und Validierungen. Rein ergänzend – bestehende Formulare bleiben unverändert.
 */

export interface GlobalList {
  id: string;
  list_key: string;
  display_name: string;
  description: string | null;
  category: string | null;
  is_system: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalListItem {
  id: string;
  list_id: string;
  item_value: string;
  label: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  /** Frei definierbare Attributwerte (Schlüssel = attribute_key der Kategorie). */
  metadata: Record<string, unknown>;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MasterDataAttributeType =
  | "text" | "longtext" | "number" | "date" | "boolean" | "select";

export const MASTER_DATA_ATTRIBUTE_TYPES: { value: MasterDataAttributeType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "longtext", label: "Langtext" },
  { value: "number", label: "Zahl" },
  { value: "date", label: "Datum" },
  { value: "boolean", label: "Ja/Nein" },
  { value: "select", label: "Auswahl" },
];

/** Frei definierbare Eigenschaft einer Stammdaten-Kategorie. */
export interface GlobalListAttribute {
  id: string;
  list_id: string;
  attribute_key: string;
  display_name: string;
  data_type: MasterDataAttributeType;
  unit: string | null;
  options: string[];
  is_required: boolean;
  show_in_table: boolean;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}


export interface GlobalCalculation {
  id: string;
  calc_key: string;
  display_name: string;
  description: string | null;
  category: string | null;
  /** Formel im Syntax der bestehenden Formula-Engine, z.B. "masse / volumen". */
  formula: string;
  unit: string | null;
  decimals: number;
  /** Dokumentation der erwarteten Eingangsgrößen (Keys). */
  inputs: string[];
  is_system: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ValidationRuleType = "range" | "min" | "max" | "pattern" | "required" | "expression";
export type ValidationSeverity = "error" | "warning";

export interface GlobalValidation {
  id: string;
  validation_key: string;
  display_name: string;
  description: string | null;
  category: string | null;
  rule_type: ValidationRuleType;
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
  pattern: string | null;
  expression: string | null;
  severity: ValidationSeverity;
  error_message: string | null;
  is_system: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const VALIDATION_RULE_TYPES: { value: ValidationRuleType; label: string }[] = [
  { value: "range", label: "Wertebereich (min–max)" },
  { value: "min", label: "Mindestwert" },
  { value: "max", label: "Maximalwert" },
  { value: "pattern", label: "Muster (RegEx)" },
  { value: "required", label: "Pflichtangabe" },
  { value: "expression", label: "Formelbedingung" },
];

const table = (name: string) => dbClient.from(name as any);

export const globalLists = {
  list: (opts?: { includeArchived?: boolean }) => {
    let q = table("global_lists").select("*").order("display_name", { ascending: true });
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<GlobalList[]>;
  },
  create: (input: Partial<GlobalList> & { list_key: string; display_name: string }) =>
    unwrap(table("global_lists").insert(input as any).select().single()) as unknown as Promise<GlobalList>,
  update: (id: string, updates: Partial<GlobalList>) =>
    run(table("global_lists").update(updates as any).eq("id", id)),
  archive: (id: string) =>
    run(table("global_lists").update({ archived_at: new Date().toISOString() } as any).eq("id", id)),
  restore: (id: string) => run(table("global_lists").update({ archived_at: null } as any).eq("id", id)),
  remove: (id: string) => run(table("global_lists").delete().eq("id", id)),
};

export const globalListItems = {
  list: (listId: string, opts?: { includeArchived?: boolean }) => {
    let q = table("global_list_items")
      .select("*")
      .eq("list_id", listId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<GlobalListItem[]>;
  },
  create: (input: Partial<GlobalListItem> & { list_id: string; item_value: string; label: string }) =>
    unwrap(table("global_list_items").insert(input as any).select().single()) as unknown as Promise<GlobalListItem>,
  update: (id: string, updates: Partial<GlobalListItem>) =>
    run(table("global_list_items").update(updates as any).eq("id", id)),
  remove: (id: string) => run(table("global_list_items").delete().eq("id", id)),
};

export const globalCalculations = {
  list: (opts?: { includeArchived?: boolean }) => {
    let q = table("global_calculations").select("*").order("display_name", { ascending: true });
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<GlobalCalculation[]>;
  },
  create: (input: Partial<GlobalCalculation> & { calc_key: string; display_name: string; formula: string }) =>
    unwrap(table("global_calculations").insert(input as any).select().single()) as unknown as Promise<GlobalCalculation>,
  update: (id: string, updates: Partial<GlobalCalculation>) =>
    run(table("global_calculations").update(updates as any).eq("id", id)),
  archive: (id: string) =>
    run(table("global_calculations").update({ archived_at: new Date().toISOString() } as any).eq("id", id)),
  remove: (id: string) => run(table("global_calculations").delete().eq("id", id)),
};

export const globalValidations = {
  list: (opts?: { includeArchived?: boolean }) => {
    let q = table("global_validations").select("*").order("display_name", { ascending: true });
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<GlobalValidation[]>;
  },
  create: (input: Partial<GlobalValidation> & { validation_key: string; display_name: string }) =>
    unwrap(table("global_validations").insert(input as any).select().single()) as unknown as Promise<GlobalValidation>,
  update: (id: string, updates: Partial<GlobalValidation>) =>
    run(table("global_validations").update(updates as any).eq("id", id)),
  archive: (id: string) =>
    run(table("global_validations").update({ archived_at: new Date().toISOString() } as any).eq("id", id)),
  remove: (id: string) => run(table("global_validations").delete().eq("id", id)),
};
