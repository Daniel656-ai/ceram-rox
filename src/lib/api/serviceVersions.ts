import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type ServiceVersionEntity = "form_layout" | "document_template" | "block";
export type ServiceVersionStatus = "draft" | "published" | "archived";

export interface ServiceVersion {
  id: string;
  entity_type: ServiceVersionEntity;
  entity_id: string;
  service_id: string | null;
  version_no: number;
  label: string | null;
  status: ServiceVersionStatus;
  snapshot: any;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
  published_by: string | null;
}

export const serviceVersions = {
  list: (entityType: ServiceVersionEntity, entityId: string) =>
    unwrap(
      dbClient
        .from("service_versions" as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("version_no", { ascending: false })
    ) as unknown as Promise<ServiceVersion[]>,

  listForService: (serviceId: string) =>
    unwrap(
      dbClient
        .from("service_versions" as any)
        .select("*")
        .eq("service_id", serviceId)
        .order("created_at", { ascending: false })
    ) as unknown as Promise<ServiceVersion[]>,

  create: async (params: {
    entity_type: ServiceVersionEntity;
    entity_id: string;
    service_id?: string | null;
    snapshot: any;
    label?: string | null;
    change_summary?: string | null;
    status?: ServiceVersionStatus;
  }): Promise<ServiceVersion> => {
    // determine next version_no
    const existing = (await unwrap(
      dbClient
        .from("service_versions" as any)
        .select("version_no")
        .eq("entity_type", params.entity_type)
        .eq("entity_id", params.entity_id)
        .order("version_no", { ascending: false })
        .limit(1)
    )) as unknown as { version_no: number }[];
    const next = (existing?.[0]?.version_no ?? 0) + 1;

    const row = (await unwrap(
      dbClient
        .from("service_versions" as any)
        .insert({
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          service_id: params.service_id ?? null,
          version_no: next,
          label: params.label ?? `v${next}`,
          status: params.status ?? "draft",
          snapshot: params.snapshot,
          change_summary: params.change_summary ?? null,
        } as any)
        .select()
        .single()
    )) as unknown as ServiceVersion;
    return row;
  },

  publish: async (versionId: string) => {
    const ver = (await unwrap(
      dbClient.from("service_versions" as any).select("*").eq("id", versionId).single()
    )) as unknown as ServiceVersion;
    // archive other published versions of the same entity
    await run(
      dbClient
        .from("service_versions" as any)
        .update({ status: "archived" } as any)
        .eq("entity_type", ver.entity_type)
        .eq("entity_id", ver.entity_id)
        .eq("status", "published")
    );
    return run(
      dbClient
        .from("service_versions" as any)
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        } as any)
        .eq("id", versionId)
    );
  },

  archive: (versionId: string) =>
    run(
      dbClient
        .from("service_versions" as any)
        .update({ status: "archived" } as any)
        .eq("id", versionId)
    ),

  remove: (versionId: string) =>
    run(dbClient.from("service_versions" as any).delete().eq("id", versionId)),

  updateLabel: (versionId: string, label: string, change_summary?: string | null) =>
    run(
      dbClient
        .from("service_versions" as any)
        .update({ label, change_summary: change_summary ?? null } as any)
        .eq("id", versionId)
    ),
};
