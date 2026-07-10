import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Plus, Download, Eye, Printer, History, CheckCircle2, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderReportVersion } from "@/lib/api/orderReports";
import LiveReportRenderer from "@/components/LiveReportRenderer";
import { dbClient } from "@/lib/api/client";

export default function OrderReportTab({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const { hasPermission } = usePermissions();
  const canGenerate = role === "master" || hasPermission("reports.generate");
  const canApprove = role === "master" || hasPermission("reports.approve");
  const canDelete = role === "master" || hasPermission("reports.delete");
  const canEditDraft = canGenerate;

  const { data: report, isLoading } = useQuery({
    queryKey: ["order-report", orderId],
    queryFn: () => api.orderReports.getOrCreateForOrder(orderId),
    enabled: !!orderId,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["order-report-versions", report?.id],
    queryFn: () => api.orderReports.listVersions(report!.id),
    enabled: !!report?.id,
  });

  // Erste Messung des Auftrags → Service ableiten für das Layout.
  const { data: firstServiceId } = useQuery({
    queryKey: ["order-first-service", orderId],
    queryFn: async () => {
      const { data } = await (dbClient as any)
        .from("order_measurements")
        .select("service_id")
        .eq("order_id", orderId)
        .limit(1);
      return (data?.[0]?.service_id as string | undefined) ?? null;
    },
    enabled: !!orderId,
  });

  const currentVersion = useMemo(
    () => versions.find((v) => v.version_no === report?.current_version_no) ?? versions[0],
    [versions, report]
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("");

  const generate = useMutation({
    mutationFn: () => api.orderReports.generate(orderId, changeReason || undefined),
    onSuccess: () => {
      toast.success("Neue Version erzeugt");
      setGenOpen(false);
      setChangeReason("");
      qc.invalidateQueries({ queryKey: ["order-report", orderId] });
      qc.invalidateQueries({ queryKey: ["order-report-versions"] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message ?? String(e) }),
  });

  const approve = useMutation({
    mutationFn: (versionId: string) => api.orderReports.approve(versionId, user!.id),
    onSuccess: () => {
      toast.success("Version freigegeben");
      qc.invalidateQueries({ queryKey: ["order-report-versions"] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const removeVersion = useMutation({
    mutationFn: (versionId: string) => api.orderReports.deleteVersion(versionId),
    onSuccess: () => {
      toast.success("Version gelöscht");
      qc.invalidateQueries({ queryKey: ["order-report-versions"] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const openPreview = async (v: OrderReportVersion) => {
    if (!v.pdf_storage_path) return;
    const url = await api.orderReports.signedPdfUrl(v.pdf_storage_path, 600);
    if (!url) { toast.error("Vorschau nicht verfügbar"); return; }
    setPreviewUrl(url);
  };

  const downloadPdf = async (v: OrderReportVersion) => {
    if (!v.pdf_storage_path) return;
    try {
      const blob = await api.orderReports.downloadPdf(v.pdf_storage_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bericht_v${v.version_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Download fehlgeschlagen", { description: e.message });
    }
  };

  if (isLoading) return <Card><CardContent className="p-6 text-muted-foreground">Lade …</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Ergebnisbericht
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Live-Ansicht mit automatisch übernommenen Daten. Bearbeiten, PDF erzeugen und freigeben.
            </p>
          </div>
          <div className="flex gap-2">
            {currentVersion && (
              <>
                <Button variant="outline" size="sm" onClick={() => openPreview(currentVersion)}>
                  <Eye className="h-4 w-4 mr-1" /> Vorschau
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadPdf(currentVersion)}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              </>
            )}
            {canGenerate && (
              <Button size="sm" onClick={() => setGenOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> PDF generieren
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentVersion ? (
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <MetaCell label="Aktuelle Version" value={<Badge variant="secondary">v{currentVersion.version_no}</Badge>} />
              <MetaCell label="Erstellt" value={new Date(currentVersion.created_at).toLocaleString("de-AT")} />
              <MetaCell
                label="Freigabe"
                value={currentVersion.approved_at
                  ? <Badge className="bg-emerald-600">Freigegeben</Badge>
                  : <Badge variant="outline">Ausstehend</Badge>}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Noch keine PDF-Version. Bearbeite unten den Bericht und klicke „PDF generieren".
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="live" className="w-full">
        <TabsList>
          <TabsTrigger value="live">Live-Ansicht</TabsTrigger>
          <TabsTrigger value="history">Versionshistorie ({versions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-3">
          <LiveReportRenderer
            orderId={orderId}
            serviceId={firstServiceId ?? null}
            canEdit={canEditDraft}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Versionshistorie
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Keine Versionen vorhanden.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Erstellt am</TableHead>
                      <TableHead>Grund</TableHead>
                      <TableHead>Freigabe</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell><Badge variant="secondary">v{v.version_no}</Badge></TableCell>
                        <TableCell>{new Date(v.created_at).toLocaleString("de-AT")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                          {v.change_reason ?? "—"}
                        </TableCell>
                        <TableCell>
                          {v.approved_at
                            ? <Badge className="bg-emerald-600">Freigegeben</Badge>
                            : <Badge variant="outline">Offen</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openPreview(v)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadPdf(v)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          {canApprove && !v.approved_at && (
                            <Button variant="ghost" size="sm" onClick={() => approve.mutate(v.id)}
                              disabled={approve.isPending} title="Freigeben">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="sm" onClick={() => removeVersion.mutate(v.id)}
                              disabled={removeVersion.isPending} title="Löschen">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Berichtsversion erzeugen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reason">Änderungsgrund (optional)</Label>
            <Textarea
              id="reason"
              rows={4}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="z.B. Nachtrag Messwerte XY, Freigabe-Korrektur, …"
            />
            <p className="text-xs text-muted-foreground">
              Alle aktuellen Werte (inkl. Handschrift und Overrides aus der Live-Ansicht) werden übernommen und als PDF gespeichert.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Abbrechen</Button>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? "Erzeuge …" : "Erzeugen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Berichtsvorschau</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="w-full flex-1 border rounded-md" title="Report" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
