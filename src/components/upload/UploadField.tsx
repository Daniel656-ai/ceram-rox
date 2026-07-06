import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, FileText, Image as ImageIcon, X, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ServiceFieldTemplate } from "@/lib/api/serviceFieldTemplates";

export interface UploadValidation {
  multiple?: boolean;
  max_files?: number;
  max_size_mb?: number;
  accepted_types?: string[]; // e.g. ["image/*", "application/pdf"]
  templates_enabled?: boolean;
}

/** Value stored in the form state for an upload field. */
export interface UploadValueEntry {
  /** Local ID for React keys */
  __id: string;
  /** Pending file to be uploaded on submit. */
  pendingFile?: File;
  /** Optional local object URL for preview (revoked on unmount). */
  previewUrl?: string;
  /** Stored path once uploaded (post-submit). */
  storagePath?: string;
  /** If chosen from a template, its id. */
  templateId?: string;
  name: string;
  type: string;
  size: number;
}

export type UploadValue = UploadValueEntry[];

interface Props {
  /** service_data_field id — used to look up templates. */
  fieldId: string;
  /** Field key used as label fallback. */
  fieldKey: string;
  label: string;
  helpText?: string | null;
  required?: boolean;
  disabled?: boolean;
  config?: UploadValidation | null;
  value: UploadValue;
  onChange: (v: UploadValue) => void;
  compact?: boolean;
}

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function matchesAccept(fileType: string, fileName: string, accepted: string[]): boolean {
  if (!accepted || accepted.length === 0) return true;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return accepted.some((a) => {
    const s = a.trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith(".")) return `.${ext}` === s;
    if (s.endsWith("/*")) return fileType.startsWith(s.slice(0, -1));
    return fileType === s;
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function UploadField({
  fieldId, fieldKey, label, helpText, required, disabled,
  config, value, onChange, compact,
}: Props) {
  const cfg = config ?? {};
  const multiple = !!cfg.multiple;
  const maxFiles = multiple ? Math.max(1, cfg.max_files ?? 10) : 1;
  const maxSize = Math.max(1, cfg.max_size_mb ?? 20) * 1024 * 1024;
  const accepted = cfg.accepted_types ?? [];
  const acceptAttr = accepted.length ? accepted.join(",") : undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);

  // Cleanup object URLs on unmount / value change
  useEffect(() => {
    return () => {
      for (const v of value) if (v.previewUrl) URL.revokeObjectURL(v.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: templates = [] } = useQuery({
    queryKey: ["service-field-templates", fieldId],
    queryFn: () => api.serviceFieldTemplates.listForField(fieldId),
    enabled: !!fieldId && !!cfg.templates_enabled,
  });
  const activeTemplates: ServiceFieldTemplate[] = useMemo(
    () => (templates as ServiceFieldTemplate[]).filter((t) => t.is_active),
    [templates]
  );

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    if (replaceIdx != null) {
      const f = list[0];
      const err = validateFile(f);
      if (err) { toast.error(err); return; }
      const next = [...value];
      if (next[replaceIdx]?.previewUrl) URL.revokeObjectURL(next[replaceIdx].previewUrl!);
      next[replaceIdx] = makeEntry(f);
      onChange(next);
      setReplaceIdx(null);
      return;
    }

    const room = maxFiles - value.length;
    if (room <= 0) {
      toast.error(`Maximal ${maxFiles} Datei${maxFiles === 1 ? "" : "en"} erlaubt`);
      return;
    }
    const accept: UploadValueEntry[] = [];
    for (const f of list.slice(0, room)) {
      const err = validateFile(f);
      if (err) { toast.error(`${f.name}: ${err}`); continue; }
      accept.push(makeEntry(f));
    }
    if (accept.length > 0) onChange([...value, ...accept]);
  };

  const validateFile = (f: File): string | null => {
    if (f.size > maxSize) return `zu groß (max ${cfg.max_size_mb ?? 20} MB)`;
    if (!matchesAccept(f.type, f.name, accepted)) return `Dateityp nicht erlaubt`;
    return null;
  };

  const makeEntry = (f: File): UploadValueEntry => {
    const isImage = (f.type || "").startsWith("image/");
    return {
      __id: uid(),
      pendingFile: f,
      previewUrl: isImage ? URL.createObjectURL(f) : undefined,
      name: f.name,
      type: f.type || "",
      size: f.size,
    };
  };

  const removeAt = (idx: number) => {
    const next = [...value];
    if (next[idx]?.previewUrl) URL.revokeObjectURL(next[idx].previewUrl!);
    next.splice(idx, 1);
    onChange(next);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const applyTemplate = (templateId: string) => {
    if (templateId === "__none__") return;
    const tpl = activeTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    if (!multiple && value.length > 0) {
      toast.error("Zuerst vorhandene Datei entfernen");
      return;
    }
    if (multiple && value.length >= maxFiles) {
      toast.error(`Maximal ${maxFiles} Dateien erlaubt`);
      return;
    }
    const entry: UploadValueEntry = {
      __id: uid(),
      templateId: tpl.id,
      name: tpl.file_name,
      type: tpl.file_type ?? "",
      size: tpl.file_size_bytes ?? 0,
    };
    onChange([...value, entry]);
    toast.success(`Vorlage „${tpl.name}" ausgewählt`);
  };

  const zoneCls = cn(
    "border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer",
    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60",
    disabled && "opacity-50 pointer-events-none",
    compact && "p-3 text-xs"
  );

  const canAddMore = value.length < maxFiles;

  return (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {helpText && !compact && <p className="text-[10px] text-muted-foreground">{helpText}</p>}

      {cfg.templates_enabled && activeTemplates.length > 0 && canAddMore && (
        <div className="flex items-center gap-2">
          <Select value="__none__" onValueChange={applyTemplate} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Vorlage auswählen…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" disabled>Vorlage auswählen…</SelectItem>
              {activeTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {canAddMore && (
        <div
          className={zoneCls}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
        >
          <UploadCloud className={cn("mx-auto text-muted-foreground", compact ? "h-4 w-4 mb-1" : "h-5 w-5 mb-1")} />
          <p className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
            {replaceIdx != null ? "Neue Datei auswählen…" : "Datei hierher ziehen oder klicken"}
          </p>
          {(accepted.length > 0 || cfg.max_size_mb) && !compact && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {accepted.length > 0 && <>{accepted.join(", ")} · </>}
              max {cfg.max_size_mb ?? 20} MB
              {multiple && <> · bis {maxFiles} Dateien</>}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple={multiple && replaceIdx == null}
            accept={acceptAttr}
            disabled={disabled}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((entry, idx) => (
            <li key={entry.__id} className="flex items-center gap-2 border rounded-md p-2 bg-muted/20">
              <FilePreviewIcon entry={entry} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{entry.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {entry.size ? bytesLabel(entry.size) : ""}
                  {entry.templateId && <> · <Badge variant="outline" className="text-[9px]">Vorlage</Badge></>}
                  {entry.pendingFile && <> · <span className="text-amber-600">wird beim Speichern hochgeladen</span></>}
                </p>
              </div>
              {!disabled && (
                <>
                  <Button
                    type="button" size="icon" variant="ghost" className="h-7 w-7"
                    title="Ersetzen"
                    onClick={() => { setReplaceIdx(idx); inputRef.current?.click(); }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    title="Entfernen"
                    onClick={() => removeAt(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilePreviewIcon({ entry }: { entry: UploadValueEntry }) {
  const isImage = (entry.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name);
  if (isImage && entry.previewUrl) {
    return <img src={entry.previewUrl} alt={entry.name} className="h-10 w-10 rounded object-cover border" />;
  }
  if (isImage) {
    return <div className="h-10 w-10 rounded border flex items-center justify-center bg-background"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>;
  }
  return <div className="h-10 w-10 rounded border flex items-center justify-center bg-background"><FileText className="h-4 w-4 text-muted-foreground" /></div>;
}
