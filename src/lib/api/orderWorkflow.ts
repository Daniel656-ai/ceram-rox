import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type WorkflowInstanceStatus = "open" | "in_progress" | "completed" | "skipped";

export interface OrderProcess {
  id: string;
  order_id: string;
  process_template_id: string | null;
  name: string;
  description: string | null;
  order_index: number;
  status: WorkflowInstanceStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderProcessService {
  id: string;
  order_process_id: string;
  service_id: string | null;
  name: string;
  description: string | null;
  order_index: number;
  status: WorkflowInstanceStatus;
  assigned_role: string | null;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderServiceForm {
  id: string;
  order_process_service_id: string;
  form_definition_id: string | null;
  name: string;
  order_index: number;
  role_view_key: string | null;
  response_data: Record<string, unknown>;
  status: WorkflowInstanceStatus;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWorkflowTree {
  processes: Array<OrderProcess & { services: Array<OrderProcessService & { forms: OrderServiceForm[] }> }>;
}

export const orderWorkflow = {
  /** Erzeugt aus ausgewählten Prozessvorlagen eine Auftrags-Instanz (Snapshots). */
  createInstance: async (orderId: string, processTemplateIds: string[]) => {
    const { data, error } = await dbClient.rpc("create_order_workflow_instance" as any, {
      _order_id: orderId,
      _process_template_ids: processTemplateIds,
    } as any);
    if (error) throw error;
    return (data ?? []) as string[];
  },

  /** Vollständige Baumstruktur eines Auftrags laden. */
  loadTree: async (orderId: string): Promise<OrderWorkflowTree> => {
    const processes = (await unwrap(
      dbClient.from("order_processes" as any).select("*").eq("order_id", orderId).order("order_index")
    )) as unknown as OrderProcess[];
    if (processes.length === 0) return { processes: [] };

    const procIds = processes.map((p) => p.id);
    const services = (await unwrap(
      dbClient
        .from("order_process_services" as any)
        .select("*")
        .in("order_process_id", procIds)
        .order("order_index")
    )) as unknown as OrderProcessService[];

    const svcIds = services.map((s) => s.id);
    const forms = svcIds.length
      ? ((await unwrap(
          dbClient
            .from("order_service_forms" as any)
            .select("*")
            .in("order_process_service_id", svcIds)
            .order("order_index")
        )) as unknown as OrderServiceForm[])
      : [];

    return {
      processes: processes.map((p) => ({
        ...p,
        services: services
          .filter((s) => s.order_process_id === p.id)
          .map((s) => ({
            ...s,
            forms: forms.filter((f) => f.order_process_service_id === s.id),
          })),
      })),
    };
  },

  updateProcess: (id: string, updates: Partial<OrderProcess>) =>
    run(dbClient.from("order_processes" as any).update(updates as any).eq("id", id)),

  updateService: (id: string, updates: Partial<OrderProcessService>) =>
    run(dbClient.from("order_process_services" as any).update(updates as any).eq("id", id)),

  updateForm: (id: string, updates: Partial<OrderServiceForm>) =>
    run(dbClient.from("order_service_forms" as any).update(updates as any).eq("id", id)),

  saveFormResponse: (id: string, response: Record<string, unknown>, complete = false) =>
    run(
      dbClient
        .from("order_service_forms" as any)
        .update({
          response_data: response as any,
          status: complete ? "completed" : "in_progress",
          completed_at: complete ? new Date().toISOString() : null,
        } as any)
        .eq("id", id)
    ),
};
