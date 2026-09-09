import { dbClient } from "./client";
import { unwrap } from "./_helpers";
import type { DocKind, DocStatus } from "@/lib/productionDocuments/requirements";

const db = dbClient as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ProductionDocumentRequest {
  id: string;
  order_id: string;
  doc_kind: DocKind;
  status: Exclude<DocStatus, "nicht_angefordert">;
  based_on_release_id: string | null;
  missing: string[];
  notes: string | null;
  requested_by: string | null;
  requested_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  measurement_orders?: { id: string; order_number: string | null } | null;
}

const SELECT =
  "id,order_id,doc_kind,status,based_on_release_id,missing,notes,requested_by,requested_at,completed_at,created_at,updated_at";

export const productionDocuments = {
  /** Alle Folgeprozesse (optional gefiltert nach Auftrag oder Art). */
  async list(opts: { orderId?: string; kind?: DocKind } = {}): Promise<ProductionDocumentRequest[]> {
    let q = db
      .from("production_document_requests")
      .select(`${SELECT}, measurement_orders(id, order_number)`)
      .order("requested_at", { ascending: false });
    if (opts.orderId) q = q.eq("order_id", opts.orderId);
    if (opts.kind) q = q.eq("doc_kind", opts.kind);
    return (await unwrap(q)) as ProductionDocumentRequest[];
  },

  /** Anfordern – bestehende Anforderung bleibt erhalten (Upsert je Auftrag/Art). */
  async request(args: {
    orderId: string;
    kind: DocKind;
    status: Exclude<DocStatus, "nicht_angefordert">;
    basedOnReleaseId: string | null;
    missing: string[];
    requestedBy: string | null;
  }): Promise<ProductionDocumentRequest> {
    return (await unwrap(
      db
        .from("production_document_requests")
        .upsert(
          {
            order_id: args.orderId,
            doc_kind: args.kind,
            status: args.status,
            based_on_release_id: args.basedOnReleaseId,
            missing: args.missing,
            requested_by: args.requestedBy,
          },
          { onConflict: "order_id,doc_kind" }
        )
        .select(SELECT)
        .single()
    )) as ProductionDocumentRequest;
  },

  async update(
    id: string,
    fields: Partial<{
      status: Exclude<DocStatus, "nicht_angefordert">;
      based_on_release_id: string | null;
      missing: string[];
      notes: string | null;
      completed_at: string | null;
    }>
  ): Promise<void> {
    await unwrap(db.from("production_document_requests").update(fields).eq("id", id));
  },

  async remove(id: string): Promise<void> {
    await unwrap(db.from("production_document_requests").delete().eq("id", id));
  },

  /** Fertigungsfreigaben eines Auftrags – alle Revisionen, älteste zuerst. */
  async releasesForOrder(orderId: string) {
    return (await unwrap(
      db
        .from("production_releases")
        .select(
          "id,release_number,revision_number,status,is_current,import_status,superseded_at,order_id,created_at"
        )
        .eq("order_id", orderId)
        .order("revision_number", { ascending: true })
    )) as Array<Record<string, unknown>>;
  },

  /** Zuordnung einer Fertigungsfreigabe (Stammsatz inkl. Revisionen) zum Auftrag. */
  async linkReleaseToOrder(releaseId: string, orderId: string | null): Promise<void> {
    const row = (await unwrap(
      db.from("production_releases").select("id,root_release_id").eq("id", releaseId).maybeSingle()
    )) as { id: string; root_release_id: string | null } | null;
    const rootId = row?.root_release_id ?? releaseId;
    await unwrap(
      db.from("production_releases").update({ order_id: orderId }).or(`id.eq.${rootId},root_release_id.eq.${rootId}`)
    );
  },
};
