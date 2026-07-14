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
};
