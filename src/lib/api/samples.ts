import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const SAMPLE_SELECT =
  "*, projects(project_number, project_name), storage_locations:location_id(id, hall, room, shelf, position)";

export const samples = {
  list: () =>
    unwrap(
      dbClient.from("samples").select(SAMPLE_SELECT).order("created_at", { ascending: false })
    ),

  get: (id: string) =>
    unwrap(dbClient.from("samples").select(SAMPLE_SELECT).eq("id", id).single()),

  listChildren: (parentId: string) =>
    unwrap(
      dbClient
        .from("samples")
        .select(SAMPLE_SELECT)
        .eq("parent_sample_id", parentId)
        .order("created_at", { ascending: false })
    ),

  /** All order_measurements (services) linked to a sample via its orders. */
  async listMeasurements(sampleId: string) {
    const orders = await unwrap(
      dbClient
        .from("measurement_orders")
        .select("id, order_number")
        .eq("sample_id", sampleId)
    );
    const orderIds = (orders || []).map((o: any) => o.id);
    if (orderIds.length === 0) return [];
    const orderMap = new Map((orders || []).map((o: any) => [o.id, o]));
    const measurements = await unwrap(
      dbClient
        .from("order_measurements")
        .select(
          "id, measurement_number, status, updated_at, created_at, order_id, service_id, measurement_services(service_name, category), measurement_results(id, result_name, value, unit, measured_at)"
        )
        .in("order_id", orderIds)
        .order("updated_at", { ascending: false })
    );
    return (measurements || []).map((m: any) => ({
      ...m,
      measurement_orders: orderMap.get(m.order_id) || null,
    }));
  },

  async create(sample: Record<string, any>) {
    const data = await unwrap(
      dbClient
        .from("samples")
        .insert({
          ...sample,
          sample_number: "WILL_BE_OVERWRITTEN",
          hazard_categories: sample.hazard_categories || [],
        } as any)
        .select()
        .single()
    );
    await run(
      dbClient.from("sample_history").insert({
        sample_id: data.id,
        action: "created",
        user_id: sample.created_by,
        comment: null,
        metadata: {},
      } as any)
    );
    return data;
  },

  delete: (id: string) => run(dbClient.from("samples").delete().eq("id", id)),

  async updateStatus(args: {
    id: string;
    status: string;
    userId: string;
    comment?: string;
  }) {
    await run(
      dbClient
        .from("samples")
        .update({ status: args.status } as any)
        .eq("id", args.id)
    );
    await run(
      dbClient.from("sample_history").insert({
        sample_id: args.id,
        action: "status_changed",
        user_id: args.userId,
        comment: args.comment,
        metadata: { new_status: args.status },
      } as any)
    );
  },

  async updateLocation(args: {
    id: string;
    locationId: string | null;
    userId: string;
    comment?: string;
  }) {
    await run(
      dbClient
        .from("samples")
        .update({ location_id: args.locationId } as any)
        .eq("id", args.id)
    );
    await run(
      dbClient.from("sample_history").insert({
        sample_id: args.id,
        action: "location_changed",
        user_id: args.userId,
        comment: args.comment,
        metadata: { new_location_id: args.locationId },
      } as any)
    );
  },

  async handover(args: {
    id: string;
    fromUserId: string;
    toUserId: string;
    comment?: string;
  }) {
    await run(
      dbClient
        .from("samples")
        .update({ current_holder_id: args.toUserId } as any)
        .eq("id", args.id)
    );
    await run(
      dbClient.from("sample_history").insert({
        sample_id: args.id,
        action: "handover",
        user_id: args.fromUserId,
        comment: args.comment,
        metadata: { from_user: args.fromUserId, to_user: args.toUserId },
      } as any)
    );
  },

  /** Bulk-insert samples in chunks of 50. Returns total inserted. */
  async bulkInsert(rows: Array<Record<string, any>>, chunkSize = 50): Promise<number> {
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const batch = rows.slice(i, i + chunkSize);
      await run(dbClient.from("samples").insert(batch as any));
      total += batch.length;
    }
    return total;
  },
};

export const sampleHistory = {
  list: (sampleId: string) =>
    unwrap(
      dbClient
        .from("sample_history")
        .select("*")
        .eq("sample_id", sampleId)
        .order("created_at", { ascending: false })
    ),

  add: (entry: {
    sample_id: string;
    action: string;
    user_id: string;
    comment?: string;
    metadata?: any;
  }) =>
    unwrap(
      dbClient
        .from("sample_history")
        .insert({ ...entry, metadata: entry.metadata || {} } as any)
        .select()
        .single()
    ),
};

export const sampleDocuments = {
  list: (sampleId: string) =>
    unwrap(
      dbClient
        .from("sample_documents")
        .select("*")
        .eq("sample_id", sampleId)
        .order("uploaded_at", { ascending: false })
    ),

  add: (doc: {
    sample_id: string;
    file_name: string;
    file_type: string;
    storage_path: string;
    document_type: string;
    uploaded_by: string;
  }) =>
    unwrap(
      dbClient.from("sample_documents").insert(doc as any).select().single()
    ),
};
