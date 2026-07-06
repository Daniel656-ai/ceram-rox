import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Image as ImageIcon, Download, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DocumentPreviewDialog from "@/components/DocumentPreviewDialog";
import type { OrderUploadFile } from "@/lib/api/orderUploads";

function bytesLabel(n: number | null | undefined): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  measurementId: string;
  canDelete?: boolean;
}

export default function OrderUploadedFiles({ measurementId, canDelete }: Props) {
  const qc = useQueryClient();
  const { data: files = [] } = useQuery({
    queryKey: ["order-upload-files", measurementId],
    queryFn: () => api.orderUploads.listForMeasurement(measurementId),
  });
  const [preview, setPreview] = useState<OrderUploadFile | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.orderUploads.remove(id),
    onSuccess: () => {
      toast.success("Datei entfernt");
      qc.invalidateQueries({ queryKey: ["order-upload-files", measurementId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const doDownload = async (f: OrderUploadFile) => {
    try {
      const blob = await api.orderUploads.download(f.storage_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = f.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Download fehlgeschlagen", { description: e.message });
    }
  };

  // Group by field_key
  const grouped = new Map<string, OrderUploadFile[]>();
  for (const f of files) {
    const arr = grouped.get(f.field_key) ?? [];
    arr.push(f);
    grouped.set(f.field_key, arr);
  }
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([key, list]) => (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground">{key}</p>
            <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
          </div>
          <ul className="space-y-1.5">
            {list.map((f) => {
              const isImage = (f.file_type || "").startsWith("image/");
              return (
                <li key={f.id} className="flex items-center gap-2 border rounded-md p-2 bg-muted/10">
                  {isImage ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{f.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {bytesLabel(f.file_size_bytes)}
                      {f.template_id && <> · <Badge variant="secondary" className="text-[9px]">Vorlage</Badge></>}
                      {f.entry_index != null && <> · Eintrag #{f.entry_index + 1}</>}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Vorschau" onClick={() => setPreview(f)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Herunterladen" onClick={() => doDownload(f)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Löschen" onClick={() => remove.mutate(f.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {preview && (
        <DocumentPreviewDialog
          open={!!preview}
          onOpenChange={(o) => !o && setPreview(null)}
          fileName={preview.file_name}
          fileType={preview.file_type ?? undefined}
          loadBlob={() => api.orderUploads.download(preview.storage_path)}
        />
      )}
    </div>
  );
}
