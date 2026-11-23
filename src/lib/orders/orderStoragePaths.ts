export interface StorageFileRef {
  bucket: string;
  path: string | null | undefined;
}

/** Gruppiert Speicherpfade je Bucket, ohne leere Pfade und ohne Doppelte. */
export function groupStoragePaths(files: ReadonlyArray<StorageFileRef>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of files) {
    const path = f.path?.trim();
    if (!path) continue;
    const list = out.get(f.bucket) ?? [];
    if (!list.includes(path)) list.push(path);
    out.set(f.bucket, list);
  }
  return out;
}
