/**
 * Bildfelder im Formulardesigner – gemeinsame Datenstruktur.
 *
 * Der Feldtyp „Bild" kennt zwei Darstellungsarten:
 *  - `single` (Standard, bisheriges Verhalten): genau ein Bild
 *  - `multi`  (Fotodokumentation): beliebig viele Bilder mit Kommentar
 *
 * Gespeichert wird IMMER eine Liste von Einträgen. Jeder Eintrag hält die
 * Datei (Storage-Pfad im bestehenden Bucket `order-uploads`), einen optionalen
 * Kommentar und die Reihenfolge. Alte Werte (String/URL/Objekt) werden beim
 * Lesen verlustfrei normalisiert – bestehende Formulare bleiben lauffähig.
 */

export type ImageFieldMode = "single" | "multi";

export interface ImageEntry {
  /** Stabile ID innerhalb der Sammlung (für React-Keys und Zuordnung). */
  id: string;
  /** Pfad im Storage-Bucket `order-uploads` (leer bei Vorschau/Designer). */
  storage_path: string | null;
  /** Datenbank-ID in `order_upload_files`, falls persistiert. */
  upload_id: string | null;
  /** Lokale Vorschau (Designer/Vorschau ohne Auftragskontext). */
  data_url: string | null;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  /** Optionaler Kommentar – gehört genau zu diesem Bild. */
  comment: string;
  /** Reihenfolge in der Fotodokumentation (0-basiert). */
  sort_order: number;
}

export interface ImageFieldMeta {
  mode: ImageFieldMode;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Konfiguration lesen. Vorrang hat `metadata.image.mode` (Formulardesigner).
 * Fehlt sie, entscheidet die Upload-Konfiguration (`validation.upload`):
 * `multiple !== false` bzw. `max_files > 1` bedeutet Fotodokumentation.
 */
export function readImageMeta(
  field: { metadata?: unknown; validation?: unknown } | null | undefined
): ImageFieldMeta {
  const m = ((field?.metadata ?? {}) as any)?.image ?? {};
  if (m.mode === "multi" || m.mode === "single") return { mode: m.mode };
  const up = ((field?.validation ?? {}) as any)?.upload ?? {};
  if (up.multiple === false) return { mode: "single" };
  if (up.multiple === true || (typeof up.max_files === "number" && up.max_files > 1)) {
    return { mode: "multi" };
  }
  return { mode: "multi" };
}


/** Konfiguration additiv in bestehende Metadaten schreiben. */
export function writeImageMeta(
  metadata: Record<string, unknown> | null | undefined,
  patch: Partial<ImageFieldMeta>
): Record<string, unknown> {
  const base = { ...((metadata ?? {}) as Record<string, unknown>) };
  const cur = (base.image ?? {}) as ImageFieldMeta;
  base.image = { mode: "single", ...cur, ...patch };
  return base;
}

function entryFrom(raw: any, index: number): ImageEntry | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    const isData = s.startsWith("data:");
    return {
      id: uid(),
      storage_path: isData ? null : s,
      upload_id: null,
      data_url: isData ? s : null,
      file_name: isData ? "Bild" : s.split("/").pop() || "Bild",
      file_type: null,
      file_size: null,
      comment: "",
      sort_order: index,
    };
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, any>;
  const path =
    o.storage_path ?? o.storagePath ?? o.path ?? (typeof o.url === "string" && !o.url.startsWith("data:") ? o.url : null);
  const dataUrl = o.data_url ?? o.dataUrl ?? (typeof o.url === "string" && o.url.startsWith("data:") ? o.url : null);
  if (!path && !dataUrl) return null;
  return {
    id: typeof o.id === "string" ? o.id : uid(),
    storage_path: path ?? null,
    upload_id: o.upload_id ?? o.uploadId ?? null,
    data_url: dataUrl ?? null,
    file_name: o.file_name ?? o.name ?? "Bild",
    file_type: o.file_type ?? o.type ?? null,
    file_size: typeof o.file_size === "number" ? o.file_size : typeof o.size === "number" ? o.size : null,
    comment: typeof o.comment === "string" ? o.comment : typeof o.caption === "string" ? o.caption : "",
    sort_order: typeof o.sort_order === "number" ? o.sort_order : index,
  };
}

/**
 * Beliebigen gespeicherten Wert in eine Bildsammlung überführen.
 * Akzeptiert: null, String, JSON-String, Array, `{ images: [...] }`.
 */
export function normalizeImageValue(value: unknown): ImageEntry[] {
  if (value == null || value === "") return [];
  let v: any = value;
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[") || s.startsWith("{")) {
      try { v = JSON.parse(s); } catch { /* Klartext-Pfad */ }
    }
  }
  const list = Array.isArray(v) ? v : Array.isArray(v?.images) ? v.images : [v];
  const out: ImageEntry[] = [];
  list.forEach((raw: any, i: number) => {
    const e = entryFrom(raw, i);
    if (e) out.push(e);
  });
  return reindex(out.sort((a, b) => a.sort_order - b.sort_order));
}

/** Reihenfolge lückenlos neu vergeben (nach Löschen/Verschieben). */
export function reindex(entries: ImageEntry[]): ImageEntry[] {
  return entries.map((e, i) => ({ ...e, sort_order: i }));
}

export function moveEntry(entries: ImageEntry[], from: number, to: number): ImageEntry[] {
  if (from === to || from < 0 || to < 0 || from >= entries.length || to >= entries.length) return entries;
  const next = [...entries];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return reindex(next);
}

export function newImageEntry(part: Partial<ImageEntry>): ImageEntry {
  return {
    id: uid(),
    storage_path: null,
    upload_id: null,
    data_url: null,
    file_name: "Bild",
    file_type: null,
    file_size: null,
    comment: "",
    sort_order: 0,
    ...part,
  };
}

/** Prüft, ob ein Wert eine Bildsammlung ist (für Ergebnisanzeige/Bericht). */
export function isImageCollection(value: unknown): boolean {
  const list = normalizeImageValue(value);
  return list.length > 0 && list.every((e) => !!e.storage_path || !!e.data_url);
}
