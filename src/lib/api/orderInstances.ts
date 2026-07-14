import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type OrderInstanceStatus = "draft" | "planned" | "in_progress" | "completed" | "cancelled";

export interface OrderInstance {
  id: string;
  order_number: string | null;
  template_id: string | null;
  template_snapshot: Record<string, unknown> | null;
  project_id: string | null;
  title: string | null;
  status: OrderInstanceStatus;
  workflow_status: string | null;
  shared_data: Record<string, unknown>;
  sample_ids: string[] | null;
  legacy_order_id: string | null;
  created_by: string | null;
  locked_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export const orderInstances = {
  list: (opts?: { projectId?: string }) => {
    let q = dbClient.from("order_instances" as any).select("*").order("created_at", { ascending: false });
    if (opts?.projectId) q = q.eq("project_id", opts.projectId);
    return unwrap(q) as unknown as Promise<OrderInstance[]>;
  },

  get: (id: string) =>
    unwrap(
      dbClient.from("order_instances" as any).select("*").eq("id", id).maybeSingle()
    ) as unknown as Promise<OrderInstance | null>,

  getByLegacyOrderId: (legacyOrderId: string) =>
    unwrap(
      dbClient
        .from("order_instances" as any)
        .select("*")
        .eq("legacy_order_id", legacyOrderId)
        .maybeSingle()
    ) as unknown as Promise<OrderInstance | null>,

  create: (input: Partial<OrderInstance>) =>
    unwrap(
      dbClient.from("order_instances" as any).insert(input as any).select().single()
    ) as unknown as Promise<OrderInstance>,

  update: (id: string, updates: Partial<OrderInstance>) =>
    run(dbClient.from("order_instances" as any).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("order_instances" as any).delete().eq("id", id)),
};
