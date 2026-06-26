import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type ProjectDocument, type ProjectDocKind } from "@/lib/api/projectDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Upload, History, Trash2, FileText, Replace } from "lucide-react";
import { toast } from "sonner";
import { useUsers } from "@/hooks/useUsers";

const MAX_FILE_MB = 200;
const APPLICATION_ACCEPT = ".pdf,application/pdf";
const REPORT_ACCEPT =
  ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx," +
  "application/pdf," +
  "application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation," +
  "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fmtBytes(n?: number | null) {
  if (!n && n !== 0) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE");
}

function useUserName() {
  const { data: users = [] } = useUsers();
  return (uid: string) => {
    const u = (users as any[]).find((u) => u.user_id === uid);
    return u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "–" : "–";
  };
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  kind: ProjectDocKind;
  current?: ProjectDocument | null;
  onSuccess: () => void;
}

function UploadDialog({ open, onOpenChange, projectId, kind, current, onSuccess }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [bumpMajor, setBumpMajor] = useState(false);
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = kind === "application" ? APPLICATION_ACCEPT : REPORT_ACCEPT;

  const reset = () => {
    setFile(null);
    setBumpMajor(false);
    setComment("");
    setProgress(0);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Keine Datei ausgewählt");
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`Datei zu groß (max. ${MAX_FILE_MB} MB)`);
      }
      setProgress(10);
      return api.projectDocuments.upload({
        projectId,
        kind,
        file,
        bumpMajor: kind === "report" ? bumpMajor : false,
        changeComment: comment || undefined,
        onProgress: setProgress,
      });
    },
    onSuccess: () => {
      toast.success("Dokument hochgeladen");
      reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Upload fehlgeschlagen"),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const nextVersionPreview = useMemo(() => {
    if (!current) return "1.0";
    if (kind === "application") return `${current.version_major + 1}.0`;
    return bumpMajor
      ? `${current.version_major + 1}.0`
      : `${current.version_major}.${current.version_minor + 1}`;
  }, [current, bumpMajor, kind]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "application" ? "Projektantrag hochladen" : "Projektreport hochladen"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
            }`}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">
              {file ? file.name : "Datei hierher ziehen oder klicken zum Auswählen"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {kind === "application" ? "PDF" : "PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX"} • max. {MAX_FILE_MB} MB
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {kind === "report" && current && (
            <div>
              <Label className="text-sm">Versionierung</Label>
              <RadioGroup
                value={bumpMajor ? "major" : "minor"}
                onValueChange={(v) => setBumpMajor(v === "major")}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="minor" id="minor" />
                  <Label htmlFor="minor" className="font-normal cursor-pointer">
                    Nebenversion erhöhen ({current.version_major}.{current.version_minor} → {current.version_major}.{current.version_minor + 1})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="major" id="major" />
                  <Label htmlFor="major" className="font-normal cursor-pointer">
                    Hauptversion erhöhen ({current.version_major}.{current.version_minor} → {current.version_major + 1}.0)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div>
            <Label htmlFor="change-comment" className="text-sm">Änderungsvermerk (optional)</Label>
            <Textarea
              id="change-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="z. B. Kostenübersicht ergänzt"
              rows={2}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Neue Version: <Badge variant="secondary">{nextVersionPreview}</Badge>
          </div>

          {mutation.isPending && <Progress value={progress} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Abbrechen
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!file || mutation.isPending}>
            {mutation.isPending ? "Lädt hoch…" : "Hochladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useDownload() {
  return useCallback(async (doc: ProjectDocument) => {
    try {
      const blob = await api.projectDocuments.download(doc.storage_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message || "Download fehlgeschlagen");
    }
  }, []);
}

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docs: ProjectDocument[];
  title: string;
  canDelete: boolean;
  onDelete: (d: ProjectDocument) => void;
}

function HistoryDialog({ open, onOpenChange, docs, title, canDelete, onDelete }: HistoryDialogProps) {
  const download = useDownload();
  const getName = useUserName();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Datei</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Benutzer</TableHead>
              <TableHead>Kommentar</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Keine Historie</TableCell></TableRow>
            )}
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Badge variant={d.is_current ? "default" : "outline"}>{d.version_label}</Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={d.file_name}>{d.file_name}</TableCell>
                <TableCell className="text-xs">{fmtDate(d.created_at)}</TableCell>
                <TableCell className="text-xs">{getName(d.uploaded_by)}</TableCell>
                <TableCell className="text-xs">{d.change_comment || "–"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => download(d)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(d)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ProjectDocumentsTab({ projectId, canEdit }: Props) {
  const qc = useQueryClient();
  const download = useDownload();
  const getName = useUserName();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => api.projectDocuments.list(projectId),
    enabled: !!projectId,
  });

  const application = useMemo(
    () => (docs as ProjectDocument[]).filter((d) => d.doc_kind === "application"),
    [docs]
  );
  const reports = useMemo(
    () => (docs as ProjectDocument[]).filter((d) => d.doc_kind === "report"),
    [docs]
  );

  const currentApp = application.find((d) => d.is_current) ?? null;
  const currentReport = reports.find((d) => d.is_current) ?? null;

  const [uploadKind, setUploadKind] = useState<ProjectDocKind | null>(null);
  const [appHistoryOpen, setAppHistoryOpen] = useState(false);
  const [reportHistoryOpen, setReportHistoryOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectDocument | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["project-documents", projectId] });

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await api.projectDocuments.remove(toDelete);
      toast.success("Dokument gelöscht");
      setToDelete(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Löschen fehlgeschlagen");
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Lädt…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Projektantrag */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Projektantrag
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setUploadKind("application")}>
              {currentApp ? <><Replace className="h-4 w-4 mr-2" />Ersetzen</> : <><Upload className="h-4 w-4 mr-2" />Hochladen</>}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {currentApp ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge>v{currentApp.version_label}</Badge>
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{currentApp.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(currentApp.created_at)} · {getName(currentApp.uploaded_by)} · {fmtBytes(currentApp.file_size)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(currentApp)}>
                <Download className="h-4 w-4 mr-2" />Download
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAppHistoryOpen(true)}>
                <History className="h-4 w-4 mr-2" />Historie ({application.length})
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch kein Projektantrag hochgeladen.</p>
          )}
        </CardContent>
      </Card>

      {/* Projektreports */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Projektreports
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setUploadKind("report")}>
              <Upload className="h-4 w-4 mr-2" />Neue Version
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Reports hochgeladen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Datei</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Hochgeladen am</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>Kommentar</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={d.is_current ? "default" : "outline"}>v{d.version_label}</Badge>
                        {d.is_current && <span className="text-xs text-primary">Aktuell</span>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={d.file_name}>{d.file_name}</TableCell>
                    <TableCell className="text-xs uppercase">{d.file_name.split(".").pop()}</TableCell>
                    <TableCell className="text-xs">{fmtDate(d.created_at)}</TableCell>
                    <TableCell className="text-xs">{getName(d.uploaded_by)}</TableCell>
                    <TableCell className="text-xs">{d.change_comment || "–"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => download(d)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {reports.length > 0 && (
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={() => setReportHistoryOpen(true)}>
                <History className="h-4 w-4 mr-2" />Vollständige Historie
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {uploadKind && (
        <UploadDialog
          open={!!uploadKind}
          onOpenChange={(o) => { if (!o) setUploadKind(null); }}
          projectId={projectId}
          kind={uploadKind}
          current={uploadKind === "application" ? currentApp : currentReport}
          onSuccess={refresh}
        />
      )}

      <HistoryDialog
        open={appHistoryOpen}
        onOpenChange={setAppHistoryOpen}
        docs={application}
        title="Historie Projektantrag"
        canDelete={canEdit}
        onDelete={(d) => { setAppHistoryOpen(false); setToDelete(d); }}
      />
      <HistoryDialog
        open={reportHistoryOpen}
        onOpenChange={setReportHistoryOpen}
        docs={reports}
        title="Historie Projektreports"
        canDelete={canEdit}
        onDelete={(d) => { setReportHistoryOpen(false); setToDelete(d); }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.file_name}" (v{toDelete?.version_label}) wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
