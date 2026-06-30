import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type WorkflowRoleKey =
  | "any_authenticated"
  | "creator"
  | "project_owner"
  | "project_leader"
  | "project_member"
  | "role:master"
  | "role:durchfuehrer"
  | "role:auftraggeber"
  | "perm:projects.edit"
  | "perm:raw_materials.manage"
  | "perm:mixtures.produce"
  | "perm:admin.system";

export interface WorkflowState {
  id: string;
  key: string;
  label: string;
  color: string; // hex
  description?: string;
  is_initial?: boolean;
  is_final?: boolean;
  sla_hours?: number | null;
}

export interface WorkflowTransition {
  id: string;
  label: string;
  from_state: string; // state id OR "*" wildcard
  to_state: string;   // state id
  allowed_roles: WorkflowRoleKey[];
  requires_comment?: boolean;
  notify?: boolean;
}

export interface WorkflowDefinition {
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  initial_state: string | null;
}

export interface ServiceWorkflow {
  id: string;
  service_id: string;
  definition: WorkflowDefinition;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceWorkflows = {
  get: async (serviceId: string): Promise<ServiceWorkflow | null> => {
    const rows = (await unwrap(
      dbClient
        .from("service_workflows" as any)
        .select("*")
        .eq("service_id", serviceId)
        .limit(1)
    )) as unknown as ServiceWorkflow[];
    return rows?.[0] ?? null;
  },

  upsert: (serviceId: string, definition: WorkflowDefinition) =>
    run(
      dbClient.from("service_workflows" as any).upsert(
        {
          service_id: serviceId,
          definition: definition as any,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "service_id" }
      )
    ),

  empty: (): WorkflowDefinition => ({ states: [], transitions: [], initial_state: null }),
};
