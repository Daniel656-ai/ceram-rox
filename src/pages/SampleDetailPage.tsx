import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useSampleDetail, useSampleHistory, useSampleDocuments, useSubSamples,
  useUpdateSampleStatus, useUpdateSampleLocation, useHandoverSample,
  useCreateSample, useAddSampleDocument, useAddSampleHistory, useSampleMeasurements,
} from "@/hooks/useSamples";
import { useEstimatedCompletion } from "@/hooks/useEstimatedCompletion";
import { useProjects } from "@/hooks/useProjects";
import { useStorageLocations } from "@/hooks/useRawMaterials";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Upload, Clock, MapPin, Users, FlaskConical, FileText, GitBranch, CalendarClock, Eye, Download } from "lucide-react";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import { SampleBarcode, SampleQRCode, SampleLabelPrintDialog } from "@/components/SampleLabel";
import { GhsPictogramList } from "@/components/GhsPictogram";
import { StatusBadge } from "@/components/StatusBadge";
import { PersonSelect } from "@/components/PersonSelect";
import { SampleTraceability } from "@/components/SampleTraceability";
import { Search } from "lucide-react";

const STATUSES = ["neu", "eingelagert", "in_bearbeitung", "teilweise_verbraucht", "vollstaendig_verbraucht", "entsorgt", "zurueckgesendet"] as const;

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

export default function SampleDetailPage() {
  const { t } = useTranslation("samples");
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { data: sample, isLoading } = useSampleDetail(id);
  const { data: history = [] } = useSampleHistory(id);
  const { data: documents = [] } = useSampleDocuments(id);
  const { data: subSamples = [] } = useSubSamples(id);
  const { data: sampleMeasurements = [] } = useSampleMeasurements(id);
  const { data: locations = [] } = useStorageLocations();
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
  const updateStatus = useUpdateSampleStatus();
  const updateLocation = useUpdateSampleLocation();
  const handover = useHandoverSample();
  const createSample = useCreateSample();
  const addDocument = useAddSampleDocument();
  const addHistory = useAddSampleHistory();
  const etaMap = useEstimatedCompletion();

  const [statusDialog, setStatusDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [handoverDialog, setHandoverDialog] = useState(false);
  const [subSampleDialog, setSubSampleDialog] = useState(false);

  const [newStatus, setNewStatus] = useState("");
  const [newLocationId, setNewLocationId] = useState("");
  const [handoverTo, setHandoverTo] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [svcSearch, setSvcSearch] = useState("");
  const [svcSort, setSvcSort] = useState<"updated" | "name" | "status">("updated");

  const canManage = role === "master" || role === "auftraggeber" || role === "durchfuehrer";

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t("loading")}</div>;
  if (!sample) return <div className="p-8 text-center text-muted-foreground">{t("no_samples")}</div>;

  const s = sample as any;
  const project = s.projects;
  const location = s.storage_locations;

  const handleStatusChange = async () => {
    if (!newStatus) return;
    try {
      await updateStatus.mutateAsync({ id: s.id, status: newStatus, userId: user!.id, comment: actionComment || undefined });
      toast.success(t("status_changed"));
      setStatusDialog(false);
      setNewStatus("");
      setActionComment("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleLocationChange = async () => {
    try {
      await updateLocation.mutateAsync({ id: s.id, locationId: newLocationId === "__none__" ? null : newLocationId, userId: user!.id, comment: actionComment || undefined });
      toast.success(t("location_changed"));
      setLocationDialog(false);
      setNewLocationId("");
      setActionComment("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleHandover = async () => {
    if (!handoverTo) return;
    try {
      await handover.mutateAsync({ id: s.id, fromUserId: user!.id, toUserId: handoverTo, comment: actionComment || undefined });
      toast.success(t("handover_success"));
      setHandoverDialog(false);
      setHandoverTo("");
      setActionComment("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateSubSample = async () => {
    if (!subName.trim() || !subDesc.trim()) return;
    try {
      await createSample.mutateAsync({
        sample_name: subName.trim(),
        project_id: s.project_id,
        description: subDesc.trim(),
        created_by: user!.id,
        parent_sample_id: s.id,
      });
      toast.success(t("subsample_created"));
      setSubSampleDialog(false);
      setSubName("");
      setSubDesc("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { path } = await api.sampleStorage.upload(s.id, file);
      await addDocument.mutateAsync({
        sample_id: s.id,
        file_name: file.name,
        file_type: file.type,
        storage_path: path,
        document_type: "sicherheitsdatenblatt",
        uploaded_by: user!.id,
      });
      toast.success(t("document_uploaded"));
    } catch (err: any) {
      toast.error(err?.message ?? t("document_upload_error"));
    }
  };

  const handleDocDownload = async (doc: any) => {
    const url = await api.sampleStorage.signedUrl(doc.storage_path, 300);
    if (url) window.open(url, "_blank");
  };

  const getUserName = (userId: string) => {
    const u = users.find((u: any) => u.user_id === userId);
    return u ? `${u.first_name} ${u.last_name}`.trim() || userId.slice(0, 8) : userId.slice(0, 8);
  };

  const getHistoryActionLabel = (action: string) => {
    const key = `history_action_${action}`;
    const translated = t(key);
    return translated !== key ? translated : action;
  };

  const statusColors: Record<string, string> = {
    neu: "bg-blue-100 text-blue-800",
    eingelagert: "bg-green-100 text-green-800",
    in_bearbeitung: "bg-yellow-100 text-yellow-800",
    teilweise_verbraucht: "bg-orange-100 text-orange-800",
    vollstaendig_verbraucht: "bg-red-100 text-red-800",
    entsorgt: "bg-gray-100 text-gray-800",
    zurueckgesendet: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link to="/proben"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{s.sample_number} – {s.sample_name}</h1>
          <p className="text-muted-foreground">{project?.project_number}{project?.project_name ? ` – ${project.project_name}` : ""}</p>
        </div>
        <Badge variant="outline" className={`ml-auto ${statusColors[s.status] || ""}`}>
          {t(`status_${s.status}`)}
        </Badge>
      </div>

      {/* Hazard warning */}
      {s.is_hazardous && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-semibold">{t("hazard_warning")}</AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <SampleLabelPrintDialog sample={s} />
        {canManage && (
          <>
            <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Clock className="h-4 w-4 mr-1" />{t("change_status")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("change_status")}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(st => <SelectItem key={st} value={st}>{t(`status_${st}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea value={actionComment} onChange={e => setActionComment(e.target.value)} placeholder={t("comment_placeholder")} rows={2} />
                  <Button onClick={handleStatusChange} disabled={!newStatus} className="w-full">{t("save")}</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={locationDialog} onOpenChange={setLocationDialog}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><MapPin className="h-4 w-4 mr-1" />{t("change_location")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("change_location")}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Select value={newLocationId || "__none__"} onValueChange={setNewLocationId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("no_location")}</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea value={actionComment} onChange={e => setActionComment(e.target.value)} placeholder={t("comment_placeholder")} rows={2} />
                  <Button onClick={handleLocationChange} className="w-full">{t("save")}</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={handoverDialog} onOpenChange={setHandoverDialog}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Users className="h-4 w-4 mr-1" />{t("handover")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("handover_to")}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <PersonSelect
                    value={handoverTo}
                    onValueChange={setHandoverTo}
                    users={users as any[]}
                    excludeIds={user?.id ? [user.id] : []}
                    placeholder={t("select_user")}
                  />
                  <Textarea value={actionComment} onChange={e => setActionComment(e.target.value)} placeholder={t("comment_placeholder")} rows={2} />
                  <Button onClick={handleHandover} disabled={!handoverTo} className="w-full">{t("save")}</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={subSampleDialog} onOpenChange={setSubSampleDialog}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><GitBranch className="h-4 w-4 mr-1" />{t("create_subsample")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("create_subsample")}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("sample_name_required")}</Label>
                    <Input value={subName} onChange={e => setSubName(e.target.value)} placeholder={t("subsample_name_placeholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("description")}</Label>
                    <Textarea value={subDesc} onChange={e => setSubDesc(e.target.value)} placeholder={t("description_placeholder")} rows={2} />
                  </div>
                  <Button onClick={handleCreateSubSample} disabled={!subName.trim() || !subDesc.trim()} className="w-full">{t("create_sample")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      <SampleTraceability sampleId={s.id} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tab_overview")}</TabsTrigger>
          <TabsTrigger value="services">{t("tab_services", { defaultValue: "Dienstleistungen" })} ({sampleMeasurements.length})</TabsTrigger>
          <TabsTrigger value="history">{t("tab_history")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tab_documents")}</TabsTrigger>
          <TabsTrigger value="subsamples">{t("tab_subsamples")} ({subSamples.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("overview")}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sample_number")}</span><span className="font-medium">{s.sample_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("name")}</span><span className="font-medium">{s.sample_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("project")}</span><span className="font-medium">{project?.project_number || "–"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("description")}</span><span className="font-medium text-right max-w-[60%]">{s.description}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("created_at")}</span><span className="font-medium">{new Date(s.created_at).toLocaleDateString("de-DE")}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("eta")}</span>
                  <span className="font-medium">
                    {(() => {
                      const completed = ["vollstaendig_verbraucht", "entsorgt", "zurueckgesendet"];
                      if (completed.includes(s.status)) return t("eta_completed");
                      const eta = etaMap.get(s.id);
                      if (!eta) return t("eta_no_orders");
                      return (
                        <Badge variant="outline" className="gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {eta.toLocaleDateString("de-DE")}
                        </Badge>
                      );
                    })()}
                  </span>
                </div>
                {s.parent_sample_id && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("parent_sample")}</span>
                    <Link to={`/proben/${s.parent_sample_id}`} className="font-medium text-primary underline">{t("parent_sample")}</Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t("location_section")}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("location")}</span><span className="font-medium">{formatLocation(location)}</span></div>
                {s.post_measurement_action && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("post_measurement")}</span><span className="font-medium">{t(`post_${s.post_measurement_action}`)}</span></div>
                )}
                {s.storage_min_duration && <div className="flex justify-between"><span className="text-muted-foreground">{t("storage_min_duration")}</span><span className="font-medium">{s.storage_min_duration}</span></div>}
                {s.storage_hints && <div className="flex justify-between"><span className="text-muted-foreground">{t("storage_hints")}</span><span className="font-medium">{s.storage_hints}</span></div>}
                {s.storage_expiry_date && <div className="flex justify-between"><span className="text-muted-foreground">{t("storage_expiry_date")}</span><span className="font-medium">{new Date(s.storage_expiry_date).toLocaleDateString("de-DE")}</span></div>}
                {s.disposal_method && <div className="flex justify-between"><span className="text-muted-foreground">{t("disposal_method")}</span><span className="font-medium">{s.disposal_method}</span></div>}
                {s.disposal_category && <div className="flex justify-between"><span className="text-muted-foreground">{t("disposal_category")}</span><span className="font-medium">{t(`disposal_${s.disposal_category}`)}</span></div>}
              </CardContent>
            </Card>

            {s.is_hazardous && (
              <Card className="border-destructive">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />{t("hazard_section")}</CardTitle></CardHeader>
                <CardContent>
                  <GhsPictogramList hazardClasses={s.hazard_categories} size="lg" />
                </CardContent>
              </Card>
            )}

            {/* Barcode & QR Code */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t("barcode")} & {t("qr_code")}</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center gap-6 flex-wrap">
                <SampleBarcode sampleNumber={s.sample_number} label={s.sample_name} />
                <SampleQRCode sampleId={s.id} sampleNumber={s.sample_number} label={s.sample_name} size={120} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Services */}
        <TabsContent value="services">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  {t("tab_services", { defaultValue: "Dienstleistungen" })}
                  <Badge variant="secondary">{sampleMeasurements.length}</Badge>
                </CardTitle>
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                    <Input
                      value={svcSearch}
                      onChange={(e) => setSvcSearch(e.target.value)}
                      placeholder={t("search_placeholder")}
                      className="pl-8 h-9 w-56"
                    />
                  </div>
                  <Select value={svcSort} onValueChange={(v) => setSvcSort(v as any)}>
                    <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">{t("sort_created_desc")}</SelectItem>
                      <SelectItem value="name">{t("sort_name")}</SelectItem>
                      <SelectItem value="status">{t("status")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sampleMeasurements.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">
                  {t("no_services_linked", { defaultValue: "Keine Dienstleistungen mit dieser Probe verknüpft" })}
                </p>
              ) : (() => {
                const q = svcSearch.trim().toLowerCase();
                const filtered = (sampleMeasurements as any[])
                  .filter((m) => {
                    if (!q) return true;
                    const name = m.measurement_services?.service_name?.toLowerCase() || "";
                    const status = m.status?.toLowerCase() || "";
                    const num = m.measurement_number?.toLowerCase() || "";
                    return name.includes(q) || status.includes(q) || num.includes(q);
                  })
                  .sort((a, b) => {
                    if (svcSort === "name") {
                      return (a.measurement_services?.service_name || "").localeCompare(b.measurement_services?.service_name || "");
                    }
                    if (svcSort === "status") {
                      return (a.status || "").localeCompare(b.status || "");
                    }
                    return (b.updated_at || "").localeCompare(a.updated_at || "");
                  });

                if (filtered.length === 0) {
                  return <p className="p-6 text-center text-muted-foreground">{t("no_samples")}</p>;
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("measurement_type")}</TableHead>
                        <TableHead>Nr.</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead>{t("result", { defaultValue: "Ergebnis" })}</TableHead>
                        <TableHead>{t("updated_at", { defaultValue: "Aktualisiert" })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((m: any) => {
                        const results = m.measurement_results || [];
                        const hasResults = results.length > 0;
                        return (
                          <TableRow
                            key={m.id}
                            className="cursor-pointer"
                            onClick={() => { window.location.href = `/auftraege/${m.order_id}`; }}
                          >
                            <TableCell className="font-medium">
                              {m.measurement_services?.service_name || "–"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.measurement_number}
                            </TableCell>
                            <TableCell><StatusBadge status={m.status} /></TableCell>
                            <TableCell>
                              {hasResults ? (
                                <div className="space-y-0.5 text-sm">
                                  {results.slice(0, 3).map((r: any) => (
                                    <div key={r.id}>
                                      <span className="text-muted-foreground">{r.result_name}: </span>
                                      <span className="font-medium">{r.value ?? "–"}{r.unit ? ` ${r.unit}` : ""}</span>
                                    </div>
                                  ))}
                                  {results.length > 3 && (
                                    <div className="text-xs text-muted-foreground">+{results.length - 3} weitere</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  {t("no_result", { defaultValue: "Kein Ergebnis vorhanden" })}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.updated_at ? new Date(m.updated_at).toLocaleString("de-DE") : "–"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">{t("history_empty")}</p>
              ) : (
                <div className="divide-y">
                  {history.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-4 p-4">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{getHistoryActionLabel(h.action)}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("de-DE")}
                          </span>
                          <span className="text-xs text-muted-foreground">– {getUserName(h.user_id)}</span>
                        </div>
                        {h.comment && <p className="text-sm text-muted-foreground mt-1">{h.comment}</p>}
                        {h.metadata && Object.keys(h.metadata).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {h.metadata.new_status && <span>{t(`status_${h.metadata.new_status}`)}</span>}
                            {h.metadata.to_user && <span>{t("handover_to")}: {getUserName(h.metadata.to_user)}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{t("documents")}</CardTitle>
              {canManage && (
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1" />{t("upload_document")}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleDocUpload} />
                  </label>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">{t("no_documents")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datei</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.file_name}</TableCell>
                        <TableCell>{doc.document_type}</TableCell>
                        <TableCell>{new Date(doc.uploaded_at).toLocaleDateString("de-DE")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDocDownload(doc)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-samples */}
        <TabsContent value="subsamples">
          <Card>
            <CardContent className="p-0">
              {subSamples.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">{t("no_samples")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sample_number")}</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("location")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subSamples.map((sub: any) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <Link to={`/proben/${sub.id}`} className="font-medium text-primary underline">{sub.sample_number}</Link>
                        </TableCell>
                        <TableCell>{sub.sample_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[sub.status] || ""}>{t(`status_${sub.status}`)}</Badge>
                        </TableCell>
                        <TableCell>{formatLocation(sub.storage_locations)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
