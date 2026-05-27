import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

const MEASUREMENT_BUCKET = "measurement-documents";

export const documents = {
  async upload(args: { measurementId: string; file: File; userId: string }) {
    const path = `${args.userId}/${args.measurementId}/${Date.now()}_${args.file.name}`;
    const { error: uploadErr } = await dbClient.storage.from(MEASUREMENT_BUCKET).upload(path, args.file);
    if (uploadErr) throw uploadErr;
    await run(
      dbClient.from("documents").insert({
        order_measurement_id: args.measurementId,
        file_name: args.file.name,
        file_type: args.file.type,
        storage_path: path,
        uploaded_by: args.userId,
      })
    );
    return { path };
  },

  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await dbClient.storage.from(MEASUREMENT_BUCKET).download(storagePath);
    if (error) throw error;
    return data;
  },
};

const SAMPLE_BUCKET = "sample-documents";
const RAWMAT_BUCKET = "raw-material-documents";

export const sampleStorage = {
  async upload(sampleId: string, file: File) {
    const path = `${sampleId}/${Date.now()}_${file.name}`;
    const { error } = await dbClient.storage.from(SAMPLE_BUCKET).upload(path, file);
    if (error) throw error;
    return { path };
  },
  async signedUrl(storagePath: string, expiresIn = 300): Promise<string | null> {
    const { data } = await dbClient.storage.from(SAMPLE_BUCKET).createSignedUrl(storagePath, expiresIn);
    return data?.signedUrl ?? null;
  },
};

export const rawMaterialStorage = {
  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await dbClient.storage.from(RAWMAT_BUCKET).download(storagePath);
    if (error) throw error;
    return data;
  },
};
