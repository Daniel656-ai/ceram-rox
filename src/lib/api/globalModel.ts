import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Zentrales Datenmodell (Phase 1): globale Objekte + globale Felder.
 * Rein ergänzend – bestehende Formulare/Felder bleiben unverändert.
 */

export interface GlobalObject {
  id: string;
  object_key: string;
  display_name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  sort_order: number;
  is_system: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type GlobalFieldDataType =
  | "text" | "longtext" | "number" | "decimal" | "percent"
  | "date" | "time" | "datetime" | "boolean"
  | "select" | "multiselect"
  | "file" | "image" | "reference" | "computed";

export type GlobalFieldSource = "manual" | "system" | "calculated" | "reference" | "device";

export interface GlobalField {
  id: string;
  object_id: string;
  /** Technische ID – unveränderlich (DB-Trigger blockiert Änderungen). */
  field_key: string;
  display_name: string;
  description: string | null;
  data_type: GlobalFieldDataType;
  category: string | null;
  unit: string | null;
  default_value: string | null;
  data_source: GlobalFieldSource;
  select_options: Array<string | { label: string; value: string }>;
  metadata: Record<string, unknown>;
  version: number;
  sort_order: number;
  is_system: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const GLOBAL_FIELD_TYPES: { value: GlobalFieldDataType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "longtext", label: "Mehrzeiliger Text" },
  { value: "number", label: "Zahl" },
  { value: "decimal", label: "Dezimalzahl" },
  { value: "percent", label: "Prozent" },
  { value: "date", label: "Datum" },
  { value: "time", label: "Uhrzeit" },
  { value: "datetime", label: "Datum & Uhrzeit" },
  { value: "boolean", label: "Ja/Nein" },
  { value: "select", label: "Auswahl" },
  { value: "multiselect", label: "Mehrfachauswahl" },
  { value: "file", label: "Datei" },
  { value: "image", label: "Bild" },
  { value: "reference", label: "Referenz" },
  { value: "computed", label: "Berechnet" },
];

export const GLOBAL_FIELD_SOURCES: { value: GlobalFieldSource; label: string }[] = [
  { value: "manual", label: "Manuelle Eingabe" },
  { value: "system", label: "Systemdaten" },
  { value: "calculated", label: "Berechnet" },
  { value: "reference", label: "Referenz (Stammdaten)" },
  { value: "device", label: "Maschine / Messgerät" },
];

export const globalObjects = {
  list: (opts?: { includeArchived?: boolean }) => {
    let q = dbClient
      .from("global_objects" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true });
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<GlobalObject[]>;
  },

  create: (input: Partial<GlobalObject> & { object_key: string; display_name: string }) =>
    unwrap(
      dbClient.from("global_objects" as any).insert(input as any).select().single()
    ) as unknown as Promise<GlobalObject>,

  update: (id: string, updates: Partial<GlobalObject>) =>
    run(dbClient.from("global_objects" as any).update(updates as any).eq("id", id)),

  archive: (id: string) =>
    run(
      dbClient
        .from("global_objects" as any)
        .update({ archived_at: new Date().toISOString() } as any)
        .eq("id", id)
    ),

  restore: (id: string) =>
    run(dbClient.from("global_objects" as any).update({ archived_at: null } as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("global_objects" as any).delete().eq("id", id)),
};

export const globalFields = {
  list: (opts?: { objectId?: string; includeArchived?: boolean }) => {
    let q = dbClient
      .from("global_fields" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true });
    if (opts?.objectId) q = q.eq("object_id", opts.objectId);
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<GlobalField[]>;
  },

  create: (
    input: Partial<GlobalField> & { object_id: string; field_key: string; display_name: string }
  ) =>
    unwrap(
      dbClient.from("global_fields" as any).insert(input as any).select().single()
    ) as unknown as Promise<GlobalField>,

  /** field_key wird bewusst nie mitgeschickt – die technische ID ist unveränderlich. */
  update: (id: string, updates: Partial<Omit<GlobalField, "field_key">>) => {
    const { field_key: _ignored, ...safe } = updates as Record<string, unknown>;
    return run(dbClient.from("global_fields" as any).update(safe as any).eq("id", id));
  },

  archive: (id: string) =>
    run(
      dbClient
        .from("global_fields" as any)
        .update({ archived_at: new Date().toISOString() } as any)
        .eq("id", id)
    ),

  restore: (id: string) =>
    run(dbClient.from("global_fields" as any).update({ archived_at: null } as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("global_fields" as any).delete().eq("id", id)),
};

/**
 * Abbildung Datentyp (globales Feld) -> Formularfeld-Typ.
 * Rein additiv; unbekannte Typen fallen auf "text" zurück.
 */
export const globalTypeToFormFieldType = (t: string): string => {
  const map: Record<string, string> = {
    text: "text", longtext: "longtext", number: "number", decimal: "decimal",
    percent: "percent", date: "date", time: "time", datetime: "datetime",
    boolean: "boolean", select: "select", multiselect: "multiselect",
    file: "file", image: "image", reference: "text", computed: "computed",
  };
  return map[t] ?? "text";
};

/** Kanonischer Bindungspfad, z.B. "order.versuchsnummer". */
export const bindingPathFor = (objectKey: string, fieldKey: string) => `${objectKey}.${fieldKey}`;
