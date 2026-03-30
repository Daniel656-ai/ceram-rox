import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useCreateOrder } from "@/hooks/useOrders";
import { useServices, useAddOrderMeasurement } from "@/hooks/useMeasurements";
import { useWorkstations } from "@/hooks/useWorkstations";
import { useServiceParameterDefs } from "@/hooks/useServiceParameters";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Trash2, AlertCircle } from "lucide-react";
import SampleSelector from "@/components/SampleSelector";
import TemplateManager from "@/components/TemplateManager";

interface SelectedMeasurement {
  service_id: string;
  service_name: string;
  planned_hours: number;
  workstation_id: string;
}

function ServiceRequiredParams({ serviceId, paramValues, onParamChange, t }: {
  serviceId: string; paramValues: Record<string, string>;
  onParamChange: (paramId: string, value: string) => void; t: any;
}) {
  const { data: defs = [] } = useServiceParameterDefs(serviceId);
  const requiredInputDefs = defs.filter((d) => d.parameter_category === "input" && d.is_required && !d.conditional_on);
  if (requiredInputDefs.length === 0) return null;

  return (
    <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("orders:required_params")}</p>
      <div className="grid grid-cols-2 gap-2">
        {requiredInputDefs.map((def) => {
          const val = paramValues[def.id] || "";
          const hasError = !val.trim();
          return (
            <div key={def.id} className="space-y-0.5">
              <Label className="text-xs flex items-center gap-1">
                {def.parameter_name}
                {def.unit && <span className="text-muted-foreground font-normal">({def.unit})</span>}
                <span className="text-destructive">*</span>
                {hasError && <AlertCircle className="h-3 w-3 text-destructive" />}
              </Label>
              {def.parameter_type === "number" && (
                <Input type="number" step="any" value={val} onChange={(e) => onParamChange(def.id, e.target.value)} placeholder={def.default_value || ""} className={`h-7 text-xs ${hasError ? "border-destructive" : ""}`} />
              )}
              {def.parameter_type === "text" && (
                <Input value={val} onChange={(e) => onParamChange(def.id, e.target.value)} placeholder={def.default_value || ""} className={`h-7 text-xs ${hasError ? "border-destructive" : ""}`} />
              )}
              {def.parameter_type === "boolean" && (
                <div className="flex items-center gap-2">
                  <Switch checked={val === "true"} onCheckedChange={(c) => onParamChange(def.id, c ? "true" : "false")} />
                  <span className="text-xs">{val === "true" ? t("common:yes") : t("common:no")}</span>
                </div>
              )}
              {def.parameter_type === "select" && (
                <Select value={val} onValueChange={(v) => onParamChange(def.id, v)}>
                  <SelectTrigger className={`h-7 text-xs ${hasError ? "border-destructive" : ""}`}>
                    <SelectValue placeholder={t("orders:please_select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(def.select_options || []).map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CreateOrderPage() {
  const { t } = useTranslation(["orders", "common"]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: services = [] } = useServices();
  const { data: workstations = [] } = useWorkstations();
  const createProject = useCreateProject();
  const createOrder = useCreateOrder();
  const addMeasurement = useAddOrderMeasurement();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [orderType, setOrderType] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [measurements, setMeasurements] = useState<SelectedMeasurement[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [measurementParams, setMeasurementParams] = useState<Record<number, Record<string, string>>>({});

  const addService = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc || measurements.some((m) => m.service_id === serviceId)) return;
    setMeasurements([...measurements, { service_id: serviceId, service_name: svc.service_name, planned_hours: 1, workstation_id: svc.workstation_id || "" }]);
  };

  const handleApplyTemplate = (serviceIds: string[]) => {
    const newMeasurements: SelectedMeasurement[] = [];
    for (const sid of serviceIds) {
      const svc = services.find((s) => s.id === sid);
      if (svc && !newMeasurements.some((m) => m.service_id === sid)) {
        newMeasurements.push({ service_id: sid, service_name: svc.service_name, planned_hours: 1, workstation_id: svc.workstation_id || "" });
      }
    }
    setMeasurements(newMeasurements);
    setMeasurementParams({});
  };

  const removeMeasurement = (idx: number) => {
    setMeasurements(measurements.filter((_, i) => i !== idx));
    setMeasurementParams((prev) => { const next = { ...prev }; delete next[idx]; return next; });
  };

  const updateMeasurement = (idx: number, field: string, value: any) => {
    setMeasurements(measurements.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const updateParam = (measurementIdx: number, paramId: string, value: string) => {
    setMeasurementParams((prev) => ({ ...prev, [measurementIdx]: { ...(prev[measurementIdx] || {}), [paramId]: value } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orderType || measurements.length === 0 || !selectedSampleId) {
      toast.error(t("orders:fill_required"));
      return;
    }
    setSubmitting(true);
    try {
      const projectId = selectedProjectId;
      if (!projectId) { toast.error(t("orders:select_project_error")); setSubmitting(false); return; }

      const order = await createOrder.mutateAsync({
        project_id: projectId, order_type: orderType as any, created_by: user.id,
        due_date: dueDate || undefined, notes: notes || undefined, priority: priority as any, sample_id: selectedSampleId,
      });

      for (let idx = 0; idx < measurements.length; idx++) {
        const m = measurements[idx];
        const createdMeasurement = await addMeasurement.mutateAsync({
          order_id: order.id, service_id: m.service_id, planned_hours: m.planned_hours,
          due_date: dueDate || undefined, workstation_id: m.workstation_id || undefined,
        });
        const params = measurementParams[idx];
        if (params && Object.keys(params).length > 0) {
          const { data: defs } = await supabase.from("service_parameter_definitions").select("id, parameter_name, unit").eq("service_id", m.service_id).in("id", Object.keys(params));
          if (defs && defs.length > 0) {
            const inserts = defs.filter((d) => (params[d.id] || "").trim()).map((d) => ({ order_measurement_id: createdMeasurement.id, parameter_name: d.parameter_name, parameter_value: params[d.id], unit: d.unit || null }));
            if (inserts.length > 0) { const { error } = await supabase.from("measurement_parameters").insert(inserts); if (error) throw error; }
          }
        }
      }
      toast.success(t("orders:created_success"));
      navigate(`/auftraege/${order.id}`);
    } catch (err: any) {
      toast.error(t("orders:create_error"), { description: err.message });
    } finally { setSubmitting(false); }
  };

  const laborServices = services.filter((s) => s.category === "labor");
  const pilotServices = services.filter((s) => s.category === "pilot_plant");

  const orderTypeLabels: Record<string, string> = {
    customer: t("common:order_type_customer"),
    production: t("common:order_type_production"),
    rnd: t("common:order_type_rnd"),
  };

  const priorityLabels: Record<string, string> = {
    normal: t("common:priority_normal"),
    wichtig: t("common:priority_important"),
    hoechste: t("common:priority_highest"),
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("orders:create_title")}</h1>
          <p className="text-muted-foreground">{t("orders:create_subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("common:project")}</CardTitle></CardHeader>
          <CardContent>
            <div>
              <Label>{t("orders:select_project")}</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger><SelectValue placeholder={t("orders:choose_project")} /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.project_number} {p.project_name ? `– ${p.project_name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("orders:sample")} *</CardTitle></CardHeader>
          <CardContent>
            <SampleSelector value={selectedSampleId} onSelect={setSelectedSampleId} projectId={selectedProjectId || undefined} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("orders:order_details")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("orders:order_type")}</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger><SelectValue placeholder={t("orders:choose_type")} /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(orderTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("orders:priority")} *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("orders:due_date")}</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><Label>{t("orders:notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("orders:notes_placeholder")} rows={3} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("orders:measurements_section")}</CardTitle>
              <TemplateManager
                selectedServiceIds={measurements.map((m) => m.service_id)}
                onApplyTemplate={handleApplyTemplate}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("orders:add_measurement")}</Label>
              <Select onValueChange={addService}>
                <SelectTrigger><SelectValue placeholder={t("orders:select_service")} /></SelectTrigger>
                <SelectContent>
                  {laborServices.length > 0 && (
                    <>
                      <SelectItem value="__labor_header" disabled>{t("orders:header_lab", { defaultValue: "── Lab ──" })}</SelectItem>
                      {laborServices.map((s) => (<SelectItem key={s.id} value={s.id} disabled={measurements.some((m) => m.service_id === s.id)}>{s.service_name} ({s.hourly_rate} €/h)</SelectItem>))}
                    </>
                  )}
                  {pilotServices.length > 0 && (
                    <>
                      <SelectItem value="__pilot_header" disabled>{t("orders:header_pilot", { defaultValue: "── Pilot Plant ──" })}</SelectItem>
                      {pilotServices.map((s) => (<SelectItem key={s.id} value={s.id} disabled={measurements.some((m) => m.service_id === s.id)}>{s.service_name} ({s.hourly_rate} €/h)</SelectItem>))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {measurements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("orders:no_measurements_hint")}</p>
            ) : (
              <div className="space-y-3">
                {measurements.map((m, idx) => (
                  <div key={idx} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[120px]"><p className="font-medium text-sm">{m.service_name}</p></div>
                      <div className="w-36">
                        <Label className="text-xs">{t("orders:workstation")}</Label>
                        <Select value={m.workstation_id || "__none"} onValueChange={(v) => updateMeasurement(idx, "workstation_id", v === "__none" ? "" : v)}>
                          <SelectTrigger className="h-8"><SelectValue placeholder={t("orders:choose_workstation")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">{t("orders:none_workstation")}</SelectItem>
                            {workstations.filter((w: any) => w.status === "active").map((w: any) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">{t("common:hours")}</Label>
                        <Input type="number" min={0.5} step={0.5} value={m.planned_hours} onChange={(e) => updateMeasurement(idx, "planned_hours", parseFloat(e.target.value) || 0)} className="h-8" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMeasurement(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <ServiceRequiredParams serviceId={m.service_id} paramValues={measurementParams[idx] || {}} onParamChange={(paramId, value) => updateParam(idx, paramId, value)} t={t} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>{submitting ? t("orders:submitting") : t("orders:submit_order")}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>{t("common:cancel")}</Button>
        </div>
      </form>
    </div>
  );
}
