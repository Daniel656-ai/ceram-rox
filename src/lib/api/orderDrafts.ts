import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Auftragsentwürfe (Drafts) — vollständig additive Funktion.
 *
 * Ein Entwurf ist KEIN produktiver Auftrag: er erzeugt keine Auftragsnummer,
 * keine Aufgaben, keinen Workflow, keine Arbeitszeit und keine Ergebnisse.
 * Er speichert ausschließlich den Bearbeitungsstand des Auftraggeberformulars
 * als JSON. Bestehende Aufträge werden dadurch nie verändert.
 */

export interface OrderDraftPayload {
  selectedProjectId?: string;
  orderType?: string;
  orderKind?: "labor" | "pilot_plant";
  dueDate?: string;
  notes?: string;
  measurements?: Array<{
    uid: string;
    service_id: string;
    service_name: string;
    source_package_id?: string | null;
    source_package_name?: string | null;
  }>;
  selectedSampleIds?: string[];
  processTemplateId?: string;
  measurementParams?: Record<string, Record<string, string>>;
  measurementFormValues?: Record<string, Record<string, unknown>>;
  dynamicValues?: Record<string, unknown>;
  dynamicFormId?: string | null;
}

export interface OrderDraft {
  id: string;
  created_by: string;
  title: string | null;
  project_id: string | null;
  order_kind: string | null;
  service_count: number;
  payload: OrderDraftPayload;
  source_order_id: string | null;
  source_draft_id: string | null;
  source_label: string | null;
  copy_options: Record<string, boolean> | null;
  template_baseline: OrderDraftPayload | null;
  copied_at: string | null;
  copied_by: string | null;
  created_at: string;
  updated_at: string;
  projects?: { project_number: string; project_name: string | null } | null;
}

const SELECT = "*, projects(project_number, project_name)";

/**
 * Entfernt alles, was nicht JSON-serialisierbar ist (z. B. `File`-Objekte aus
 * Upload-Feldern). Anhänge werden bewusst nicht im Entwurf gespeichert.
 */
export function sanitizeDraftPayload<T>(value: T): T {
  const seen = new WeakSet<object>();
  const walk = (v: any): any => {
    if (v == null) return v;
    if (typeof File !== "undefined" && v instanceof File) return undefined;
    if (typeof Blob !== "undefined" && v instanceof Blob) return undefined;
    if (typeof v === "function") return undefined;
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== undefined);
    if (typeof v === "object") {
      if (seen.has(v)) return undefined;
      seen.add(v);
      const out: Record<string, any> = {};
      for (const [k, val] of Object.entries(v)) {
        const w = walk(val);
        if (w !== undefined) out[k] = w;
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

export const orderDrafts = {
  listMine: (userId: string) =>
    unwrap(
      dbClient
        .from("order_drafts" as any)
        .select(SELECT)
        .eq("created_by", userId)
        .order("updated_at", { ascending: false })
    ) as unknown as Promise<OrderDraft[]>,

  get: (id: string) =>
    unwrap(
      dbClient.from("order_drafts" as any).select(SELECT).eq("id", id).maybeSingle()
    ) as unknown as Promise<OrderDraft | null>,

  create: (input: {
    created_by: string;
    title?: string | null;
    project_id?: string | null;
    order_kind?: string | null;
    service_count?: number;
    payload: OrderDraftPayload;
    source_order_id?: string | null;
    source_draft_id?: string | null;
    source_label?: string | null;
    copy_options?: Record<string, boolean> | null;
    template_baseline?: OrderDraftPayload | null;
    copied_at?: string | null;
    copied_by?: string | null;
  }) =>
    unwrap(
      dbClient
        .from("order_drafts" as any)
        .insert(sanitizeDraftPayload(input) as any)
        .select(SELECT)
        .single()
    ) as unknown as Promise<OrderDraft>,

  update: (
    id: string,
    updates: {
      title?: string | null;
      project_id?: string | null;
      order_kind?: string | null;
      service_count?: number;
      payload?: OrderDraftPayload;
    }
  ) =>
    run(
      dbClient
        .from("order_drafts" as any)
        .update(sanitizeDraftPayload(updates) as any)
        .eq("id", id)
    ),

  remove: (id: string) =>
    run(dbClient.from("order_drafts" as any).delete().eq("id", id)),
};
