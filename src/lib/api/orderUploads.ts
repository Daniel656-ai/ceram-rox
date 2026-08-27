import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";
import { ORDER_UPLOADS_BUCKET } from "./serviceFieldTemplates";

export interface OrderUploadFile {
  id: string;
  measurement_id: string;
  field_key: string;
  entry_index: number | null;
  template_id: string | null;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

/**
 * Übersetzt Storage-Fehler in eine verständliche, ursachennahe Meldung.
 * Der Fehler wird NICHT unterdrückt – er benennt lediglich den betroffenen
 * Bucket, damit ein fehlendes Storage-Setup in einer Umgebung sofort
 * erkennbar ist (siehe `supabase/storage/bootstrap-buckets.sql`).
 */
function storageError(err: { message?: string } & Record<string, unknown>): Error {
  const msg = String(err?.message ?? err);
  if (/bucket not found/i.test(msg)) {
    return new Error(
      `Storage-Bucket "${ORDER_UPLOADS_BUCKET}" existiert in dieser Umgebung nicht. ` +
        `Bitte das Storage-Setup ausführen (supabase/storage/bootstrap-buckets.sql).`
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

export const orderUploads = {
  listForMeasurement: (measurementId: string) =>
    unwrap(
      dbClient
        .from("order_upload_files" as any)
        .select("*")
        .eq("measurement_id", measurementId)
        .order("created_at", { ascending: true })
    ) as unknown as Promise<OrderUploadFile[]>,

  async uploadFile(args: {
    measurementId: string;
    fieldKey: string;
    entryIndex?: number | null;
    file: File;
    uploadedBy: string;
    templateId?: string | null;
  }): Promise<OrderUploadFile> {
    const safe = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `orders/${args.measurementId}/${args.fieldKey}/${Date.now()}_${safe}`;
    const { error: upErr } = await dbClient.storage
      .from(ORDER_UPLOADS_BUCKET)
      .upload(path, args.file, { upsert: false, contentType: args.file.type });
    if (upErr) throw storageError(upErr as any);
    const row = await unwrap(
      dbClient
        .from("order_upload_files" as any)
        .insert({
          measurement_id: args.measurementId,
          field_key: args.fieldKey,
          entry_index: args.entryIndex ?? null,
          storage_path: path,
          file_name: args.file.name,
          file_type: args.file.type || null,
          file_size_bytes: args.file.size,
          uploaded_by: args.uploadedBy,
          template_id: args.templateId ?? null,
        } as any)
        .select()
        .single()
    );
    return row as unknown as OrderUploadFile;
  },

  /**
   * Copy a template's underlying file into the order and register a row.
   * The uploaded row references the template via template_id.
   */
  async attachTemplate(args: {
    measurementId: string;
    fieldKey: string;
    entryIndex?: number | null;
    template: { id: string; storage_path: string; file_name: string; file_type: string | null; file_size_bytes: number | null };
    uploadedBy: string;
  }): Promise<OrderUploadFile> {
    // Download template blob and re-upload to order path (kept separate for immutability)
    const { data: blob, error: dlErr } = await dbClient.storage
      .from(ORDER_UPLOADS_BUCKET)
      .download(args.template.storage_path);
    if (dlErr) throw dlErr;
    const file = new File([blob], args.template.file_name, {
      type: args.template.file_type || "application/octet-stream",
    });
    return orderUploads.uploadFile({
      measurementId: args.measurementId,
      fieldKey: args.fieldKey,
      entryIndex: args.entryIndex,
      file,
      uploadedBy: args.uploadedBy,
      templateId: args.template.id,
    });
  },

  async remove(id: string) {
    const row = (await unwrap(
      dbClient.from("order_upload_files" as any).select("storage_path").eq("id", id).single()
    )) as unknown as { storage_path: string };
    if (row?.storage_path) {
      await dbClient.storage.from(ORDER_UPLOADS_BUCKET).remove([row.storage_path]);
    }
    await run(dbClient.from("order_upload_files" as any).delete().eq("id", id));
  },

  async signedUrl(storagePath: string, expiresIn = 300) {
    const { data } = await dbClient.storage
      .from(ORDER_UPLOADS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    return data?.signedUrl ?? null;
  },

  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await dbClient.storage.from(ORDER_UPLOADS_BUCKET).download(storagePath);
    if (error) throw storageError(error as any);
    return data;
  },
};
