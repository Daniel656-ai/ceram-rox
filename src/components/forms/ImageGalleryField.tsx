import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Trash2, ArrowUp, ArrowDown, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  normalizeImageValue, reindex, moveEntry, newImageEntry,
  type ImageEntry, type ImageFieldMode,
} from "@/lib/imageGallery";
import { useRuntimeMeasurementContext } from "@/components/curves/measurementContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Bildfeld des Formulardesigners (Einzelbild oder Fotodokumentation).
 *
 * Speicher: bestehende Upload-Infrastruktur (`order-uploads` + Tabelle
 * `order_upload_files`) über `api.orderUploads`. Die Zuordnung erfolgt über
 * Messung + Feldschlüssel, damit die bestehenden Rechte/RLS unverändert gelten.
 * Ohne Laufzeitkontext (Designer/Vorschau) bleiben Bilder rein lokal.
 */

/** Signierte URL für einen Storage-Pfad (mit einfachem Modul-Cache). */
const urlCache = new Map<string, { url: string; at: number }>();
const TTL = 4 * 60 * 1000;

export function useImageUrl(entry: ImageEntry | null): string | null {
  const [url, setUrl] = useState<string | null>(entry?.data_url ?? null);
  const path = entry?.storage_path ?? null;
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(entry?.data_url ?? null); return; }
    const cached = urlCache.get(path);
    if (cached && Date.now() - cached.at < TTL) { setUrl(cached.url); return; }
    api.orderUploads
      .signedUrl(path, 600)
      .then((u) => {
        if (!alive || !u) return;
        urlCache.set(path, { url: u, at: Date.now() });
        setUrl(u);
      })
      .catch(() => { /* Vorschau bleibt leer */ });
    return () => { alive = false; };
  }, [path, entry?.data_url]);
  return url;
}

function ImageThumb({ entry, className }: { entry: ImageEntry; className?: string }) {
  const url = useImageUrl(entry);
  if (!url) {
    return (
      <div className={className ?? "h-40 w-full rounded-md border bg-muted/40 flex items-center justify-center"}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={entry.comment || entry.file_name}
      loading="lazy"
      className={className ?? "h-40 w-full rounded-md border object-contain bg-muted/20"}
    />
  );
}

interface Props {
  fieldKey: string;
  mode: ImageFieldMode;
  value: unknown;
  onChange: (entries: ImageEntry[]) => void;
  disabled?: boolean;
  /** Reine Ausgabe (Ergebnis-/Fotodokumentation). */
  readOnly?: boolean;
}

export default function ImageGalleryField({ fieldKey, mode, value, onChange, disabled, readOnly }: Props) {
  const runtime = useRuntimeMeasurementContext();
  const { user } = useAuth();
  const entries = useMemo(() => normalizeImageValue(value), [value]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  /** In dieser Sitzung neu hochgeladene Dateien dürfen beim Löschen entfernt werden. */
  const freshUploads = useRef<Set<string>>(new Set());

  const multi = mode === "multi";
  const editable = !disabled && !readOnly;

  const persist = useCallback(
    async (file: File): Promise<ImageEntry> => {
      if (runtime?.orderMeasurementId && user?.id) {
        const row = await api.orderUploads.uploadFile({
          measurementId: runtime.orderMeasurementId,
          fieldKey,
          entryIndex: null,
          file,
          uploadedBy: user.id,
        });
        freshUploads.current.add(row.id);
        return newImageEntry({
          storage_path: row.storage_path,
          upload_id: row.id,
          file_name: row.file_name,
          file_type: row.file_type,
          file_size: row.file_size_bytes,
        });
      }
      // Kein Auftragskontext (Designer/Vorschau): lokale Vorschau
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("Datei konnte nicht gelesen werden"));
        r.readAsDataURL(file);
      });
      return newImageEntry({
        data_url: dataUrl, file_name: file.name, file_type: file.type, file_size: file.size,
      });
    },
    [runtime?.orderMeasurementId, user?.id, fieldKey]
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i.test(f.name));
    if (list.length === 0) { toast.error("Bitte eine Bilddatei auswählen"); return; }
    setBusy(true);
    try {
      if (replaceIdx != null) {
        const created = await persist(list[0]);
        const next = [...entries];
        next[replaceIdx] = { ...created, comment: next[replaceIdx]?.comment ?? "", sort_order: replaceIdx };
        onChange(reindex(next));
        setReplaceIdx(null);
      } else if (!multi) {
        const created = await persist(list[0]);
        onChange(reindex([{ ...created, comment: entries[0]?.comment ?? "" }]));
      } else {
        const created: ImageEntry[] = [];
        for (const f of list) created.push(await persist(f)); // unbegrenzte Anzahl
        onChange(reindex([...entries, ...created]));
      }
    } catch (e: any) {
      toast.error("Upload fehlgeschlagen", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (idx: number) => {
    const entry = entries[idx];
    const next = reindex(entries.filter((_, i) => i !== idx));
    onChange(next);
    // Datei nur entfernen, wenn sie in dieser Sitzung hochgeladen wurde und
    // daher von keinem bereits erzeugten Bericht referenziert sein kann.
    if (entry?.upload_id && freshUploads.current.has(entry.upload_id)) {
      try {
        await api.orderUploads.remove(entry.upload_id);
        freshUploads.current.delete(entry.upload_id);
      } catch { /* Referenz bleibt bestehen – keine Datenverluste */ }
    }
  };

  const setComment = (idx: number, comment: string) => {
    const next = [...entries];
    next[idx] = { ...next[idx], comment };
    onChange(reindex(next));
  };

  /* ---------------- Reine Ausgabe ---------------- */
  if (readOnly) {
    if (entries.length === 0) return <p className="text-xs text-muted-foreground">Keine Bilder</p>;
    return (
      <div className="space-y-4">
        {entries.map((e, i) => (
          <figure key={e.id} className="space-y-1">
            <figcaption className="text-xs font-medium text-muted-foreground">
              {multi ? `Foto ${i + 1}` : e.file_name}
            </figcaption>
            <ImageThumb entry={e} className="max-h-[420px] w-full rounded-md border object-contain bg-muted/20" />
            {e.comment && <p className="text-sm">{e.comment}</p>}
          </figure>
        ))}
      </div>
    );
  }

  /* ---------------- Bearbeitung ---------------- */
  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multi && replaceIdx == null}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {entries.map((e, i) => (
        <div key={e.id} className="rounded-md border p-3 space-y-2 bg-card">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="text-[11px]">
              {multi ? `Bild ${i + 1}` : "Bild"}
            </Badge>
            {editable && (
              <div className="flex items-center gap-1">
                {multi && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0}
                      title="Nach oben" onClick={() => onChange(moveEntry(entries, i, i - 1))}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === entries.length - 1}
                      title="Nach unten" onClick={() => onChange(moveEntry(entries, i, i + 1))}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Bild ersetzen"
                  onClick={() => { setReplaceIdx(i); inputRef.current?.click(); }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Bild löschen"
                  onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          <ImageThumb entry={e} />
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Kommentar (optional)</span>
            {multi ? (
              <Textarea rows={2} value={e.comment} disabled={!editable}
                placeholder="z. B. Ausgangszustand der Probe"
                onChange={(ev) => setComment(i, ev.target.value)} />
            ) : (
              <Input value={e.comment} disabled={!editable}
                placeholder="z. B. Ausgangszustand der Probe"
                onChange={(ev) => setComment(i, ev.target.value)} />
            )}
          </div>
        </div>
      ))}

      {editable && (multi || entries.length === 0) && (
        <Button type="button" variant="outline" size="sm" disabled={busy}
          onClick={() => { setReplaceIdx(null); inputRef.current?.click(); }}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
          {entries.length === 0 ? "Bild hinzufügen" : "weiteres Bild hinzufügen"}
        </Button>
      )}
      {!runtime?.orderMeasurementId && (
        <p className="text-[11px] text-muted-foreground">
          Vorschau: Bilder werden erst in der Aufgabenbearbeitung dauerhaft gespeichert.
        </p>
      )}
    </div>
  );
}
