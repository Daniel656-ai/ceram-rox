import { useParams, useNavigate } from "react-router-dom";
import { useOrderDetail, useUpdateOrderStatus } from "@/hooks/useOrders";
import { useUpdateMeasurementStatus, useAddWorkLog } from "@/hooks/useMeasurements";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { ORDER_TYPE_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Clock, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: order, isLoading } = useOrderDetail(id);
  const updateMeasurementStatus = useUpdateMeasurementStatus();
  const addWorkLog = useAddWorkLog();
  const [logOpen, setLogOpen] = useState(false);
  const [logMeasurementId, setLogMeasurementId] = useState("");
  const [logHours, setLogHours] = useState("1");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logComment, setLogComment] = useState("");

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!order) return <p className="text-muted-foreground">Auftrag nicht gefunden.</p>;

  const measurements = (order as any).order_measurements || [];
  const totalPlanned = measurements.reduce((s: number, m: any) => s + (parseFloat(m.planned_hours) || 0), 0);
  const totalActual = measurements.reduce((s: number, m: any) => s + (m.work_logs || []).reduce((ws: number, w: any) => ws + (parseFloat(w.hours) || 0), 0), 0);
  const totalCost = measurements.reduce((s: number, m: any) => {
    const hours = (m.work_logs || []).reduce((ws: number, w: any) => ws + (parseFloat(w.hours) || 0), 0);
    return s + hours * (parseFloat(m.measurement_services?.hourly_rate) || 0);
  }, 0);

  const handleStatusChange = async (measurementId: string, newStatus: string) => {
    try {
      await updateMeasurementStatus.mutateAsync({ id: measurementId, status: newStatus });
      toast.success("Status aktualisiert");
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

  const handleFileUpload = async (measurementId: string, file: File) => {
    if (!user) return;
    const path = `${user.id}/${measurementId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("measurement-documents").upload(path, file);
    if (uploadErr) { toast.error("Upload fehlgeschlagen", { description: uploadErr.message }); return; }
    const { error: dbErr } = await supabase.from("documents").insert({
      order_measurement_id: measurementId,
      file_name: file.name,
      file_type: file.type,
      storage_path: path,
      uploaded_by: user.id,
    });
    if (dbErr) { toast.error("Fehler", { description: dbErr.message }); return; }
    toast.success("Datei hochgeladen");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Auftrag: {(order as any).projects?.project_number}
          </h1>
          <p className="text-muted-foreground">
            {ORDER_TYPE_LABELS[(order as any).order_type as keyof typeof ORDER_TYPE_LABELS]} · Erstellt am {new Date(order.created_at).toLocaleDateString("de-DE")}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Geplante Stunden</p>
            <p className="text-2xl font-bold">{totalPlanned.toFixed(1)} h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Ist-Stunden</p>
            <p className="text-2xl font-bold">{totalActual.toFixed(1)} h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Kosten (Ist)</p>
            <p className="text-2xl font-bold">{totalCost.toFixed(2)} €</p>
          </CardContent>
        </Card>
      </div>

      {order.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Anmerkungen</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{order.notes}</p></CardContent>
        </Card>
      )}

      {/* Measurements Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Messungen ({measurements.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Messung</TableHead>
                <TableHead>Arbeitsplatz</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Stunden (Plan/Ist)</TableHead>
                <TableHead>Stundensatz</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dokumente</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((m: any) => {
                const actualHours = (m.work_logs || []).reduce((s: number, w: any) => s + (parseFloat(w.hours) || 0), 0);
                const docs = m.documents || [];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.measurement_services?.service_name}</TableCell>
                    <TableCell>{m.workstations?.name || <span className="text-muted-foreground">–</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_LABELS[m.measurement_services?.category as keyof typeof CATEGORY_LABELS]}</Badge>
                    </TableCell>
                    <TableCell>{parseFloat(m.planned_hours || 0).toFixed(1)} / {actualHours.toFixed(1)} h</TableCell>
                    <TableCell>{m.measurement_services?.hourly_rate} €/h</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span className="text-sm">{docs.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(role === "durchfuehrer" || role === "master") && m.status !== "completed" && (
                          <>
                            {m.status === "open" && (
                              <Button size="sm" variant="outline" onClick={() => handleStatusChange(m.id, "in_progress")}>
                                Starten
                              </Button>
                            )}
                            {m.status === "in_progress" && (
                              <Button size="sm" variant="outline" onClick={() => handleStatusChange(m.id, "completed")}>
                                Abschließen
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => {
                              setLogMeasurementId(m.id);
                              setLogOpen(true);
                            }}>
                              <Clock className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" onChange={e => {
                            if (e.target.files?.[0]) handleFileUpload(m.id, e.target.files[0]);
                          }} />
                          <Button size="sm" variant="ghost" asChild>
                            <span><Upload className="h-3 w-3" /></span>
                          </Button>
                        </label>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}
