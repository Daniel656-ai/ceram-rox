import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const ORDER_UPLOADS_BUCKET = "order-uploads";

export interface ServiceFieldTemplate {
  id: string;
  service_data_field_id: string;
  name: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const serviceFieldTemplates = {
  listForField: (fieldId: string) =>
    unwrap(
      dbClient
        .from("service_field_templates" as any)
        .select("*")
        .eq("service_data_field_id", fieldId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    ) as unknown as Promise<ServiceFieldTemplate[]>,

  async upload(fieldId: string, file: File, name: string, description?: string) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `templates/${fieldId}/${Date.now()}_${safe}`;
    const { error: upErr } = await dbClient.storage
      .from(ORDER_UPLOADS_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) throw upErr;
    const row = await unwrap(
      dbClient
        .from("service_field_templates" as any)
        .insert({
          service_data_field_id: fieldId,
          name,
          description: description ?? null,
          storage_path: path,
          file_name: file.name,
          file_type: file.type || null,
          file_size_bytes: file.size,
        } as any)
        .select()
        .single()
    );
    return row as unknown as ServiceFieldTemplate;
  },

  update: (id: string, patch: Partial<Pick<ServiceFieldTemplate, "name" | "description" | "is_active" | "sort_order">>) =>
    run(dbClient.from("service_field_templates" as any).update(patch as any).eq("id", id)),

  async remove(id: string) {
    const row = (await unwrap(
      dbClient.from("service_field_templates" as any).select("storage_path").eq("id", id).single()
    )) as unknown as { storage_path: string };
    if (row?.storage_path) {
      await dbClient.storage.from(ORDER_UPLOADS_BUCKET).remove([row.storage_path]);
    }
    await run(dbClient.from("service_field_templates" as any).delete().eq("id", id));
  },

  async signedUrl(storagePath: string, expiresIn = 300) {
    const { data } = await dbClient.storage
      .from(ORDER_UPLOADS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    return data?.signedUrl ?? null;
  },

  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await dbClient.storage.from(ORDER_UPLOADS_BUCKET).download(storagePath);
    if (error) throw error;
    return data;
  },
};
