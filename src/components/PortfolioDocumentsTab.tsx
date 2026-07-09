import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, Eye, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import DocumentPreviewDialog from "@/components/DocumentPreviewDialog";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "foerderantrag", label: "Förderantrag" },
  { value: "foerdervertrag", label: "Fördervertrag" },
  { value: "zwischenbericht", label: "Zwischenbericht" },
  { value: "endbericht", label: "Endbericht" },
  { value: "praesentation", label: "Präsentation" },
  { value: "publikation", label: "Publikation" },
  { value: "patent", label: "Patent" },
  { value: "nachweis", label: "Nachweis" },
  { value: "sonstiges", label: "Sonstiges" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

function bytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  portfolioId: string;
  canEdit: boolean;
}

export default function PortfolioDocumentsTab({ portfolioId, canEdit }: Props) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("sonstiges");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<any | null>(null);

  const { data: docs = [], isLoading } = useQuery<any[]>({
    queryKey: ["portfolio-documents", portfolioId],
    queryFn: () => api.portfolioDocuments.list(portfolioId) as any,
  });

  const uploadMut = useMutation({
    mutationFn: () => api.portfolioDocuments.upload({
      portfolioId,
      file: pendingFile!,
      category,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success("Dokument hochgeladen");
      setPendingFile(null);
      setTitle("");
      setDescription("");
      setCategory("sonstiges");
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["portfolio-documents", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-dashboard", portfolioId] });
    },
    onError: (e: any) => toast.error(e?.message || "Upload fehlgeschlagen"),
  });

  const removeMut = useMutation({
    mutationFn: (d: any) => api.portfolioDocuments.remove(d.id, d.file_path),
    onSuccess: () => {
      toast.success("Dokument entfernt");
      qc.invalidateQueries({ queryKey: ["portfolio-documents", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-dashboard", portfolioId] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const doDownload = async (d: any) => {
    try {
      const blob = await api.portfolioDocuments.download(d.file_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = d.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Download fehlgeschlagen", { description: e.message });
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Datei</Label>
                <Input
                  ref={fileInput}
                  type="file"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label>Kategorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Titel (optional)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pendingFile?.name ?? "z. B. Zwischenbericht Q2"} />
              </div>
            </div>
            <div>
              <Label>Beschreibung (optional)</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => uploadMut.mutate()}
                disabled={!pendingFile || uploadMut.isPending}
              >
                <Upload className="h-4 w-4 mr-2" /> Hochladen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Lade …</p>
          ) : docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Dokumente hinterlegt.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Dateiname</TableHead>
                  <TableHead className="text-right">Größe</TableHead>
                  <TableHead>Hochgeladen</TableHead>
                  <TableHead className="w-32 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {d.title}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline">{CATEGORY_LABEL[d.category] ?? d.category}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.file_name}</TableCell>
                    <TableCell className="text-right text-xs">{bytes(d.file_size)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.created_at ? new Date(d.created_at).toLocaleString("de-DE") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Vorschau" onClick={() => setPreview(d)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Herunterladen" onClick={() => doDownload(d)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            title="Löschen"
                            onClick={() => {
                              if (confirm(`Dokument „${d.title}" wirklich löschen?`)) removeMut.mutate(d);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {preview && (
        <DocumentPreviewDialog
          open={!!preview}
          onOpenChange={(o) => !o && setPreview(null)}
          fileName={preview.file_name}
          fileType={preview.mime_type ?? undefined}
          loadBlob={() => api.portfolioDocuments.download(preview.file_path)}
        />
      )}
    </div>
  );
}
