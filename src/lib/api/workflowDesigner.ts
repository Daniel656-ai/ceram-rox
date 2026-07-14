import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

// =====================================================================
// service_forms
// =====================================================================
export interface ServiceForm {
  id: string;
  service_id: string | null;
  name: string;
  description: string | null;
  form_type: string;
  is_global: boolean;
  schema: { fields?: unknown[] } & Record<string, unknown>;
  layout: Record<string, unknown>;
  version: number;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceForms = {
  list: (serviceId?: string | null) => {
    let q = dbClient.from("service_forms" as any).select("*").is("archived_at", null).order("name");
    if (serviceId) q = q.or(`service_id.eq.${serviceId},is_global.eq.true`);
    return unwrap(q) as unknown as Promise<ServiceForm[]>;
  },
  get: (id: string) =>
    unwrap(dbClient.from("service_forms" as any).select("*").eq("id", id).single()) as unknown as Promise<ServiceForm>,
  create: (input: Partial<ServiceForm> & { name: string; form_type: string }) =>
    unwrap(dbClient.from("service_forms" as any).insert(input as any).select().single()) as unknown as Promise<ServiceForm>,
  update: (id: string, updates: Partial<ServiceForm>) =>
    run(dbClient.from("service_forms" as any).update(updates as any).eq("id", id)),
  archive: (id: string) =>
    run(dbClient.from("service_forms" as any).update({ archived_at: new Date().toISOString() } as any).eq("id", id)),
  remove: (id: string) => run(dbClient.from("service_forms" as any).delete().eq("id", id)),
};

// =====================================================================
// service_workflow_definitions & steps
// =====================================================================
export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_key: string;
  name: string;
  description: string | null;
  step_type: string; // 'form' | 'approval' | 'condition' | 'action' | 'end' | 'start'
  role_required: string | null;
  assignee_user_id: string | null;
  form_id: string | null;
  is_mandatory: boolean;
  order_index: number;
  condition_expr: Record<string, unknown>;
  due_hours: number | null;
  escalation_role: string | null;
  auto_actions: Array<Record<string, unknown>>;
  notify_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDefinition {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  graph: { nodes?: unknown[]; edges?: unknown[] } & Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  steps?: WorkflowStep[];
}

export const workflowDefinitions = {
  listForService: (serviceId: string) =>
    unwrap(
      dbClient
        .from("service_workflow_definitions" as any)
        .select("*")
        .eq("service_id", serviceId)
        .order("version", { ascending: false })
    ) as unknown as Promise<WorkflowDefinition[]>,

  getActive: async (serviceId: string): Promise<WorkflowDefinition | null> => {
    const def = (await unwrap(
      dbClient
        .from("service_workflow_definitions" as any)
        .select("*")
        .eq("service_id", serviceId)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle()
    )) as unknown as WorkflowDefinition | null;
    if (!def) return null;
    const steps = (await unwrap(
      dbClient
        .from("service_workflow_steps" as any)
        .select("*")
        .eq("workflow_id", def.id)
        .order("order_index")
    )) as unknown as WorkflowStep[];
    return { ...def, steps };
  },

  create: (input: Partial<WorkflowDefinition> & { service_id: string; name: string }) =>
    unwrap(
      dbClient.from("service_workflow_definitions" as any).insert(input as any).select().single()
    ) as unknown as Promise<WorkflowDefinition>,

  update: (id: string, updates: Partial<WorkflowDefinition>) =>
    run(dbClient.from("service_workflow_definitions" as any).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("service_workflow_definitions" as any).delete().eq("id", id)),
};

export const workflowSteps = {
  listForWorkflow: (workflowId: string) =>
    unwrap(
      dbClient
        .from("service_workflow_steps" as any)
        .select("*")
        .eq("workflow_id", workflowId)
        .order("order_index")
    ) as unknown as Promise<WorkflowStep[]>,

  create: (input: Partial<WorkflowStep> & { workflow_id: string; step_key: string; name: string; step_type: string }) =>
    unwrap(
      dbClient.from("service_workflow_steps" as any).insert(input as any).select().single()
    ) as unknown as Promise<WorkflowStep>,

  update: (id: string, updates: Partial<WorkflowStep>) =>
    run(dbClient.from("service_workflow_steps" as any).update(updates as any).eq("id", id)),

  remove: (id: string) => run(dbClient.from("service_workflow_steps" as any).delete().eq("id", id)),

  listByIds: (ids: string[]) => {
    if (ids.length === 0) return Promise.resolve([] as WorkflowStep[]);
    return unwrap(
      dbClient.from("service_workflow_steps" as any).select("*").in("id", ids)
    ) as unknown as Promise<WorkflowStep[]>;
  },

  reorder: async (orders: Array<{ id: string; order_index: number }>) => {
    for (const o of orders) {
      await run(
        dbClient.from("service_workflow_steps" as any).update({ order_index: o.order_index } as any).eq("id", o.id)
      );
    }
  },
};

// =====================================================================
// service_workflow_step_services (multi-service link per step)
// =====================================================================
export interface WorkflowStepService {
  id: string;
  step_id: string;
  service_id: string;
  created_at: string;
}

export const workflowStepServices = {
  listForStep: (stepId: string) =>
    unwrap(
      dbClient
        .from("service_workflow_step_services" as any)
        .select("*")
        .eq("step_id", stepId)
    ) as unknown as Promise<WorkflowStepService[]>,

  listForSteps: (stepIds: string[]) => {
    if (stepIds.length === 0) return Promise.resolve([] as WorkflowStepService[]);
    return unwrap(
      dbClient
        .from("service_workflow_step_services" as any)
        .select("*")
        .in("step_id", stepIds)
    ) as unknown as Promise<WorkflowStepService[]>;
  },

  setForStep: async (stepId: string, serviceIds: string[]) => {
    await run(dbClient.from("service_workflow_step_services" as any).delete().eq("step_id", stepId));
    if (serviceIds.length === 0) return;
    await run(
      dbClient
        .from("service_workflow_step_services" as any)
        .insert(serviceIds.map((sid) => ({ step_id: stepId, service_id: sid })) as any)
    );
  },
};

// =====================================================================
// order_workflow_instances & tasks
// =====================================================================
export interface WorkflowTask {
  id: string;
  instance_id: string;
  step_id: string;
  order_id: string;
  form_id: string | null;
  assigned_to: string | null;
  assigned_role: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  form_response: Record<string, unknown>;
  notes: string | null;
  time_entry_id: string | null;
  auto_time_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export const workflowTasks = {
  listMyOpen: (userId: string) =>
    unwrap(
      dbClient
        .from("order_workflow_tasks" as any)
        .select("*")
        .eq("assigned_to", userId)
        .in("status", ["pending", "in_progress"])
        .order("due_at", { ascending: true, nullsFirst: false })
    ) as unknown as Promise<WorkflowTask[]>,

  listForOrder: (orderId: string) =>
    unwrap(
      dbClient
        .from("order_workflow_tasks" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
    ) as unknown as Promise<WorkflowTask[]>,

  get: (id: string) =>
    unwrap(dbClient.from("order_workflow_tasks" as any).select("*").eq("id", id).single()) as unknown as Promise<WorkflowTask>,

  update: (id: string, updates: Partial<WorkflowTask>) =>
    run(dbClient.from("order_workflow_tasks" as any).update(updates as any).eq("id", id)),

  start: (id: string) =>
    run(dbClient.rpc("wf_start_task" as any, { _task_id: id } as any)),

  saveDraft: (id: string, formResponse: Record<string, unknown>) =>
    run(
      dbClient
        .from("order_workflow_tasks" as any)
        .update({ form_response: formResponse, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
    ),

  complete: (id: string, formResponse: Record<string, unknown>) =>
    run(
      dbClient
        .from("order_workflow_tasks" as any)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          form_response: formResponse,
        } as any)
        .eq("id", id)
    ),
};

// =====================================================================
// order_workflow_task_positions
// =====================================================================
export interface WorkflowTaskPosition {
  id: string;
  task_id: string;
  sample_id: string | null;
  position_label: string | null;
  status: "open" | "in_progress" | "completed" | "not_feasible";
  result_value: string | null;
  remarks: string | null;
  not_feasible_reason: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const workflowTaskPositions = {
  listForTask: (taskId: string) =>
    unwrap(
      dbClient
        .from("order_workflow_task_positions" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })
    ) as unknown as Promise<WorkflowTaskPosition[]>,

  update: (id: string, updates: Partial<WorkflowTaskPosition>) =>
    run(dbClient.from("order_workflow_task_positions" as any).update(updates as any).eq("id", id)),

  upsertMany: (rows: Array<Partial<WorkflowTaskPosition> & { id: string }>) =>
    run(dbClient.from("order_workflow_task_positions" as any).upsert(rows as any)),
};

// =====================================================================
// Shared form data on the order
// =====================================================================
export const orderSharedFormData = {
  get: async (orderId: string): Promise<Record<string, unknown>> => {
    const r = (await unwrap(
      dbClient.from("measurement_orders" as any).select("shared_form_data").eq("id", orderId).single()
    )) as any;
    return (r?.shared_form_data ?? {}) as Record<string, unknown>;
  },
  merge: async (orderId: string, patch: Record<string, unknown>) => {
    const current = await orderSharedFormData.get(orderId);
    await run(
      dbClient
        .from("measurement_orders" as any)
        .update({ shared_form_data: { ...current, ...patch } } as any)
        .eq("id", orderId)
    );
  },
};
