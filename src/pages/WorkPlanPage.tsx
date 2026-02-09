import { useMyMeasurements, useUpdateMeasurementStatus, useAddWorkLog } from "@/hooks/useMeasurements";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { CATEGORY_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Play, CheckCircle2, Upload, Beaker } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function WorkPlanPage() {
  const { user } = useAuth();
  const { data: measurements = [], isLoading } = useMyMeasurements();
  const updateStatus = useUpdateMeasurementStatus();
  const addWorkLog = useAddWorkLog();
  const [filter, setFilter] = useState<string>("all");
  const [logOpen, setLogOpen] = useState(false);
  const [logMeasurementId, setLogMeasurementId] = useState("");
  const [logHours, setLogHours] = useState("1");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logComment, setLogComment] = useState("");

  const filtered = measurements.filter((m: any) =>
    filter === "all" || m.status === filter
  );

  const priorityLabel = (p: number) =>
    p === 2 ? "Dringend" : p === 1 ? "Hoch" : "Normal";

  const priorityColor = (p: number) =>
    p === 2 ? "bg-destructive/15 text-destructive border-destructive/30" :
    p === 1 ? "bg-warning/15 text-warning border-warning/30" :
    "bg-muted text-muted-foreground";

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: newStatus });
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
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleFileUpload = async (measurementId: string, file: File) => {
    if (!user) return;
    const path = `${user.id}/${measurementId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("measurement-documents").upload(path, file);
    if (uploadErr) { toast.error("Upload fehlgeschlagen"); return; }
    await supabase.from("documents").insert({
      order_measurement_id: measurementId,
      file_name: file.name,
      file_type: file.type,
      storage_path: path,
      uploaded_by: user.id,
    });
    toast.success("Protokoll hochgeladen");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Arbeitsplanung</h1>
        <p className="text-muted-foreground">Ihre zugewiesenen Messungen und Aufgaben</p>
      </div>

      <div className="flex gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="in_progress">In Bearbeitung</SelectItem>
            <SelectItem value="completed">Abgeschlossen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Keine Messungen gefunden.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m: any) => (
            <Card key={m.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{m.measurement_services?.service_name}</CardTitle>
                  </div>
                  <Badge variant="outline" className={priorityColor(m.priority)}>{priorityLabel(m.priority)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Projekt:</span> {m.measurement_orders?.projects?.project_number}</p>
                  <p><span className="text-muted-foreground">Kategorie:</span> {CATEGORY_LABELS[m.measurement_services?.category as keyof typeof CATEGORY_LABELS]}</p>
                  <p><span className="text-muted-foreground">Geplant:</span> {parseFloat(m.planned_hours || 0).toFixed(1)} h</p>
                  {m.due_date && <p><span className="text-muted-foreground">Fällig:</span> {new Date(m.due_date).toLocaleDateString("de-DE")}</p>}
                </div>
                <StatusBadge status={m.status} />
                <div className="flex gap-2 pt-2">
                  {m.status === "open" && (
                    <Button size="sm" onClick={() => handleStatusChange(m.id, "in_progress")}>
                      <Play className="h-3 w-3 mr-1" />Starten
                    </Button>
                  )}
                  {m.status === "in_progress" && (
                    <Button size="sm" onClick={() => handleStatusChange(m.id, "completed")}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Abschließen
                    </Button>
                  )}
                  {m.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => { setLogMeasurementId(m.id); setLogOpen(true); }}>
                      <Clock className="h-3 w-3 mr-1" />Zeit
                    </Button>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={e => {
                      if (e.target.files?.[0]) handleFileUpload(m.id, e.target.files[0]);
                    }} />
                    <Button size="sm" variant="ghost" asChild><span><Upload className="h-3 w-3" /></span></Button>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arbeitszeit erfassen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Datum</Label><Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} /></div>
            <div><Label>Stunden</Label><Input type="number" min={0.25} step={0.25} value={logHours} onChange={e => setLogHours(e.target.value)} /></div>
            <div><Label>Kommentar</Label><Textarea value={logComment} onChange={e => setLogComment(e.target.value)} rows={2} /></div>
            <Button onClick={handleLogSubmit}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
