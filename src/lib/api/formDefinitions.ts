import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type FormScope = "template" | "global";

export interface FormDefinition {
  id: string;
  name: string;
  description: string | null;
  scope: FormScope;
  version: number;
  layout: Record<string, unknown>;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const formDefinitions = {
  list: (opts?: { scope?: FormScope; includeArchived?: boolean }) => {
    let q = dbClient.from("form_definitions" as any).select("*").order("name");
    if (opts?.scope) q = q.eq("scope", opts.scope);
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<FormDefinition[]>;
  },
  get: (id: string) =>
    unwrap(
      dbClient.from("form_definitions" as any).select("*").eq("id", id).single()
    ) as unknown as Promise<FormDefinition>,
  create: (input: Partial<FormDefinition> & { name: string }) =>
    unwrap(
      dbClient.from("form_definitions" as any).insert(input as any).select().single()
    ) as unknown as Promise<FormDefinition>,
  update: (id: string, updates: Partial<FormDefinition>) =>
    run(dbClient.from("form_definitions" as any).update(updates as any).eq("id", id)),
  archive: (id: string) =>
    run(
      dbClient
        .from("form_definitions" as any)
        .update({ archived_at: new Date().toISOString() } as any)
        .eq("id", id)
    ),
  remove: (id: string) => run(dbClient.from("form_definitions" as any).delete().eq("id", id)),

  /**
   * Vollständige, unabhängige Kopie eines (globalen) Formulars inkl. Feldern,
   * Berechnungen, Regeln, Rollenansichten, Berechtigungen und Layout.
   * Alle Unterobjekte erhalten neue IDs; interne Referenzen werden umgeschrieben.
   */
  clone: async (sourceId: string, newName: string): Promise<string> => {
    const { data, error } = await dbClient.rpc("clone_global_form" as any, {
      _source_form_id: sourceId,
      _new_name: newName,
    });
    if (error) throw error;
    return data as unknown as string;
  },

  /** Bezeichnung ändern – technische Identität und Verknüpfungen bleiben erhalten. */
  rename: async (id: string, newName: string): Promise<void> => {
    const { error } = await dbClient.rpc("rename_form_definition" as any, {
      _form_id: id,
      _new_name: newName,
    });
    if (error) throw error;
  },
};
