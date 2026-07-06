import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ServiceBookingForm from "@/components/ServiceBookingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";

/**
 * Task-focused execution view for a measurement (Messdienstleister workflow).
 *
 * Loads the Service-Designer form for the measurement's service, lets the
 * assigned technician fill it in, and on submit persists every filled field
 * to `measurement_results` (never to service parameters / form definition)
 * and marks the measurement as completed.
 */
export default function TaskExecutionPage() {
  const { measurementId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, role } = useAuth();

  const { data: measurement, isLoading } = useQuery({
    queryKey: ["measurement-task", measurementId],
    queryFn: () => api.measurements.get(measurementId!),
    enabled: !!measurementId,
  });

  const serviceId: string | undefined = (measurement as any)?.service_id;

  // Prefer the employee-facing form; fall back to the customer form.
  const [roleView, setRoleView] = useState<FormRoleView>("employee");
  const { data: employeeLayout } = useQuery({
    queryKey: ["service-form-layout", serviceId, "employee"],
    queryFn: () => api.serviceFormLayouts.get(serviceId!, "employee"),
    enabled: !!serviceId,
  });
  const { data: customerLayout } = useQuery({
    queryKey: ["service-form-layout", serviceId, "customer"],
    queryFn: () => api.serviceFormLayouts.get(serviceId!, "customer"),
    enabled: !!serviceId,
  });

  useEffect(() => {
    const employeeHas = !!employeeLayout?.layout?.sections?.length;
    const customerHas = !!customerLayout?.layout?.sections?.length;
    if (!employeeHas && customerHas) setRoleView("customer");
    else setRoleView("employee");
  }, [employeeLayout, customerLayout]);

  const activeLayout = roleView === "employee" ? employeeLayout : customerLayout;
  const hasForm = !!activeLayout?.layout?.sections?.length;

  const [values, setValues] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  // Preload existing results into the form (so partial saves resume nicely).
  useEffect(() => {
    if (initialized || !measurement) return;
    const initial: Record<string, any> = {};
    for (const r of (measurement as any).measurement_results ?? []) {
      const key = r.result_name;
      if (!key) continue;
      if (r.value != null) initial[key] = String(r.value);
      else if (r.remarks != null) {
        // Repeatable / complex values were stored as JSON in remarks.
        try {
          const parsed = JSON.parse(r.remarks);
          initial[key] = parsed;
        } catch {
          initial[key] = r.remarks;
        }
      }
    }
    setValues(initial);
    setInitialized(true);
  }, [measurement, initialized]);

  const canEdit = useMemo(() => {
    if (!measurement) return false;
    if (role === "master") return true;
    return (measurement as any).assigned_to === user?.id;
  }, [measurement, role, user]);

  const isCompleted = (measurement as any)?.status === "completed";

  const [completeOpen, setCompleteOpen] = useState(false);
  const [actualDuration, setActualDuration] = useState("");
  const [deviationReason, setDeviationReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openCompleteDialog = () => {
    const std =
      (measurement as any)?.measurement_services?.standard_duration_hours ??
      (measurement as any)?.planned_hours ??
      1;
    setActualDuration(String(std));
    setDeviationReason("");
    setCompleteOpen(true);
  };

  const persistResults = async () => {
    if (!measurementId) return;
    const existing = ((measurement as any).measurement_results ?? []) as any[];
    const existingByName = new Map(existing.map((r) => [r.result_name, r]));
    const measuredAt = new Date().toISOString().slice(0, 10);

    const activeKeys = new Set<string>();

    for (const [key, raw] of Object.entries(values)) {
      const isEmpty =
        raw == null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0);
      if (isEmpty) continue;
      activeKeys.add(key);

      // Numeric single value → store in `value`; everything else → JSON in `remarks`.
      let payload: any = {
        result_name: key,
        measured_by: user?.id ?? null,
        measured_at: measuredAt,
        value: null,
        remarks: null,
      };
      if (typeof raw === "string" || typeof raw === "number") {
        const num = typeof raw === "number" ? raw : parseFloat(raw);
        if (typeof raw === "number" || (!isNaN(num) && String(num) === String(raw).trim())) {
          payload.value = num;
        } else {
          payload.remarks = String(raw);
        }
      } else {
        payload.remarks = JSON.stringify(raw);
      }

      const prev = existingByName.get(key);
      if (prev) {
        await api.measurementResults.update(prev.id, payload);
      } else {
        await api.measurementResults.create({
          order_measurement_id: measurementId,
          ...payload,
        });
      }
    }

    // Remove results whose field was cleared.
    for (const r of existing) {
      if (!activeKeys.has(r.result_name)) {
        await api.measurementResults.delete(r.id);
      }
    }
  };

  const handleCompleteSubmit = async () => {
    if (!measurementId) return;
    const dur = parseFloat(actualDuration);
    if (isNaN(dur) || dur <= 0) {
      toast.error("Bitte gültige Dauer angeben");
      return;
    }
    const std =
      (measurement as any)?.measurement_services?.standard_duration_hours ?? dur;
    if (dur !== std && !deviationReason.trim()) {
      toast.error("Bei Abweichung von der Standarddauer ist eine Begründung erforderlich");
      return;
    }
    setSubmitting(true);
    try {
      await persistResults();
      await api.measurements.complete(measurementId, dur, deviationReason);
      toast.success("Messung abgeschlossen und Ergebnisse gespeichert");
      qc.invalidateQueries({ queryKey: ["measurement-task", measurementId] });
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      setCompleteOpen(false);
      navigate("/auftraege");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSubmitting(true);
    try {
      await persistResults();
      toast.success("Zwischenstand gespeichert");
      qc.invalidateQueries({ queryKey: ["measurement-task", measurementId] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!measurement) return <p className="text-muted-foreground">Aufgabe nicht gefunden.</p>;

  const m: any = measurement;
  const order = m.measurement_orders;
  const project = order?.projects;
  const sample = order?.samples;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {m.measurement_services?.service_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Aufgabe {m.measurement_number}
            {order?.order_number ? ` · Auftrag ${order.order_number}` : ""}
            {project?.project_number ? ` · Projekt ${project.project_number}` : ""}
          </p>
        </div>
        <StatusBadge status={m.status} />
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Kontext</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Projekt</p>
            <p className="font-medium">
              {project?.project_number ? `${project.project_number} – ${project.project_name ?? ""}` : "–"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Probe / Objekt</p>
            <p className="font-medium">
              {sample?.sample_number ? `${sample.sample_number} – ${sample.sample_name ?? ""}` : "–"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Arbeitsplatz</p>
            <p className="font-medium">{m.workstations?.name ?? "–"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Bearbeiter</p>
            <p className="font-medium">
              {user ? `${user.email ?? ""}` : "–"}
            </p>
          </div>
        </CardContent>
      </Card>

      {m.measurement_services?.work_instructions?.trim() ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              Arbeitsauftrag
              <Badge variant="outline" className="text-[10px]">Vorgaben des Technikers · schreibgeschützt</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {m.measurement_services.work_instructions}
            </p>
          </CardContent>
        </Card>
      ) : null}


      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            Ergebnisformular
            <Badge variant="outline" className="text-[10px]">
              {roleView === "employee" ? "Techniker-Ansicht" : "Standardformular"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!serviceId ? (
            <p className="text-sm text-muted-foreground">Keine Dienstleistung verknüpft.</p>
          ) : !hasForm ? (
            <p className="text-sm text-muted-foreground">
              Für diese Dienstleistung wurde im Service-Designer noch kein Formular hinterlegt.
              Bitte im Service-Designer ein Formular für die Rolle „{roleView}" definieren.
            </p>
          ) : (
            <ServiceBookingForm
              serviceId={serviceId}
              roleView={roleView}
              values={values}
              onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
            />
          )}
        </CardContent>
      </Card>

      {canEdit && hasForm && !isCompleted && (
        <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background/95 border-t py-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>
            Zwischenstand speichern
          </Button>
          <Button onClick={openCompleteDialog} disabled={submitting}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Messung abschließen
          </Button>
        </div>
      )}

      {isCompleted && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="py-4 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Diese Messung wurde bereits abgeschlossen. Ergebnisse sind schreibgeschützt.
          </CardContent>
        </Card>
      )}

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Messung abschließen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Standarddauer</Label>
              <p className="text-sm text-muted-foreground">
                {m.measurement_services?.standard_duration_hours ?? "–"} h
              </p>
            </div>
            <div>
              <Label>Tatsächliche Messdauer (h)</Label>
              <Input
                type="number"
                min={0.25}
                step={0.25}
                value={actualDuration}
                onChange={(e) => setActualDuration(e.target.value)}
              />
            </div>
            {parseFloat(actualDuration) !==
              (m.measurement_services?.standard_duration_hours ?? parseFloat(actualDuration)) && (
              <div>
                <Label>Begründung der Abweichung *</Label>
                <Textarea
                  value={deviationReason}
                  onChange={(e) => setDeviationReason(e.target.value)}
                  placeholder="Pflichtfeld bei Abweichung von der Standarddauer"
                  rows={3}
                />
              </div>
            )}
            <Button onClick={handleCompleteSubmit} disabled={submitting} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Abschließen &amp; Ergebnisse speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
