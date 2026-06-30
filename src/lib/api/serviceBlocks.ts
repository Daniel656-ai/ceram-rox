import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type ServiceBlockKind =
  | "field_group"
  | "document_snippet"
  | "workflow_snippet"
  | "rule_snippet";

export interface ServiceBlock {
  id: string;
  name: string;
  description: string | null;
  category: string;
  kind: ServiceBlockKind;
  content: any;
  tags: string[];
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceBlocks = {
  list: (kind?: ServiceBlockKind) => {
    let q = dbClient.from("service_blocks" as any).select("*").order("category", { ascending: true }).order("name", { ascending: true });
    if (kind) q = q.eq("kind", kind);
    return unwrap(q) as unknown as Promise<ServiceBlock[]>;
  },

  create: (block: Partial<ServiceBlock> & { name: string; kind: ServiceBlockKind }) =>
    unwrap(
      dbClient.from("service_blocks" as any).insert(block as any).select().single()
    ) as unknown as Promise<ServiceBlock>,

  update: (id: string, updates: Partial<ServiceBlock>) =>
    run(dbClient.from("service_blocks" as any).update(updates as any).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("service_blocks" as any).delete().eq("id", id)),
};
