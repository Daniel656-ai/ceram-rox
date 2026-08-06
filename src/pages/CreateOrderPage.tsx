import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useCreateOrder } from "@/hooks/useOrders";
import { useServices, useAddOrderMeasurement } from "@/hooks/useMeasurements";
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
import { ArrowLeft, Trash2, AlertCircle, Zap, CheckCircle2, ClipboardList, Copy, Layers, Package as PackageIcon } from "lucide-react";
import SampleSelector from "@/components/SampleSelector";
import TemplateManager from "@/components/TemplateManager";
import ServiceBookingForm, { useServiceHasFormLayout } from "@/components/ServiceBookingForm";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";
import OrderKindDynamicForm from "@/components/OrderKindDynamicForm";

interface SelectedMeasurement {
  uid: string;
  service_id: string;
  service_name: string;
  planned_hours: number;
  source_package_id?: string | null;
  source_package_name?: string | null;
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

/**
 * Switches between the new Service-Designer form (if a layout exists for
 * the role) and the legacy parameter system as a fallback.
 */
function ServiceBookingOrLegacyParams({
  serviceId, roleView, formValues, onFormChange,
  paramValues, onParamChange, t,
}: {
  serviceId: string;
  roleView: FormRoleView;
  formValues: Record<string, any>;
  onFormChange: (key: string, value: any) => void;
  paramValues: Record<string, string>;
  onParamChange: (paramId: string, value: string) => void;
  t: any;
}) {
  const { data: hasLayout, isLoading } = useServiceHasFormLayout(serviceId, roleView);
  if (isLoading) return null;
  if (hasLayout) {
    return (
      <div className="mt-2 pl-2 border-l-2 border-primary/30">
        <ServiceBookingForm
          serviceId={serviceId}
          roleView={roleView}
          values={formValues}
          onChange={onFormChange}
          compact
        />
      </div>
    );
  }
  return (
    <ServiceRequiredParams
      serviceId={serviceId}
      paramValues={paramValues}
      onParamChange={onParamChange}
      t={t}
    />
  );
}

export default function CreateOrderPage() {
  const { t } = useTranslation(["orders", "common"]);
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewRates = hasPermission("costs.view_hourly_rates");
  // Service-Designer role view mapping
  const roleView: FormRoleView = role === "auftraggeber" ? "customer" : "employee";
  const { data: projects = [] } = useProjects();
  const { data: services = [] } = useServices();
  const { data: servicePackages = [] } = useQuery({
    queryKey: ["service-packages", "active-only"],
    queryFn: () => api.servicePackages.listWithItems({ includeInactive: false }),
  });
  const { data: processTemplates = [] } = useQuery({
    queryKey: ["process-templates", "active"],
    queryFn: () => api.processTemplates.list({ scope: "template" }),
    enabled: role !== "auftraggeber",
  });
  const { data: templates = [] } = useTemplates();
  const { data: allSamples = [] } = useSamples();
  const createOrder = useCreateOrder();
  const addMeasurement = useAddOrderMeasurement();
  const applyTemplate = useApplyTemplate();

  const [mode, setMode] = useState<"single" | "batch">("single");

  // Single order state
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [orderType, setOrderType] = useState<string>("");
  const [orderKind, setOrderKind] = useState<"labor" | "pilot_plant" | "combined">("labor");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [measurements, setMeasurements] = useState<SelectedMeasurement[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [processTemplateId, setProcessTemplateId] = useState<string>("__none__");
  const [submitting, setSubmitting] = useState(false);
  const [measurementParams, setMeasurementParams] = useState<Record<string, Record<string, string>>>({});
  const [measurementFormValues, setMeasurementFormValues] = useState<Record<string, Record<string, any>>>({});

  // Pilot Plant fields
  const [pp, setPp] = useState({
    experiment_number: "",
    v2o5_percent: "",
    experiment_date: "",
    previous_experiments: "",
    experiment_kind: "",
    masse_type: "__none__" as string,
    remarks: "",
  });
  // Dynamic template-driven values keyed by field_key (loaded per order kind
  // from order_kind_form_templates). No hardcoded field list.
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});
  const [dynamicFormId, setDynamicFormId] = useState<string | null>(null);
  // Analysis requests pool (Pilot Plant / Combined orders): pre-planned analyses without a sample yet
  const [analysisRequests, setAnalysisRequests] = useState<Array<{ uid: string; service_id: string; service_name: string; quantity: number }>>([]);

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
      { uid: newUid(), service_id: serviceId, service_name: svc.service_name, planned_hours: 1 },
    ]);
  };

  const applyServicePackage = (packageId: string) => {
    const pkg = servicePackages.find((p: any) => p.id === packageId);
    if (!pkg) return;
    setMeasurements((prev) => {
      const existingKeys = new Set(prev.map((m) => `${m.service_id}::${m.source_package_id ?? ""}`));
      const additions: SelectedMeasurement[] = [];
      for (const it of pkg.items) {
        const svc = it.measurement_services;
        if (!svc) continue;
        const key = `${svc.id}::${pkg.id}`;
        if (existingKeys.has(key)) continue;
        additions.push({
          uid: newUid(),
          service_id: svc.id,
          service_name: svc.service_name,
          planned_hours: svc.standard_duration_hours || 1,
          source_package_id: pkg.id,
          source_package_name: pkg.name,
        });
      }
      if (additions.length === 0) {
        toast.info(`Alle Dienstleistungen aus "${pkg.name}" sind bereits enthalten.`);
        return prev;
      }
      toast.success(`${additions.length} Dienstleistung(en) aus "${pkg.name}" hinzugefügt`);
      return [...prev, ...additions];
    });
  };



  const handleApplyTemplate = (serviceIds: string[]) => {
    const newMeasurements: SelectedMeasurement[] = [];
    for (const sid of serviceIds) {
      const svc = services.find((s) => s.id === sid);
      if (svc) {
        newMeasurements.push({ uid: newUid(), service_id: sid, service_name: svc.service_name, planned_hours: 1 });
      }
    }
    setMeasurements(newMeasurements);
    setMeasurementParams({});
  };

  const removeMeasurement = (uid: string) => {
    setMeasurements((prev) => prev.filter((m) => m.uid !== uid));
    setMeasurementParams((prev) => { const next = { ...prev }; delete next[uid]; return next; });
    setMeasurementFormValues((prev) => { const next = { ...prev }; delete next[uid]; return next; });
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
    setMeasurementFormValues((prev) => {
      const srcVals = prev[uid];
      if (!srcVals) return prev;
      return { ...prev, [newUidValue]: { ...srcVals } };
    });
  };

  const updateMeasurement = (uid: string, field: string, value: any) => {
    setMeasurements((prev) => prev.map((m) => m.uid === uid ? { ...m, [field]: value } : m));
  };

  const updateParam = (uid: string, paramId: string, value: string) => {
    setMeasurementParams((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), [paramId]: value } }));
  };

  const updateFormValue = (uid: string, key: string, value: any) => {
    setMeasurementFormValues((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), [key]: value } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPurePP = orderKind === "pilot_plant";
    // Labor requires sample + measurements. Pilot Plant / Combined may start without a sample; measurements optional for pure PP.
    if (!user || !orderType) {
      toast.error(t("orders:fill_required"));
      return;
    }
    if (!isPurePP && (measurements.length === 0 || !selectedSampleId)) {
      toast.error(t("orders:fill_required"));
      return;
    }
    setSubmitting(true);
    try {
      const projectId = selectedProjectId;
      if (!projectId) { toast.error(t("orders:select_project_error")); setSubmitting(false); return; }

      const order = await createOrder.mutateAsync({
        project_id: projectId, order_type: orderType as any, created_by: user.id,
        due_date: dueDate || undefined, notes: notes || undefined,
        sample_id: selectedSampleId || undefined,
        order_kind: orderKind,
        pp_experiment_number: pp.experiment_number || null,
        pp_v2o5_percent: pp.v2o5_percent === "" ? null : Number(pp.v2o5_percent),
        pp_experiment_date: pp.experiment_date || null,
        pp_issuer_user_id: (orderKind === "pilot_plant" || orderKind === "combined") ? user.id : null,
        pp_previous_experiments: pp.previous_experiments || null,
        pp_experiment_kind: pp.experiment_kind || null,
        pp_masse_type: (pp.masse_type === "__none__" ? null : pp.masse_type) as any,
        pp_remarks: pp.remarks || null,
      });

      // Pilot Plant: seed 9 process blocks and store Stammdaten into shared_form_data
      if (orderKind === "pilot_plant" || orderKind === "combined") {
        try {
          await api.pilotPlantBlocks.seed(order.id);
          await api.orderSharedFormData.merge(order.id, {
            pp: {
              stammdaten: {
                versuchsnummer: pp.experiment_number || null,
                experiment_date: pp.experiment_date || null,
                versuchsart: pp.experiment_kind || null,
                previous_experiments: pp.previous_experiments || null,
                masse_type: pp.masse_type === "__none__" ? null : pp.masse_type,
                remarks: pp.remarks || null,
                requested_lab_service_ids: analysisRequests.map((a: any) => a.service_id),
                requested_lab_services: analysisRequests.map((a: any) => ({
                  service_id: a.service_id, service_name: a.service_name, quantity: a.quantity,
                })),
                created_by: user.id,
                created_at: new Date().toISOString(),
              },
            },
          });
        } catch (err: any) {
          toast.error(`Pilot-Plant-Bausteine: ${err.message}`);
        }
      }

      // Persist template-driven dynamic form values (no hardcoded fields).
      if (dynamicFormId && Object.keys(dynamicValues).length > 0) {
        try {
          await api.orderSharedFormData.merge(order.id, {
            template: {
              form_definition_id: dynamicFormId,
              order_kind: orderKind,
              values: dynamicValues,
              saved_at: new Date().toISOString(),
              saved_by: user.id,
            },
          });
        } catch (err: any) {
          toast.error(`Formularvorlage: ${err.message}`);
        }
      }

      // Phase 5: If a process template was selected, spin up an order_instance
      // linked to this measurement_order and seed its workflow steps.
      if (processTemplateId && processTemplateId !== "__none__") {
        try {
          const tpl = (processTemplates as any[]).find(t => t.id === processTemplateId);
          let snapshot: Record<string, unknown> | null = null;
          try { snapshot = await api.processTemplates.snapshot(processTemplateId); } catch { /* optional */ }
          const instance = await api.orderInstances.create({
            template_id: processTemplateId,
            template_snapshot: snapshot,
            project_id: projectId,
            legacy_order_id: order.id,
            title: tpl?.name ?? null,
            status: "planned",
            sample_ids: selectedSampleId ? [selectedSampleId] : null,
            shared_data: {},
            created_by: user.id,
          });
          await api.workflowEngine.seedFromTemplate(instance.id, processTemplateId);
        } catch (err: any) {
          toast.error(`Prozessvorlage: ${err.message}`);
        }
      }




      // Analysis requests pool (only for PP / combined)
      for (const ar of analysisRequests) {
        try {
          await api.orderAnalysisRequests.create({
            order_id: order.id, service_id: ar.service_id, quantity: ar.quantity, created_by: user.id,
          });
        } catch (err: any) {
          toast.error(`Analyseanforderung ${ar.service_name}: ${err.message}`);
        }
      }

      for (let idx = 0; idx < measurements.length; idx++) {
        const m = measurements[idx];
        const createdMeasurement = await addMeasurement.mutateAsync({
          order_id: order.id, service_id: m.service_id, planned_hours: m.planned_hours,
          due_date: dueDate || undefined,
          source_package_id: m.source_package_id ?? null,
          source_package_name_snapshot: m.source_package_name ?? null,
        });
        const params = measurementParams[m.uid];
        if (params && Object.keys(params).length > 0) {
          const defs = await api.serviceParameters.listByIdsForService(m.service_id, Object.keys(params));
          if (defs && defs.length > 0) {
            const inserts = defs.filter((d: any) => (params[d.id] || "").trim()).map((d: any) => ({ order_measurement_id: createdMeasurement.id, parameter_name: d.parameter_name, parameter_value: params[d.id], unit: d.unit || null }));
            if (inserts.length > 0) { await api.measurementParameters.bulkInsert(inserts); }
          }
        }
        // Service Designer Formulardaten persistieren
        const formVals = measurementFormValues[m.uid];
        if (formVals && Object.keys(formVals).length > 0) {
          const fields = await api.serviceDataFields.listForService(m.service_id);
          const uploadKeys = new Set(
            fields.filter((f: any) => f.field_type === "file" || f.field_type === "image").map((f: any) => f.field_key)
          );

          // Helper: is this value an upload-field value? (array of UploadValueEntry)
          const isUploadValue = (v: any) =>
            Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && "__id" in x && ("pendingFile" in x || "templateId" in x || "storagePath" in x));

          // Process a single upload entry
          const persistUpload = async (fieldKey: string, entryIndex: number | null, entry: any) => {
            try {
              if (entry.pendingFile instanceof File) {
                await api.orderUploads.uploadFile({
                  measurementId: createdMeasurement.id,
                  fieldKey,
                  entryIndex,
                  file: entry.pendingFile,
                  uploadedBy: user!.id,
                });
              } else if (entry.templateId) {
                const templates = await api.serviceFieldTemplates.listForField(
                  (fields.find((f: any) => f.field_key === fieldKey) as any)?.id
                );
                const tpl = templates.find((t: any) => t.id === entry.templateId);
                if (tpl) {
                  await api.orderUploads.attachTemplate({
                    measurementId: createdMeasurement.id,
                    fieldKey,
                    entryIndex,
                    template: tpl,
                    uploadedBy: user!.id,
                  });
                }
              }
            } catch (err: any) {
              toast.error(`Upload „${entry.name}" fehlgeschlagen`, { description: err.message });
            }
          };

          // Split values: uploads vs. parameters, including inside repeatable arrays
          const paramInserts: Array<{ order_measurement_id: string; parameter_name: string; parameter_value: string; unit: string | null }> = [];
          for (const [key, v] of Object.entries(formVals)) {
            if (v == null) continue;

            // Top-level upload field
            if (uploadKeys.has(key) && isUploadValue(v)) {
              for (const entry of v as any[]) await persistUpload(key, null, entry);
              continue;
            }

            // Repeatable section: array of entries
            if (key.startsWith("repeat:") && Array.isArray(v)) {
              if (v.length === 0) continue;
              // Extract upload entries from each repeatable entry and remove them from the JSON
              const cleaned = v.map((entry: any, idx: number) => {
                if (!entry || typeof entry !== "object") return entry;
                const out: Record<string, any> = {};
                for (const [ek, ev] of Object.entries(entry)) {
                  if (uploadKeys.has(ek) && isUploadValue(ev)) {
                    // fire-and-forget within the loop; sequenced via for..of below
                    // We push a task list instead so ordering is deterministic.
                    (persistUpload as any)._pending = (persistUpload as any)._pending || [];
                    for (const uploadEntry of ev as any[]) {
                      (persistUpload as any)._pending.push([ek, idx, uploadEntry]);
                    }
                  } else {
                    out[ek] = ev;
                  }
                }
                return out;
              });
              paramInserts.push({
                order_measurement_id: createdMeasurement.id,
                parameter_name: key,
                parameter_value: JSON.stringify(cleaned),
                unit: null,
              });
              continue;
            }

            if (typeof v === "string" && v.trim() === "") continue;

            const f = fields.find((x: any) => x.field_key === key);
            paramInserts.push({
              order_measurement_id: createdMeasurement.id,
              parameter_name: (f as any)?.display_name || key,
              parameter_value: typeof v === "boolean" ? (v ? "true" : "false") : String(v),
              unit: (f as any)?.unit || null,
            });
          }

          // Drain queued repeatable uploads
          const pending: Array<[string, number, any]> = (persistUpload as any)._pending || [];
          for (const [fk, idx, entry] of pending) await persistUpload(fk, idx, entry);
          (persistUpload as any)._pending = [];

          if (paramInserts.length > 0) {
            await api.measurementParameters.bulkInsert(paramInserts);
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
          <CardHeader><CardTitle className="text-base">{t("orders:kind_label")} *</CardTitle></CardHeader>
          <CardContent>
            <Select value={orderKind} onValueChange={(v) => setOrderKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="labor">{t("orders:kind.labor")}</SelectItem>
                <SelectItem value="pilot_plant">{t("orders:kind.pilot_plant")}</SelectItem>
                <SelectItem value="combined">{t("orders:kind.combined")}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {role !== "auftraggeber" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prozessvorlage (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={processTemplateId} onValueChange={setProcessTemplateId}>
              <SelectTrigger><SelectValue placeholder="Keine Vorlage – klassischer Auftrag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">– Keine Vorlage –</SelectItem>
                {(processTemplates as any[])
                  .filter((tpl) => {
                    if (orderKind === "pilot_plant") return tpl.kind === "pilot_plant";
                    if (orderKind === "labor") return tpl.kind === "labor";
                    return true;
                  })
                  .map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.kind === "pilot_plant" ? "· PP" : "· Labor"} · v{tpl.version}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Bei Auswahl wird ein Prozess­ablauf mit definierten Schritten erzeugt und dem
              Auftrag verknüpft.
            </p>
          </CardContent>
        </Card>
        )}


        {orderKind !== "pilot_plant" && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("orders:sample")} *</CardTitle></CardHeader>
            <CardContent>
              <SampleSelector value={selectedSampleId} onSelect={setSelectedSampleId} projectId={selectedProjectId || undefined} />
            </CardContent>
          </Card>
        )}

        {/* Dynamic, template-driven form for the selected Auftragsart.
            Fields, sections, labels and validations come exclusively from the
            configured template — never from code. */}
        <OrderKindDynamicForm
          orderKind={orderKind}
          values={dynamicValues}
          onChange={(patch) => setDynamicValues((prev) => ({ ...prev, ...patch }))}
          onTemplateResolved={setDynamicFormId}
        />

        {/* Legacy Pilot Plant Stammdaten — only rendered when no template is
            mapped for this order kind, to preserve backward compatibility. */}
        {(orderKind === "pilot_plant" || orderKind === "combined") && !dynamicFormId && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("orders:tabs.pilot_plant")}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div><Label>{t("orders:pp.experiment_number")}</Label>
                <Input value={pp.experiment_number} onChange={e => setPp({ ...pp, experiment_number: e.target.value })} />
              </div>
              <div><Label>{t("orders:pp.v2o5_percent")}</Label>
                <Input type="number" step="0.01" value={pp.v2o5_percent} onChange={e => setPp({ ...pp, v2o5_percent: e.target.value })} />
              </div>
              <div><Label>{t("orders:pp.experiment_date")}</Label>
                <Input type="date" value={pp.experiment_date} onChange={e => setPp({ ...pp, experiment_date: e.target.value })} />
              </div>
              <div><Label>{t("orders:pp.masse_type")}</Label>
                <Select value={pp.masse_type} onValueChange={(v) => setPp({ ...pp, masse_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">–</SelectItem>
                    {["DK","GK","KK","MK","PK"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("orders:pp.experiment_kind")}</Label>
                <Input value={pp.experiment_kind} onChange={e => setPp({ ...pp, experiment_kind: e.target.value })} />
              </div>
              <div><Label>{t("orders:pp.previous_experiments")}</Label>
                <Input value={pp.previous_experiments} onChange={e => setPp({ ...pp, previous_experiments: e.target.value })} />
              </div>
              <div className="md:col-span-2"><Label>{t("orders:pp.remarks")}</Label>
                <Textarea rows={2} value={pp.remarks} onChange={e => setPp({ ...pp, remarks: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        )}


        {(orderKind === "pilot_plant" || orderKind === "combined") && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("orders:analysis_requests.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{t("orders:analysis_requests.hint")}</p>
              <Select onValueChange={(sid) => {
                const svc = services.find(s => s.id === sid);
                if (!svc) return;
                setAnalysisRequests(prev => [...prev, { uid: newUid(), service_id: sid, service_name: svc.service_name, quantity: 1 }]);
              }}>
                <SelectTrigger><SelectValue placeholder={t("orders:analysis_requests.add")} /></SelectTrigger>
                <SelectContent>
                  {services.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>))}
                </SelectContent>
              </Select>
              {analysisRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("orders:analysis_requests.empty")}</p>
              ) : (
                <div className="space-y-1">
                  {analysisRequests.map(ar => (
                    <div key={ar.uid} className="flex items-center gap-2 p-2 border rounded-md">
                      <span className="flex-1 text-sm">{ar.service_name}</span>
                      <Input type="number" min={1} value={ar.quantity} onChange={(e) =>
                        setAnalysisRequests(prev => prev.map(x => x.uid === ar.uid ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))
                      } className="w-20 h-8" />
                      <Button type="button" variant="ghost" size="icon" onClick={() =>
                        setAnalysisRequests(prev => prev.filter(x => x.uid !== ar.uid))
                      }><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
            {servicePackages.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Servicepaket wählen (Prüfprogramm)</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {servicePackages.map((p: any) => (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyServicePackage(p.id)}
                      title={p.description || undefined}
                      className="h-auto py-1.5"
                    >
                      <PackageIcon className="h-3.5 w-3.5 mr-1.5" />
                      <span className="text-left">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground ml-1">({p.items.length})</span>
                      </span>
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enthaltene Dienstleistungen werden automatisch übernommen. Bereits enthaltene Positionen werden übersprungen.
                </p>
              </div>
            )}

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
                        <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">#{idx + 1}</span>
                          <span>{m.service_name}</span>
                          {m.source_package_name ? (
                            <Badge variant="secondary" className="font-normal">
                              <Layers className="h-3 w-3 mr-1" /> {m.source_package_name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-normal">manuell</Badge>
                          )}
                        </p>
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">{t("common:hours")}</Label>
                        <Input type="number" min={0.5} step={0.5} value={m.planned_hours} onChange={(e) => updateMeasurement(m.uid, "planned_hours", parseFloat(e.target.value) || 0)} className="h-8" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMeasurement(m.uid)} title={t("orders:duplicate", { defaultValue: "Duplizieren" })}><Copy className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMeasurement(m.uid)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <ServiceBookingOrLegacyParams
                      serviceId={m.service_id}
                      roleView={roleView}
                      formValues={measurementFormValues[m.uid] || {}}
                      onFormChange={(key, value) => updateFormValue(m.uid, key, value)}
                      paramValues={measurementParams[m.uid] || {}}
                      onParamChange={(paramId, value) => updateParam(m.uid, paramId, value)}
                      t={t}
                    />
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
