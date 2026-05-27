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
