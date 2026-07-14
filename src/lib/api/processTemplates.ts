import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type ProcessKind = "labor" | "pilot_plant";
export type ProcessScope = "template" | "snippet" | "global";

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  kind: ProcessKind;
  scope: ProcessScope;
  category: string | null;
  version: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const processTemplates = {
  list: (opts?: { kind?: ProcessKind; scope?: ProcessScope; includeArchived?: boolean }) => {
    let q = dbClient.from("process_templates" as any).select("*").order("name");
    if (opts?.kind) q = q.eq("kind", opts.kind);
    if (opts?.scope) q = q.eq("scope", opts.scope);
    if (!opts?.includeArchived) q = q.is("archived_at", null);
    return unwrap(q) as unknown as Promise<ProcessTemplate[]>;
  },
  get: (id: string) =>
    unwrap(
      dbClient.from("process_templates" as any).select("*").eq("id", id).single()
    ) as unknown as Promise<ProcessTemplate>,
  create: (input: Partial<ProcessTemplate> & { name: string; kind: ProcessKind }) =>
    unwrap(
      dbClient.from("process_templates" as any).insert(input as any).select().single()
    ) as unknown as Promise<ProcessTemplate>,
  update: (id: string, updates: Partial<ProcessTemplate>) =>
    run(dbClient.from("process_templates" as any).update(updates as any).eq("id", id)),
  archive: (id: string) =>
    run(
      dbClient
        .from("process_templates" as any)
        .update({ archived_at: new Date().toISOString(), is_active: false } as any)
        .eq("id", id)
    ),
  remove: (id: string) => run(dbClient.from("process_templates" as any).delete().eq("id", id)),

  insertSnippet: async (targetTemplateId: string, snippetId: string) => {
    const { data, error } = await dbClient.rpc("insert_snippet_into_template" as any, {
      _target_template_id: targetTemplateId,
      _snippet_id: snippetId,
    } as any);
    if (error) throw error;
    return data as number;
  },

  cloneAsNewVersion: async (templateId: string) => {
    const { data, error } = await dbClient.rpc("clone_template_as_new_version" as any, {
      _template_id: templateId,
    } as any);
    if (error) throw error;
    return data as string;
  },

  snapshot: async (templateId: string) => {
    const { data, error } = await dbClient.rpc("snapshot_template" as any, {
      _template_id: templateId,
    } as any);
    if (error) throw error;
    return data as Record<string, unknown>;
  },
};
