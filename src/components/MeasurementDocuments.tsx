import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Eye, FileText } from "lucide-react";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";

interface Document {
  id: string;
  file_name: string;
  file_type: string | null;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface MeasurementDocumentsProps {
  measurementId: string;
  documents: Document[];
  orderId: string;
}

export default function MeasurementDocuments({ measurementId, documents, orderId }: MeasurementDocumentsProps) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const canUpload = role === "durchfuehrer" || role === "master";

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      await api.documents.upload({ measurementId, file, userId: user.id });
      toast.success("Datei hochgeladen");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    } catch (err: any) {
      toast.error("Upload fehlgeschlagen", { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const data = await api.documents.download(doc.storage_path);
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Download fehlgeschlagen", { description: err.message });
    }
  };

  return (
    <div className="space-y-2">
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 text-sm p-1.5 rounded border bg-muted/30">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1 min-w-0" title={doc.file_name}>{doc.file_name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(doc.uploaded_at).toLocaleDateString("de-DE")}
              </span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDownload(doc)}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {canUpload && (
        <label className="cursor-pointer inline-flex">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(e) => {
              if (e.target.files?.[0]) handleUpload(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild disabled={uploading}>
            <span><Upload className="h-3 w-3 mr-1" />{uploading ? "Lädt..." : "Hochladen"}</span>
          </Button>
        </label>
      )}
      {documents.length === 0 && !canUpload && (
        <span className="text-xs text-muted-foreground">Keine Dateien</span>
      )}
    </div>
  );
}
