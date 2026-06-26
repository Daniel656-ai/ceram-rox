import { dbClient } from "./client";
import { unwrap } from "./_helpers";

const BUCKET = "project-documents";

export type ProjectDocKind = "application" | "report";

export interface ProjectDocument {
  id: string;
  project_id: string;
  doc_kind: ProjectDocKind;
  version_major: number;
  version_minor: number;
  version_label: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  change_comment: string | null;
  is_current: boolean;
  uploaded_by: string;
  created_at: string;
}

export const projectDocuments = {
  list: (projectId: string, kind?: ProjectDocKind) => {
    let q: any = dbClient.from("project_documents" as any).select("*").eq("project_id", projectId);
    if (kind) q = q.eq("doc_kind", kind);
    return unwrap(q.order("created_at", { ascending: false })) as unknown as Promise<ProjectDocument[]>;
  },

  async upload(args: {
    projectId: string;
    kind: ProjectDocKind;
    file: File;
    bumpMajor?: boolean;
    changeComment?: string;
    onProgress?: (pct: number) => void;
  }): Promise<ProjectDocument> {
    const safeName = args.file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${args.projectId}/${args.kind}/${Date.now()}_${safeName}`;
    const { error: upErr } = await dbClient.storage
      .from(BUCKET)
      .upload(path, args.file, { contentType: args.file.type || undefined, upsert: false });
    if (upErr) throw upErr;
    args.onProgress?.(100);

    const { data, error } = await dbClient.rpc("add_project_document" as any, {
      _project_id: args.projectId,
      _doc_kind: args.kind,
      _file_name: args.file.name,
      _file_type: args.file.type || null,
      _file_size: args.file.size,
      _storage_path: path,
      _bump_major: !!args.bumpMajor,
      _change_comment: args.changeComment || null,
    });
    if (error) {
      await dbClient.storage.from(BUCKET).remove([path]);
      throw error;
    }
    const id = data as unknown as string;
    const row = await unwrap(
      dbClient.from("project_documents" as any).select("*").eq("id", id).single()
    );
    return row as ProjectDocument;
  },

  async signedUrl(storagePath: string, expiresIn = 300): Promise<string | null> {
    const { data } = await dbClient.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
    return data?.signedUrl ?? null;
  },

  async download(storagePath: string): Promise<Blob> {
    const { data, error } = await dbClient.storage.from(BUCKET).download(storagePath);
    if (error) throw error;
    return data;
  },

  async remove(doc: ProjectDocument): Promise<void> {
    await dbClient.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await dbClient.from("project_documents" as any).delete().eq("id", doc.id);
    if (error) throw error;
  },
};
