import { dbClient } from "./client";
import type { SystemContextData } from "@/lib/systemVariables";

/**
 * Prozessmanager: lädt den aktuellen Kontext (Auftrag, Probe, Projekt,
 * Benutzer, Prozess) als schreibgeschützte Datenbasis für alle Formulare.
 *
 * Es werden bewusst `select("*")` Abfragen verwendet: neue Standardspalten in
 * Auftrag/Probe/Projekt stehen dadurch automatisch als Systemvariablen bereit,
 * ohne dass hier oder im Formulardesigner etwas angepasst werden muss.
 */

export interface SystemContextRequest {
  orderId?: string | null;
  /** Auftrags-Instanz (order_instances) – optional, ergänzt den Prozesskontext. */
  orderInstanceId?: string | null;
  sampleId?: string | null;
  projectId?: string | null;
  /** Prozessvorlage (process_templates) */
  processTemplateId?: string | null;
  /** Aktueller Schrittname (falls die aufrufende Ansicht ihn kennt) */
  currentStepName?: string | null;
}

async function fetchOne(table: string, id: string): Promise<Record<string, unknown> | null> {
  const { data } = await (dbClient as any).from(table).select("*").eq("id", id).maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

async function profileName(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await dbClient
    .from("profiles")
    .select("first_name,last_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
}

export const systemContext = {
  async load(req: SystemContextRequest): Promise<SystemContextData> {
    const ctx: SystemContextData = {};

    // ---- Auftrag -----------------------------------------------------------
    let order: Record<string, unknown> | null = null;
    if (req.orderId) {
      order = await fetchOne("measurement_orders", req.orderId);
      if (!order) order = await fetchOne("order_instances", req.orderId);
    }
    if (!order && req.orderInstanceId) {
      order = await fetchOne("order_instances", req.orderInstanceId);
    }

    // ---- Projekt -----------------------------------------------------------
    const projectId = req.projectId ?? (order?.project_id as string | undefined) ?? null;
    let project: Record<string, unknown> | null = null;
    if (projectId) {
      project = await fetchOne("projects", projectId);
      if (project) {
        project = {
          ...project,
          project_manager_name: await profileName(project.created_by as string | null),
        };
      }
    }

    // ---- Probe -------------------------------------------------------------
    const sampleId =
      req.sampleId ??
      (order?.sample_id as string | undefined) ??
      ((order?.sample_ids as string[] | undefined)?.[0] ?? null);
    let sample: Record<string, unknown> | null = null;
    if (sampleId) sample = await fetchOne("samples", sampleId);

    if (order) {
      ctx.auftrag = {
        ...order,
        created_by_name: await profileName(order.created_by as string | null),
        project_name: (project?.project_name as string | undefined) ?? null,
        project_number: (project?.project_number as string | undefined) ?? null,
      };
    }
    if (project) ctx.projekt = project;
    if (sample) ctx.probe = sample;

    // ---- Benutzer ----------------------------------------------------------
    const { data: userRes } = await dbClient.auth.getUser();
    const authUser = userRes?.user;
    if (authUser) {
      const { data: prof } = await dbClient
        .from("profiles")
        .select("first_name,last_name,short_code")
        .eq("user_id", authUser.id)
        .maybeSingle();
      const { data: role } = await (dbClient as any).rpc("get_user_role", { _user_id: authUser.id });
      ctx.user = {
        id: authUser.id,
        email: authUser.email ?? null,
        full_name:
          [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") ||
          (authUser.email ?? null),
        short_code: prof?.short_code ?? null,
        role: (role as string | null) ?? null,
      };
    }

    // ---- Prozess -----------------------------------------------------------
    const templateId =
      req.processTemplateId ?? (order?.template_id as string | undefined) ?? null;
    let process: Record<string, unknown> | null = null;
    if (templateId) process = await fetchOne("process_templates", templateId);

    if (order?.id) {
      const { data: run } = await dbClient
        .from("order_step_runs")
        .select("step_key,status,order_index")
        .eq("order_id", order.id as string)
        .in("status", ["in_progress", "pending"])
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (run || process) {
        process = {
          ...(process ?? {}),
          id: (process?.id as string | undefined) ?? templateId ?? null,
          status:
            (order.workflow_status as string | undefined) ??
            (order.status as string | undefined) ??
            null,
          current_step_name: req.currentStepName ?? run?.step_key ?? null,
          current_step_index: run?.order_index ?? null,
        };
      }
    } else if (process && req.currentStepName) {
      process = { ...process, current_step_name: req.currentStepName };
    }
    if (process) ctx.prozess = process;

    return ctx;
  },
};
