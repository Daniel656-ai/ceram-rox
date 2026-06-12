import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useCreateOrder } from "@/hooks/useOrders";
import { useServices, useAddOrderMeasurement } from "@/hooks/useMeasurements";
import { useWorkstations } from "@/hooks/useWorkstations";
import { useServiceParameterDefs } from "@/hooks/useServiceParameters";
import { useTemplates, useApplyTemplate } from "@/hooks/useTemplates";
import { useSamples } from "@/hooks/useSamples";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Trash2, AlertCircle, Zap, CheckCircle2, ClipboardList, Copy } from "lucide-react";
import SampleSelector from "@/components/SampleSelector";
import TemplateManager from "@/components/TemplateManager";

interface SelectedMeasurement {
  uid: string;
  service_id: string;
  service_name: string;
  planned_hours: number;
  workstation_id: string;
}

const newUid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

function ServiceRequiredParams({ serviceId, paramValues, onParamChange, t }: {
  serviceId: string; paramValues: Record<string, string>;
  onParamChange: (paramId: string, value: string) => void; t: any;
}) {
  const { data: defs = [] } = useServiceParameterDefs(serviceId);
  const inputDefs = defs.filter((d) => d.parameter_category === "input" && !d.conditional_on);
  if (inputDefs.length === 0) return null;

  const requiredDefs = inputDefs.filter((d) => d.is_required);
  const optionalDefs = inputDefs.filter((d) => !d.is_required);

  const renderField = (def: typeof inputDefs[0]) => {
    const val = paramValues[def.id] || "";
    const hasError = def.is_required && !val.trim();
    return (
      <div key={def.id} className="space-y-0.5">
        <Label className="text-xs flex items-center gap-1">
          {def.parameter_name}
          {def.unit && <span className="text-muted-foreground font-normal">({def.unit})</span>}
          {def.is_required && <span className="text-destructive">*</span>}
          {hasError && <AlertCircle className="h-3 w-3 text-destructive" />}
        </Label>
        {def.description && (
          <p className="text-[10px] text-muted-foreground">{def.description}</p>
        )}
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
  };

  return (
    <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-2">
      {requiredDefs.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t("orders:required_params")}</p>
          <div className="grid grid-cols-2 gap-2">
            {requiredDefs.map(renderField)}
          </div>
        </>
      )}
      {optionalDefs.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground mt-2">{t("orders:optional_params", { defaultValue: "Optionale Parameter" })}</p>
          <div className="grid grid-cols-2 gap-2">
            {optionalDefs.map(renderField)}
          </div>
        </>
      )}
    </div>
  );
}

export default function CreateOrderPage() {
  const { t } = useTranslation(["orders", "common"]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewRates = hasPermission("costs.view_hourly_rates");
  const { data: projects = [] } = useProjects();
  const { data: services = [] } = useServices();
  const { data: workstations = [] } = useWorkstations();
  const { data: templates = [] } = useTemplates();
  const { data: allSamples = [] } = useSamples();
  const createOrder = useCreateOrder();
  const addMeasurement = useAddOrderMeasurement();
  const applyTemplate = useApplyTemplate();

  const [mode, setMode] = useState<"single" | "batch">("single");

  // Single order state
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [orderType, setOrderType] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [measurements, setMeasurements] = useState<SelectedMeasurement[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [measurementParams, setMeasurementParams] = useState<Record<string, Record<string, string>>>({});

  // Batch state
  const [batchTemplateId, setBatchTemplateId] = useState("");
  const [batchProjectId, setBatchProjectId] = useState("");
  const [batchOrderType, setBatchOrderType] = useState("customer");
  const [batchPriority, setBatchPriority] = useState("normal");
  const [batchDueDate, setBatchDueDate] = useState("");
  const [batchSelectedSampleIds, setBatchSelectedSampleIds] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<string[] | null>(null);

  const batchProjectSamples = useMemo(() =>
    (allSamples as any[]).filter(s => s.project_id === batchProjectId),
    [allSamples, batchProjectId]
  );

  const selectedBatchTemplate = (templates as any[]).find(tmpl => tmpl.id === batchTemplateId);
  const batchTemplateItemCount = selectedBatchTemplate?.measurement_template_items?.length || 0;
  const batchTotalMeasurements = batchTemplateItemCount * batchSelectedSampleIds.length;

  const toggleBatchSample = (id: string) => {
    setBatchSelectedSampleIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAllBatchSamples = () => {
    setBatchSelectedSampleIds(batchProjectSamples.map(s => s.id));
  };

  const handleBatchApply = async () => {
    if (!batchTemplateId || !batchProjectId || batchSelectedSampleIds.length === 0) {
      toast.error("Bitte Template, Projekt und mindestens eine Probe auswählen");
      return;
    }
    try {
      const orderIds = await applyTemplate.mutateAsync({
        templateId: batchTemplateId,
        projectId: batchProjectId,
        sampleIds: batchSelectedSampleIds,
        createdBy: user!.id,
        orderType: batchOrderType,
        priority: batchPriority,
        dueDate: batchDueDate || undefined,
      });
      setBatchResult(orderIds);
      toast.success(`${orderIds.length} Auftrag/Aufträge mit ${batchTotalMeasurements} Aufgaben erstellt`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Single order functions
  const addService = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setMeasurements((prev) => [
      ...prev,
      { uid: newUid(), service_id: serviceId, service_name: svc.service_name, planned_hours: 1, workstation_id: svc.workstation_id || "" },
    ]);
  };

  const handleApplyTemplate = (serviceIds: string[]) => {
    const newMeasurements: SelectedMeasurement[] = [];
    for (const sid of serviceIds) {
      const svc = services.find((s) => s.id === sid);
      if (svc) {
        newMeasurements.push({ uid: newUid(), service_id: sid, service_name: svc.service_name, planned_hours: 1, workstation_id: svc.workstation_id || "" });
      }
    }
    setMeasurements(newMeasurements);
    setMeasurementParams({});
  };

  const removeMeasurement = (uid: string) => {
    setMeasurements((prev) => prev.filter((m) => m.uid !== uid));
    setMeasurementParams((prev) => { const next = { ...prev }; delete next[uid]; return next; });
  };

  const duplicateMeasurement = (uid: string) => {
    const newUidValue = newUid();
    setMeasurements((prev) => {
      const idx = prev.findIndex((m) => m.uid === uid);
      if (idx === -1) return prev;
      const copy: SelectedMeasurement = { ...prev[idx], uid: newUidValue };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setMeasurementParams((prev) => {
      const srcParams = prev[uid];
      if (!srcParams) return prev;
      return { ...prev, [newUidValue]: { ...srcParams } };
    });
  };

  const updateMeasurement = (uid: string, field: string, value: any) => {
    setMeasurements((prev) => prev.map((m) => m.uid === uid ? { ...m, [field]: value } : m));
  };

  const updateParam = (uid: string, paramId: string, value: string) => {
    setMeasurementParams((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), [paramId]: value } }));
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
        due_date: dueDate || undefined, notes: notes || undefined, sample_id: selectedSampleId,
      });

      for (let idx = 0; idx < measurements.length; idx++) {
        const m = measurements[idx];
        const createdMeasurement = await addMeasurement.mutateAsync({
          order_id: order.id, service_id: m.service_id, planned_hours: m.planned_hours,
          due_date: dueDate || undefined, workstation_id: m.workstation_id || undefined,
        });
        const params = measurementParams[m.uid];
        if (params && Object.keys(params).length > 0) {
          const defs = await api.serviceParameters.listByIdsForService(m.service_id, Object.keys(params));
          if (defs && defs.length > 0) {
            const inserts = defs.filter((d: any) => (params[d.id] || "").trim()).map((d: any) => ({ order_measurement_id: createdMeasurement.id, parameter_name: d.parameter_name, parameter_value: params[d.id], unit: d.unit || null }));
            if (inserts.length > 0) { await api.measurementParameters.bulkInsert(inserts); }
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

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "single" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("single")}
          className="gap-1.5"
        >
          <ClipboardList className="h-4 w-4" />
          Einzelauftrag
        </Button>
        <Button
          variant={mode === "batch" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("batch")}
          className="gap-1.5"
        >
          <Zap className="h-4 w-4" />
          Batch-Planung
        </Button>
      </div>

      {mode === "single" ? (
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
            <div>
              <Label>{t("orders:order_type")}</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger><SelectValue placeholder={t("orders:choose_type")} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(orderTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
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
                      {laborServices.map((s) => (<SelectItem key={s.id} value={s.id}>{s.service_name}{canViewRates ? ` (${s.hourly_rate} €/h)` : ""}</SelectItem>))}
                    </>
                  )}
                  {pilotServices.length > 0 && (
                    <>
                      <SelectItem value="__pilot_header" disabled>{t("orders:header_pilot", { defaultValue: "── Pilot Plant ──" })}</SelectItem>
                      {pilotServices.map((s) => (<SelectItem key={s.id} value={s.id}>{s.service_name}{canViewRates ? ` (${s.hourly_rate} €/h)` : ""}</SelectItem>))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("orders:duplicate_hint", { defaultValue: "Dieselbe Dienstleistung kann mehrfach hinzugefügt werden – jede Position ist unabhängig." })}
              </p>
            </div>

            {measurements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("orders:no_measurements_hint")}</p>
            ) : (
              <div className="space-y-3">
                {measurements.map((m, idx) => (
                  <div key={m.uid} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <p className="font-medium text-sm">
                          <span className="text-muted-foreground mr-1">#{idx + 1}</span>
                          {m.service_name}
                        </p>
                      </div>
                      <div className="w-36">
                        <Label className="text-xs">{t("orders:workstation")}</Label>
                        <Select value={m.workstation_id || "__none"} onValueChange={(v) => updateMeasurement(m.uid, "workstation_id", v === "__none" ? "" : v)}>
                          <SelectTrigger className="h-8"><SelectValue placeholder={t("orders:choose_workstation")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">{t("orders:none_workstation")}</SelectItem>
                            {workstations.filter((w: any) => w.status === "active").map((w: any) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">{t("common:hours")}</Label>
                        <Input type="number" min={0.5} step={0.5} value={m.planned_hours} onChange={(e) => updateMeasurement(m.uid, "planned_hours", parseFloat(e.target.value) || 0)} className="h-8" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMeasurement(m.uid)} title={t("orders:duplicate", { defaultValue: "Duplizieren" })}><Copy className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMeasurement(m.uid)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <ServiceRequiredParams serviceId={m.service_id} paramValues={measurementParams[m.uid] || {}} onParamChange={(paramId, value) => updateParam(m.uid, paramId, value)} t={t} />
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
      ) : (
      /* Batch Planning Mode */
      <div className="space-y-6">
        {batchResult ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-bold mb-2">Batch-Planung abgeschlossen!</h2>
              <p className="text-muted-foreground mb-4">
                {batchResult.length} Auftrag/Aufträge mit insgesamt {batchTotalMeasurements} Aufgaben wurden erstellt.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => { setBatchResult(null); setBatchSelectedSampleIds([]); }}>
                  Weitere Batch-Planung
                </Button>
                <Button onClick={() => navigate("/auftraege")}>
                  Zu den Aufträgen
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">1. Template & Konfiguration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Template *</Label>
                      <Select value={batchTemplateId} onValueChange={setBatchTemplateId}>
                        <SelectTrigger><SelectValue placeholder="Template wählen" /></SelectTrigger>
                        <SelectContent>
                          {(templates as any[]).map(tmpl => (
                            <SelectItem key={tmpl.id} value={tmpl.id}>
                              {tmpl.name} ({(tmpl.measurement_template_items || []).length} Aufgaben)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedBatchTemplate && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(selectedBatchTemplate.measurement_template_items || []).map((item: any) => (
                            <Badge key={item.id} variant="outline" className="text-xs">
                              {item.measurement_services?.service_name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Projekt *</Label>
                      <Select value={batchProjectId} onValueChange={(v) => { setBatchProjectId(v); setBatchSelectedSampleIds([]); }}>
                        <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                        <SelectContent>
                          {(projects as any[]).map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.project_number} – {p.project_name || "–"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Auftragstyp</Label>
                        <Select value={batchOrderType} onValueChange={setBatchOrderType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(orderTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priorität</Label>
                        <Select value={batchPriority} onValueChange={setBatchPriority}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(priorityLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Fällig</Label>
                        <Input type="date" value={batchDueDate} onChange={e => setBatchDueDate(e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">2. Proben auswählen</CardTitle>
                      {batchProjectSamples.length > 0 && (
                        <Button variant="outline" size="sm" onClick={selectAllBatchSamples}>
                          Alle auswählen ({batchProjectSamples.length})
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!batchProjectId ? (
                      <p className="text-sm text-muted-foreground">Bitte zuerst ein Projekt wählen</p>
                    ) : batchProjectSamples.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Keine Proben in diesem Projekt</p>
                    ) : (
                      <div className="border rounded-md max-h-64 overflow-y-auto">
                        {batchProjectSamples.map(s => (
                          <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0">
                            <Checkbox
                              checked={batchSelectedSampleIds.includes(s.id)}
                              onCheckedChange={() => toggleBatchSample(s.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{s.sample_number}</span>
                              <span className="text-sm text-muted-foreground ml-2">{s.sample_name}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                          </label>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {batchTemplateId && batchSelectedSampleIds.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {batchSelectedSampleIds.length} Probe(n) × {batchTemplateItemCount} Aufgabe(n) = <strong>{batchTotalMeasurements} Aufgaben</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Es werden {batchSelectedSampleIds.length} Auftrag/Aufträge erstellt, jeweils mit {batchTemplateItemCount} Aufgaben.
                      </p>
                    </div>
                    <Button size="lg" onClick={handleBatchApply} disabled={applyTemplate.isPending}>
                      <Zap className="h-4 w-4 mr-2" />
                      {applyTemplate.isPending ? "Erstelle…" : "Batch ausführen"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}
