import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type DocumentKind = "report" | "email" | "label" | "certificate";
export type DocumentFormat = "html" | "markdown" | "text";

export interface ServiceDocumentTemplate {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  kind: DocumentKind;
  format: DocumentFormat;
  content: string;
  paper: string;
  orientation: "portrait" | "landscape";
  header_html: string | null;
  footer_html: string | null;
  enabled: boolean;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceDocumentTemplates = {
  listForService: (serviceId: string) =>
    unwrap(
      dbClient
        .from("service_document_templates" as any)
        .select("*")
        .eq("service_id", serviceId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    ) as unknown as Promise<ServiceDocumentTemplate[]>,

  create: (tpl: Partial<ServiceDocumentTemplate> & { service_id: string; name: string }) =>
    unwrap(
      dbClient
        .from("service_document_templates" as any)
        .insert(tpl as any)
        .select()
        .single()
    ) as unknown as Promise<ServiceDocumentTemplate>,

  update: (id: string, updates: Partial<ServiceDocumentTemplate>) =>
    run(dbClient.from("service_document_templates" as any).update(updates as any).eq("id", id)),

  delete: (id: string) =>
    run(dbClient.from("service_document_templates" as any).delete().eq("id", id)),
};
