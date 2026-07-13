/**
 * Work-Objects API — Fassade für die neue workfloworientierte Arbeitsweise.
 *
 * Ein "Arbeitsobjekt" ist ein Datensatz aus `measurement_orders`, angereichert
 * um Referenznummer, Ursprung, Workflow-Instanz und Aufgaben. Bestehende
 * `api.orders.*` bleiben unverändert.
 */
import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type ReferenceType =
  | "experiment" | "serial" | "batch" | "complaint" | "customer_ref" | "internal";

export interface WorkObjectOrigin {
  id: string;
  key: string;
  label_de: string;
  label_en: string;
  default_reference_type: ReferenceType;
  default_workflow_template_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface WorkflowTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  origin: string | null;
  is_active: boolean;
}

export interface WorkflowTemplateStep {
  id: string;
  template_id: string;
  order_index: number;
  step_key: string;
  name: string;
  description: string | null;
  step_type: string;
  role_required: string | null;
  form_id: string | null;
  is_mandatory: boolean;
  condition_expr: Record<string, unknown>;
  due_hours: number | null;
}

export interface WorkObjectSummary {
  id: string;
  reference_number: string | null;
  reference_type: ReferenceType | null;
  origin: string | null;
  customer_name: string | null;
  order_number: string;
  project_id: string | null;
  workflow_status: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  projects?: { id: string; project_number: string; project_name: string } | null;
}

export interface WorkflowStepInstance {
  id: string;
  step_key: string;
  name: string;
  order_index: number;
  role_required: string | null;
  form_id: string | null;
  is_mandatory: boolean;
  step_type: string;
}

export interface WorkflowTaskInstance {
  id: string;
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
  notes: string | null;
}

const OWO = "work_object_origins" as const;
const WT = "workflow_templates" as const;
const WTS = "workflow_template_steps" as const;
const SPM = "service_package_workflow_map" as const;
const OWI = "order_workflow_instances" as const;
const OWT = "order_workflow_tasks" as const;
const SWS = "service_workflow_steps" as const;
const MO = "measurement_orders" as const;

// ------------------- Origins & Vorlagen (Konfig) ------------------------

export const workObjectOrigins = {
  list: () =>
    unwrap(
      dbClient.from(OWO as any).select("*").order("sort_order")
    ) as unknown as Promise<WorkObjectOrigin[]>,
  create: (input: Partial<WorkObjectOrigin> & { key: string; label_de: string; label_en: string }) =>
    unwrap(dbClient.from(OWO as any).insert(input as any).select().single()) as unknown as Promise<WorkObjectOrigin>,
  update: (id: string, updates: Partial<WorkObjectOrigin>) =>
    run(dbClient.from(OWO as any).update(updates as any).eq("id", id)),
  remove: (id: string) => run(dbClient.from(OWO as any).delete().eq("id", id)),
};

export const workflowTemplates = {
  list: () =>
    unwrap(
      dbClient.from(WT as any).select("*").order("name")
    ) as unknown as Promise<WorkflowTemplate[]>,
  get: (id: string) =>
    unwrap(dbClient.from(WT as any).select("*").eq("id", id).single()) as unknown as Promise<WorkflowTemplate>,
  create: (input: Partial<WorkflowTemplate> & { key: string; name: string }) =>
    unwrap(dbClient.from(WT as any).insert(input as any).select().single()) as unknown as Promise<WorkflowTemplate>,
  update: (id: string, updates: Partial<WorkflowTemplate>) =>
    run(dbClient.from(WT as any).update(updates as any).eq("id", id)),
  remove: (id: string) => run(dbClient.from(WT as any).delete().eq("id", id)),

  listSteps: (templateId: string) =>
    unwrap(
      dbClient.from(WTS as any).select("*").eq("template_id", templateId).order("order_index")
    ) as unknown as Promise<WorkflowTemplateStep[]>,
  createStep: (input: Partial<WorkflowTemplateStep> & { template_id: string; step_key: string; name: string; order_index: number }) =>
    unwrap(dbClient.from(WTS as any).insert(input as any).select().single()) as unknown as Promise<WorkflowTemplateStep>,
  updateStep: (id: string, updates: Partial<WorkflowTemplateStep>) =>
    run(dbClient.from(WTS as any).update(updates as any).eq("id", id)),
  removeStep: (id: string) => run(dbClient.from(WTS as any).delete().eq("id", id)),
};

export const servicePackageWorkflowMap = {
  get: (packageId: string) =>
    unwrap(
      dbClient.from(SPM as any).select("*").eq("package_id", packageId).maybeSingle()
    ) as unknown as Promise<any | null>,
  upsert: (input: { package_id: string; template_id: string; requires_kneading?: boolean; prepend_steps?: unknown[]; append_steps?: unknown[]; }) =>
    unwrap(
      dbClient.from(SPM as any).upsert(input as any, { onConflict: "package_id" }).select().single()
    ) as unknown as Promise<any>,
  remove: (packageId: string) => run(dbClient.from(SPM as any).delete().eq("package_id", packageId)),
};

// ------------------- Arbeitsobjekte (Runtime) ---------------------------

const SELECT_SUMMARY =
  "id, reference_number, reference_type, origin, customer_name, order_number, project_id, workflow_status, status, priority, due_date, created_by, created_at, projects(id, project_number, project_name)";

export const workObjects = {
  list: (filters?: { origin?: string; referenceType?: ReferenceType; status?: string }) => {
    let q = dbClient.from(MO as any).select(SELECT_SUMMARY).order("created_at", { ascending: false });
    if (filters?.origin) q = q.eq("origin", filters.origin);
    if (filters?.referenceType) q = q.eq("reference_type", filters.referenceType);
    if (filters?.status) q = q.eq("workflow_status", filters.status);
    return unwrap(q) as unknown as Promise<WorkObjectSummary[]>;
  },

  get: (id: string) =>
    unwrap(dbClient.from(MO as any).select(SELECT_SUMMARY).eq("id", id).single()) as unknown as Promise<WorkObjectSummary>,

  updateIdentity: (id: string, patch: { reference_number?: string; reference_type?: ReferenceType; origin?: string; customer_name?: string | null; }) =>
    run(dbClient.from(MO as any).update(patch as any).eq("id", id)),

  /** Workflow-Progress für ein Arbeitsobjekt: alle Steps + jeweiliger Task-Status */
  getProgress: async (orderId: string) => {
    const instance = (await unwrap(
      dbClient.from(OWI as any).select("*").eq("order_id", orderId).maybeSingle()
    )) as any;
    if (!instance) return { instance: null, steps: [] as Array<WorkflowStepInstance & { task: WorkflowTaskInstance | null }> };

    const steps = (await unwrap(
      dbClient.from(SWS as any).select("*").eq("workflow_id", instance.workflow_id).order("order_index")
    )) as unknown as WorkflowStepInstance[];

    const tasks = (await unwrap(
      dbClient.from(OWT as any).select("*").eq("order_id", orderId)
    )) as unknown as WorkflowTaskInstance[];

    const merged = steps.map((s) => ({ ...s, task: tasks.find((t) => t.step_id === s.id) ?? null }));
    return { instance, steps: merged };
  },
};

// ------------------- Meine Aufgaben (Runtime) ---------------------------

export const workTasks = {
  /**
   * Alle offenen Tasks, die dem User direkt zugewiesen ODER seiner Rolle
   * zugeordnet sind (assigned_to IS NULL + assigned_role match).
   */
  listMine: async (userId: string, roles: string[]) => {
    const orRoles = roles.length ? roles.map((r) => `assigned_role.eq.${r}`).join(",") : "";
    const filter = orRoles
      ? `assigned_to.eq.${userId},and(assigned_to.is.null,or(${orRoles}))`
      : `assigned_to.eq.${userId}`;
    const tasks = (await unwrap(
      dbClient
        .from(OWT as any)
        .select("*")
        .in("status", ["pending", "in_progress"])
        .or(filter)
        .order("due_at", { ascending: true, nullsFirst: false })
    )) as unknown as WorkflowTaskInstance[];

    if (tasks.length === 0) return [] as any[];

    const orderIds = Array.from(new Set(tasks.map((t) => t.order_id)));
    const stepIds = Array.from(new Set(tasks.map((t) => t.step_id)));

    const [orders, steps] = await Promise.all([
      unwrap(dbClient.from(MO as any).select(SELECT_SUMMARY).in("id", orderIds)) as unknown as Promise<WorkObjectSummary[]>,
      unwrap(dbClient.from(SWS as any).select("id, step_key, name, order_index, role_required, form_id, is_mandatory, step_type").in("id", stepIds)) as unknown as Promise<WorkflowStepInstance[]>,
    ]);
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    return tasks.map((t) => ({ ...t, order: orderMap.get(t.order_id) ?? null, step: stepMap.get(t.step_id) ?? null }));
  },

  get: (id: string) =>
    unwrap(dbClient.from(OWT as any).select("*").eq("id", id).single()) as unknown as Promise<WorkflowTaskInstance>,

  start: (id: string, userId: string) =>
    run(
      dbClient.from(OWT as any).update({
        status: "in_progress",
        opened_at: new Date().toISOString(),
        assigned_to: userId,
      } as any).eq("id", id)
    ),

  complete: (id: string, formResponse: Record<string, unknown>) =>
    run(
      dbClient.from(OWT as any).update({
        status: "completed",
        completed_at: new Date().toISOString(),
        form_response: formResponse,
      } as any).eq("id", id)
    ),

  updateNotes: (id: string, notes: string) =>
    run(dbClient.from(OWT as any).update({ notes } as any).eq("id", id)),
};
