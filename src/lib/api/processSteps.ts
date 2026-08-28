import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface ProcessStep {
  id: string;
  template_id: string;
  step_key: string;
  name: string;
  description: string | null;
  order_index: number;
  form_id: string | null;
  role_required: string | null;
  assignee_rule: Record<string, unknown>;
  is_mandatory: boolean;
  condition_expr: Record<string, unknown>;
  auto_actions: Array<Record<string, unknown>>;
  due_hours: number | null;
  escalation_role: string | null;
  position_source: string | null;
  metadata: Record<string, unknown>;
  /** Role view key to open (falls back to the user's role, then default). */
  role_view_key: string | null;
  /** Field IDs that are locked (read-only) after this step is completed. */
  locked_field_ids: string[];
  /** `service` = verweist auf eine echte Dienstleistung, `internal` = interner Prozessschritt. */
  step_kind: "service" | "internal";
  /** Verknüpfte Dienstleistung (nur bei `step_kind = service`). */
  service_id: string | null;
  /** Schrittschlüssel, die vor diesem Schritt abgeschlossen sein müssen. */
  depends_on_step_keys: string[];
  /** Erzeugt beim Start automatisch eine Teilprobe der zugeordneten Probe. */
  creates_subsample: boolean;
  created_at: string;
  updated_at: string;
}


export const processSteps = {
  listForTemplate: (templateId: string) =>
    unwrap(
      dbClient
        .from("process_steps" as any)
        .select("*")
        .eq("template_id", templateId)
        .order("order_index")
    ) as unknown as Promise<ProcessStep[]>,

  create: (input: Partial<ProcessStep> & { template_id: string; step_key: string; name: string }) =>
    unwrap(
      dbClient.from("process_steps" as any).insert(input as any).select().single()
    ) as unknown as Promise<ProcessStep>,

  update: (id: string, updates: Partial<ProcessStep>) =>
    run(dbClient.from("process_steps" as any).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("process_steps" as any).delete().eq("id", id)),

  reorder: async (orders: Array<{ id: string; order_index: number }>) => {
    for (const o of orders) {
      await run(
        dbClient.from("process_steps" as any).update({ order_index: o.order_index } as any).eq("id", o.id)
      );
    }
  },
};
