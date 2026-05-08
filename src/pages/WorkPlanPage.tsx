import { useMyMeasurements, useUpdateMeasurementStatus, useAddWorkLog } from "@/hooks/useMeasurements";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
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
import { useTranslation } from "react-i18next";

export default function WorkPlanPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(["measurements", "common"]);
  const { data: measurements = [], isLoading } = useMyMeasurements();
  const updateStatus = useUpdateMeasurementStatus();
  const addWorkLog = useAddWorkLog();
  const [filter, setFilter] = useState<string>("all");
  const [logOpen, setLogOpen] = useState(false);
  const [logMeasurementId, setLogMeasurementId] = useState("");
  const [logHours, setLogHours] = useState("1");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logComment, setLogComment] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeMId, setCompleteMId] = useState("");
  const [completeStdDur, setCompleteStdDur] = useState(0);
  const [completeActDur, setCompleteActDur] = useState("");
  const [completeReason, setCompleteReason] = useState("");

  const filtered = measurements.filter((m: any) =>
    filter === "all" || m.status === filter
  );

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (newStatus === "completed") {
      const m = measurements.find((m: any) => m.id === id);
      const stdDur = (m?.measurement_services as any)?.standard_duration_hours ?? 1;
      setCompleteMId(id);
      setCompleteStdDur(stdDur);
      setCompleteActDur(String(stdDur));
      setCompleteReason("");
      setCompleteOpen(true);
      return;
    }
    try {
      await updateStatus.mutateAsync({ id, status: newStatus });
      toast.success(t("measurements:status_updated"));
    } catch (err: any) {
      toast.error(t("common:error"), { description: err.message });
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
      toast.success(t("measurements:time_logged"));
      setLogOpen(false);
      setLogComment("");
    } catch (err: any) {
      toast.error(t("common:error"), { description: err.message });
    }
  };

  const handleFileUpload = async (measurementId: string, file: File) => {
    if (!user) return;
    const path = `${user.id}/${measurementId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("measurement-documents").upload(path, file);
    if (uploadErr) { toast.error(t("measurements:upload_failed")); return; }
    await supabase.from("documents").insert({
      order_measurement_id: measurementId,
      file_name: file.name,
      file_type: file.type,
      storage_path: path,
      uploaded_by: user.id,
    });
    toast.success(t("measurements:protocol_uploaded"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("measurements:work_plan_title")}</h1>
        <p className="text-muted-foreground">{t("measurements:work_plan_subtitle")}</p>
      </div>

      <div className="flex gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common:all")}</SelectItem>
            <SelectItem value="open">{t("common:status_open")}</SelectItem>
            <SelectItem value="in_progress">{t("common:status_in_progress")}</SelectItem>
            <SelectItem value="completed">{t("common:status_completed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("measurements:no_measurements")}</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m: any) => (
            <Card key={m.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{m.measurement_number}</span>
                      {m.measurement_services?.service_name}
                    </CardTitle>
                  </div>
                  <PriorityBadge priority={m.measurement_orders?.priority} />
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">{t("measurements:project")}:</span> {m.measurement_orders?.projects?.project_number}</p>
                  <p><span className="text-muted-foreground">{t("measurements:category")}:</span> {t(`common:category_${m.measurement_services?.category}`)}</p>
                  <p><span className="text-muted-foreground">{t("measurements:planned")}:</span> {parseFloat(m.planned_hours || 0).toFixed(1)} h</p>
                  <p><span className="text-muted-foreground">{t("measurements:standard_duration")}:</span> {(m.measurement_services as any)?.standard_duration_hours ?? '–'} h</p>
                  {m.due_date && <p><span className="text-muted-foreground">{t("measurements:due")}:</span> {new Date(m.due_date).toLocaleDateString(i18n.language === "en" ? "en-GB" : "de-DE")}</p>}
                </div>
                <StatusBadge status={m.status} />
                <div className="flex gap-2 pt-2">
                  {m.status === "open" && (
                    <Button size="sm" onClick={() => handleStatusChange(m.id, "in_progress")}>
                      <Play className="h-3 w-3 mr-1" />{t("measurements:start")}
                    </Button>
                  )}
                  {m.status === "in_progress" && (
                    <Button size="sm" onClick={() => handleStatusChange(m.id, "completed")}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />{t("measurements:complete")}
                    </Button>
                  )}
                  {m.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => { setLogMeasurementId(m.id); setLogOpen(true); }}>
                      <Clock className="h-3 w-3 mr-1" />{t("measurements:log_time")}
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
          <DialogHeader><DialogTitle>{t("measurements:log_time_title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("measurements:log_date")}</Label><Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} /></div>
            <div><Label>{t("measurements:log_hours")}</Label><Input type="number" min={0.25} step={0.25} value={logHours} onChange={e => setLogHours(e.target.value)} /></div>
            <div><Label>{t("measurements:log_comment")}</Label><Textarea value={logComment} onChange={e => setLogComment(e.target.value)} rows={2} /></div>
            <Button onClick={handleLogSubmit}>{t("common:save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("measurements:complete_title")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("measurements:standard_duration_label")}</Label>
              <p className="text-sm text-muted-foreground">{completeStdDur} h</p>
            </div>
            <div>
              <Label>{t("measurements:actual_duration")}</Label>
              <Input type="number" min={0.25} step={0.25} value={completeActDur} onChange={e => setCompleteActDur(e.target.value)} />
            </div>
            {parseFloat(completeActDur) !== completeStdDur && (
              <div>
                <Label>{t("measurements:deviation_reason")}</Label>
                <Textarea value={completeReason} onChange={e => setCompleteReason(e.target.value)} placeholder={t("measurements:deviation_placeholder")} rows={3} />
              </div>
            )}
            <Button onClick={async () => {
              const dur = parseFloat(completeActDur);
              if (isNaN(dur) || dur <= 0) { toast.error(t("measurements:valid_duration")); return; }
              if (dur !== completeStdDur && !completeReason.trim()) {
                toast.error(t("measurements:deviation_required"));
                return;
              }
              try {
                const updatePayload: any = { actual_duration_hours: dur, status: 'completed' };
                if (completeReason.trim()) updatePayload.duration_deviation_reason = completeReason.trim();
                const { error } = await supabase.from("order_measurements").update(updatePayload).eq("id", completeMId);
                if (error) throw error;
                toast.success(t("measurements:completed"));
                setCompleteOpen(false);
              } catch (err: any) {
                toast.error(t("common:error"), { description: err.message });
              }
            }}>{t("measurements:complete")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
