import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ProcessContextProvider } from "@/context/ProcessContextProvider";
import { useOrderDetail, useUpdateOrderStatus, useUpdateOrder, useDeleteOrder, useOrderAuditLog, useCopyOrder } from "@/hooks/useOrders";
import { useUpdateMeasurementStatus, useAddWorkLog, useDurchfuehrer, useAssignMeasurement, useUpdateMeasurementRanking } from "@/hooks/useMeasurements";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { ORDER_TYPE_LABELS, CATEGORY_LABELS, ORDER_PRIORITY_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, Pencil, Trash2, Copy, Info } from "lucide-react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";
import { OrderWorkflowTabs } from "@/components/OrderWorkflowTabs";
import MeasurementDocuments from "@/components/MeasurementDocuments";
import { ProjectTimeEntries } from "@/components/ProjectTimeEntries";
import MeasurementDataEntry from "@/components/MeasurementDataEntry";
import OrderUploadedFiles from "@/components/OrderUploadedFiles";
import { toast } from "sonner";
import { useState } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useServicePermissions } from "@/hooks/useServicePermissions";
import { useUsers } from "@/hooks/useUsers";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OrderReportTab from "@/components/OrderReportTab";
import { ProcessOrderTabs } from "@/components/workflow/ProcessOrderTabs";
import CompletedResultForm from "@/components/CompletedResultForm";
import OrderResultsOverview from "@/components/OrderResultsOverview";
import OrderSamplesCard from "@/components/OrderSamplesCard";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";


function OrderDetailPageInner() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const measurementFilter = searchParams.get("measurement");
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewPersonnelCosts = role === "master" || hasPermission("costs.view_personnel");
  const canViewHourlyRates = role === "master" || hasPermission("costs.view_hourly_rates");
  const { data: order, isLoading } = useOrderDetail(id);
  const { data: auditLogs = [] } = useOrderAuditLog(id);
  const { data: linkedInstance } = useQuery({
    queryKey: ["order-instance-for-legacy", id],
    queryFn: () => api.orderInstances.getByLegacyOrderId(id!),
    enabled: !!id,
  });
  const updateMeasurementStatus = useUpdateMeasurementStatus();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const copyOrder = useCopyOrder();
  const isCopy = searchParams.get("copied") === "1";
  const handleCopyOrder = async () => {
    try {
      const created = await copyOrder.mutateAsync(id!);
      toast.success("Auftrag kopiert – neuer Entwurf erstellt");
      navigate(`/auftraege/${created.id}?copied=1`);
    } catch (e: any) {
      toast.error("Kopieren fehlgeschlagen", { description: e.message });
    }
  };
  const addWorkLog = useAddWorkLog();
  const { data: durchfuehrerList = [] } = useDurchfuehrer();
  const { data: servicePermissions = [] } = useServicePermissions();
  const assignMeasurement = useAssignMeasurement();
  const updateMeasurementRanking = useUpdateMeasurementRanking();
  const { data: projectMembers = [] } = useProjectMembers((order as any)?.project_id);
  const [logOpen, setLogOpen] = useState(false);
  const [logMeasurementId, setLogMeasurementId] = useState("");
  const [logHours, setLogHours] = useState("1");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logComment, setLogComment] = useState("");

  // Completion dialog state
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeMeasurementId, setCompleteMeasurementId] = useState("");
  const [completeStandardDuration, setCompleteStandardDuration] = useState(0);
  const [actualDuration, setActualDuration] = useState("");
  const [deviationReason, setDeviationReason] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editOrderType, setEditOrderType] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: allUsers = [] } = useUsers();
  const creator = (allUsers as any[]).find((u) => u.user_id === (order as any)?.created_by);
  const creatorName = creator ? `${creator.first_name || ""} ${creator.last_name || ""}`.trim() : "";

  // Rollenbasierte Ansicht: Auftraggeber sehen nur die Auftraggeber-Sicht,
  // Messdienstleister nur die MDL-Sicht, Master/Admin können umschalten.
  const defaultView: "requester" | "provider" = role === "auftraggeber" ? "requester" : "provider";
  const [viewMode, setViewMode] = useState<"requester" | "provider">(defaultView);
  const canSwitchViews = role === "master";
  const showRequesterView = canSwitchViews ? viewMode === "requester" : role === "auftraggeber";
  const showProviderView = canSwitchViews ? viewMode === "provider" : role !== "auftraggeber";

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!order) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <p className="text-lg font-medium">Auftrag nicht gefunden.</p>
      <p className="text-sm text-muted-foreground">Der Auftrag existiert nicht oder Sie haben keine Berechtigung, ihn zu sehen.</p>
      <Button variant="outline" onClick={() => navigate("/auftraege")}>Zur Auftragsübersicht</Button>
    </div>
  );

  const canEditDelete = role === "master" || (role === "auftraggeber" && (order as any).created_by === user?.id && order.status === "open");
  const canEditPriority = role === "master" || (order as any).created_by === user?.id;
  const myMembership = (projectMembers as any[]).find((m) => m.user_id === user?.id);
  const isProjectLead = myMembership?.role === "owner" || myMembership?.role === "leader";
  const canAssign = role === "master" || isProjectLead;
  const canManageMeasurement = canAssign && role !== "durchfuehrer";

  const allMeasurements = (order as any).order_measurements || [];
  const measurements = measurementFilter
    ? allMeasurements.filter((m: any) => m.id === measurementFilter)
    : allMeasurements;
  const totalPlanned = measurements.reduce((s: number, m: any) => s + (parseFloat(m.planned_hours) || 0), 0);
  const totalActual = measurements.reduce((s: number, m: any) => s + (m.work_logs || []).reduce((ws: number, w: any) => ws + (parseFloat(w.hours) || 0), 0), 0);
  const totalCost = measurements.reduce((s: number, m: any) => {
    const hours = (m.work_logs || []).reduce((ws: number, w: any) => ws + (parseFloat(w.hours) || 0), 0);
    return s + hours * (parseFloat(m.measurement_services?.hourly_rate) || 0);
  }, 0);

  const handleStatusChange = async (measurementId: string, newStatus: string) => {
    if (newStatus === "completed") {
      // Find the measurement to get standard duration
      const m = measurements.find((m: any) => m.id === measurementId);
      const stdDuration = m?.measurement_services?.standard_duration_hours ?? 1;
      setCompleteMeasurementId(measurementId);
      setCompleteStandardDuration(stdDuration);
      setActualDuration(String(stdDuration));
      setDeviationReason("");
      setCompleteOpen(true);
      return;
    }
    try {
      await updateMeasurementStatus.mutateAsync({ id: measurementId, status: newStatus });
      toast.success("Status aktualisiert");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleCompleteSubmit = async () => {
    const dur = parseFloat(actualDuration);
    if (isNaN(dur) || dur <= 0) { toast.error("Bitte gültige Dauer angeben"); return; }
    if (dur !== completeStandardDuration && !deviationReason.trim()) {
      toast.error("Bei Abweichung von der Standarddauer ist eine Begründung erforderlich");
      return;
    }
    try {
      await api.measurements.complete(completeMeasurementId!, dur, deviationReason);
      toast.success("Aufgabe abgeschlossen");
      setCompleteOpen(false);
      // Refresh
      window.location.reload();
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleLogSubmit = async () => {
    if (!user) return;
    try {
      await addWorkLog.mutateAsync({
        order_measurement_id: logMeasurementId,
        user_id: user.id,
        work_date: logDate,
        hours: parseFloat(logHours),
        comment: logComment || undefined,
      });
      toast.success("Arbeitszeit erfasst");
      setLogOpen(false);
      setLogComment("");
      setLogHours("1");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  // File upload moved to MeasurementDocuments component

  const openEditDialog = () => {
    setEditOrderType((order as any).order_type);
    setEditPriority((order as any).priority || "normal");
    setEditDueDate((order as any).due_date || "");
    setEditNotes((order as any).notes || "");
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        order_type: editOrderType as any,
        priority: editPriority as any,
        due_date: editDueDate || null,
        notes: editNotes || null,
      });
      toast.success("Auftrag aktualisiert");
      setEditOpen(false);
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteOrder.mutateAsync(order.id);
      toast.success("Messauftrag gelöscht");
      navigate("/auftraege");
    } catch (err: any) {
      toast.error("Fehler beim Löschen", { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Auftrag: {(order as any).order_number || (order as any).projects?.project_number}
          </h1>
          <p className="text-muted-foreground">
            {(order as any).order_number ? `Projekt: ${(order as any).projects?.project_number} · ` : ""}{ORDER_TYPE_LABELS[(order as any).order_type as keyof typeof ORDER_TYPE_LABELS]}
            {creatorName ? ` · Auftraggeber: ${creatorName}` : ""}
            {` · Erstellt am ${new Date(order.created_at).toLocaleDateString("de-DE")}`}
          </p>
        </div>
        {(order as any).order_kind && (order as any).order_kind !== "legacy" && (
          <Badge variant="secondary" className="font-normal">
            {(order as any).order_kind === "pilot_plant" ? "Pilot Plant" : (order as any).order_kind === "labor" ? "Labor" : "Kombiniert"}
          </Badge>
        )}
        {(order as any).workflow_status && <WorkflowStatusBadge status={(order as any).workflow_status} />}
        <StatusBadge status={order.status} />
        {/* Kopierfunktion temporär deaktiviert – Handler/Hook bleiben erhalten */}
        {(canEditDelete || canEditPriority) && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Auftrag löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dieser Auftrag und alle zugehörigen Aufgaben werden unwiderruflich gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {false && isCopy && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Dieser Auftrag wurde als Kopie erstellt und befindet sich im Entwurf.
            Bitte prüfen und anpassen. Ergebnisse, Messwerte und Zuweisungen wurden
            nicht übernommen.
          </span>
        </div>
      )}

      {canSwitchViews && (
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "requester" | "provider")}>
          <TabsList>
            <TabsTrigger value="requester">Auftraggeber</TabsTrigger>
            <TabsTrigger value="provider">Messdienstleister</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <OrderHeaderSummary order={order} creatorName={creatorName} />

      {order.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Bemerkungen</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{order.notes}</p></CardContent>
        </Card>
      )}

      <OrderWorkflowTabs
        order={order}
        isRequesterView={showRequesterView}
        canEditSamples={
          role === "master" ||
          ((order as any).created_by === user?.id && order.status === "open")
        }
        canBookReplacement={
          !showRequesterView &&
          (role === "master" ||
            role === "durchfuehrer" ||
            ((order as any).order_measurements || []).some((m: any) => m.assigned_to === user?.id))
        }
        processSlot={
          linkedInstance ? (
            <ProcessOrderTabs legacyOrderId={id!} orderInstanceId={linkedInstance.id} />
          ) : undefined
        }
      />

      {/* Work Log Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arbeitszeit erfassen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Datum</Label>
              <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
            </div>
            <div>
              <Label>Stunden</Label>
              <Input type="number" min={0.25} step={0.25} value={logHours} onChange={e => setLogHours(e.target.value)} />
            </div>
            <div>
              <Label>Kommentar</Label>
              <Textarea value={logComment} onChange={e => setLogComment(e.target.value)} placeholder="Optionaler Kommentar" rows={2} />
            </div>
            <Button onClick={handleLogSubmit}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Completion Dialog with actual duration */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aufgabe abschließen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Standarddauer</Label>
              <p className="text-sm text-muted-foreground">{completeStandardDuration} h</p>
            </div>
            <div>
              <Label>Tatsächliche Messdauer (h)</Label>
              <Input type="number" min={0.25} step={0.25} value={actualDuration} onChange={e => setActualDuration(e.target.value)} />
            </div>
            {parseFloat(actualDuration) !== completeStandardDuration && (
              <div>
                <Label>Begründung der Abweichung *</Label>
                <Textarea value={deviationReason} onChange={e => setDeviationReason(e.target.value)} placeholder="Pflichtfeld bei Abweichung von der Standarddauer" rows={3} />
              </div>
            )}
            <Button onClick={handleCompleteSubmit}>Abschließen</Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* Edit Order Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Auftrag bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {canEditDelete && (
              <div>
                <Label>Auftragstyp</Label>
                <Select value={editOrderType} onValueChange={setEditOrderType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {canEditDelete && (
              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Anmerkungen</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Anmerkungen zum Auftrag" rows={3} />
            </div>
            <Button onClick={handleEditSubmit}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Prozessmanager-Wrapper: Systemvariablen für alle Formulare dieser Ansicht. */
export default function OrderDetailPage() {
  const { id } = useParams();
  const { data: order } = useOrderDetail(id);
  return (
    <ProcessContextProvider
      orderId={id ?? null}
      sampleId={(order as any)?.samples?.id ?? null}
      projectId={(order as any)?.project_id ?? null}
    >
      <OrderDetailPageInner />
    </ProcessContextProvider>
  );
}
