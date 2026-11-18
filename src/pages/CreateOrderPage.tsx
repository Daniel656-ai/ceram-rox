import { useState, useMemo, useEffect, useRef } from "react";
import { billedForCreate } from "@/lib/orders/billing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { useCreateOrder } from "@/hooks/useOrders";
import { useServices, useAddOrderMeasurement } from "@/hooks/useMeasurements";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, AlertCircle, Zap, CheckCircle2, ClipboardList, Layers, Package as PackageIcon, ChevronsUpDown, Save, Loader2, CloudOff } from "lucide-react";
import SampleSelector from "@/components/SampleSelector";
import TemplateManager from "@/components/TemplateManager";
import OrderKindDynamicForm from "@/components/OrderKindDynamicForm";
import MeasurementRow from "@/components/order/MeasurementRow";
import ServiceTabsCard from "@/components/order/ServiceTabsCard";
import { nextActiveServiceTab, EMPTY_ACTIVE_TAB, type ActiveServiceTabState } from "@/lib/orderCreation/activeServiceTab";
import { useCustomerFormServices, planServiceTabs } from "@/lib/orderCreation/serviceFormMetadata";
import { planPilotServiceDeselection, removeDraftServices } from "@/lib/orderCreation/serviceDeselection";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import OrderDraftsPanel from "@/components/orders/OrderDraftsPanel";
import TemplateReviewPanel from "@/components/orders/TemplateReviewPanel";
import { useOrderDraftAutosave } from "@/hooks/useOrderDraftAutosave";
import { useRefreshGuard } from "@/lib/refreshGuard";
import { useOrderEditData } from "@/hooks/useOrderEditData";
import ExistingServicesReadOnly from "@/components/order/ExistingServicesReadOnly";
import { deriveLocks, diffOrderEdit, formStateFromOrder, serviceRemovalInfo, snapshotFromOrder, toggleServiceRemoval, validateServiceRemoval, type EditSnapshot } from "@/lib/orders/orderEdit";
import { isServiceField } from "@/lib/orderServiceSelection";
import { experimentNumberPatch as experimentNumberPatchForEdit } from "@/lib/orders/experimentNumber";
import type { OrderDraft, OrderDraftPayload } from "@/lib/api/orderDrafts";
import type { FormField } from "@/lib/api/formFields";
import { planServiceSync, readServiceSelectionEntries } from "@/lib/orderServiceSelection";
import { isProjectRequired } from "@/lib/orders/projectRequirement";
import { planRuleTriggers } from "@/lib/ruleEvaluation";
import { experimentNumberPatch } from "@/lib/orders/experimentNumber";
import { draftPositionEdited, hasDraftValue, missingDraftFiles, normalizeRestoredDraft } from "@/lib/orderDraftSafety";
import {
  createMeasurementTasks, payloadToFormState, persistOrderLevelData, runPostCreateSyncs,
  type SelectedMeasurement,
} from "@/lib/orders/createOrderFlow";



const newUid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;



export default function CreateOrderPage() {
  const { t } = useTranslation(["orders", "common"]);
  const navigate = useNavigate();
  // Bearbeiten-Modus: dieselbe Maske, geöffnet unter /auftraege/<id>/bearbeiten (Aufgabe 012).
  const { id: editOrderId } = useParams();
  const isEdit = !!editOrderId;
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewRates = hasPermission("costs.view_hourly_rates");
  // Auftragserstellung = Auftraggeber-Kontext, unabhängig davon, wer den Auftrag anlegt.
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  const { data: projects = [] } = useProjects();
  const { data: services = [], isSuccess: servicesReady } = useServices();
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
  const [isBilled, setIsBilled] = useState(false);
  const [priority, setPriority] = useState<string>("normal");
  const [orderKind, setOrderKind] = useState<"labor" | "pilot_plant">("labor");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [measurements, setMeasurements] = useState<SelectedMeasurement[]>([]);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [processTemplateId, setProcessTemplateId] = useState<string>("__none__");
  const [submitting, setSubmitting] = useState(false);
  const [measurementParams, setMeasurementParams] = useState<Record<string, Record<string, string>>>({});
  const [measurementFormValues, setMeasurementFormValues] = useState<Record<string, Record<string, any>>>({});
  // Aktiver Dienstleistungsreiter (Pilot Plant): zuletzt ausgewählte bzw.
  // bewusst angeklickte Position ist aktiv – niemals automatisch die erste.
  const [serviceTab, setServiceTab] = useState<ActiveServiceTabState>(EMPTY_ACTIVE_TAB);
  const pendingAddedUids = useRef<string[]>([]);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [pendingDeselection, setPendingDeselection] = useState<{ patch: Record<string, unknown>; uids: string[]; names: string[] } | null>(null);

  // Dynamic template-driven values keyed by field_key (loaded per order kind
  // from order_kind_form_templates). No hardcoded field list.
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});
  const [dynamicFormId, setDynamicFormId] = useState<string | null>(null);
  // Felder der Formularvorlage – daraus wird die Mehrfachauswahl
  // "Dienstleistungen" gelesen (keine feste Feldliste im Code).
  const [templateFields, setTemplateFields] = useState<FormField[]>([]);
  const [templateReadyKind, setTemplateReadyKind] = useState<string | null>(null);
  const reconcileAllowed = useRef(true);
  const templateReady = templateReadyKind === orderKind;
  const onTemplateReady = useMemo(() => (kind: string, ready: boolean) => setTemplateReadyKind(ready ? kind : null), []);

  // ---------------------------------------------------------------------
  // Entwürfe & Vorlagen (additiv, über Berechtigungen deaktivierbar)
  // ---------------------------------------------------------------------
  const [searchParams, setSearchParams] = useSearchParams();
  const draftsEnabled = hasPermission("orders.drafts.manage");
  const [draftId, setDraftId] = useState<string | null>(searchParams.get("draft"));
  const [loadedDraft, setLoadedDraft] = useState<OrderDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(!!searchParams.get("draft"));
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [closingDraft, setClosingDraft] = useState(false);
  const localCreatedId = useRef<string | null>(null);
  const [rulesReady, setRulesReady] = useState(false);

  const draftPayload: OrderDraftPayload = useMemo(() => ({
    selectedProjectId, orderType, orderKind, priority, dueDate, notes,
    measurements, selectedSampleIds, processTemplateId,
    measurementParams, measurementFormValues, dynamicValues, dynamicFormId,
    activeMeasurementUid: serviceTab.active, serviceTabOrder: serviceTab.order,
  }), [selectedProjectId, orderType, orderKind, priority, dueDate, notes, measurements,
       selectedSampleIds, processTemplateId, measurementParams,
       measurementFormValues, dynamicValues, dynamicFormId, serviceTab]);

  const draftTitle = useMemo(() => {
    const proj = (projects as any[]).find((p) => p.id === selectedProjectId);
    const base = proj ? `${proj.project_number}${proj.project_name ? " – " + proj.project_name : ""}` : "Neuer Auftrag";
    return loadedDraft?.source_label ? `Kopie von ${loadedDraft.source_label} · ${base}` : base;
  }, [projects, selectedProjectId, loadedDraft]);

  const hasDraftContent =
    !!selectedProjectId || measurements.length > 0 || selectedSampleIds.length > 0 ||
    !!notes || !!orderType || !!dueDate || hasDraftValue(dynamicValues);

  const urlDraftId = searchParams.get("draft");
  useEffect(() => { setPendingDeselection(null); }, [urlDraftId, orderKind, mode]);
  const draftHydrated = !urlDraftId || urlDraftId === localCreatedId.current || loadedDraft?.id === urlDraftId;
  const autosaveEnabled = draftsEnabled && !isEdit && mode === "single" && !draftLoading && draftHydrated && !draftLoadFailed && templateReady && servicesReady && (measurements.length === 0 || rulesReady);
  const autosave = useOrderDraftAutosave({
    enabled: autosaveEnabled,
    userId: user?.id,
    draftId,
    onDraftCreated: (id) => {
      localCreatedId.current = id;
      setDraftId(id);
      setSearchParams((previous) => { const next = new URLSearchParams(previous); next.set("draft", id); return next; }, { replace: true });
      queryClient.invalidateQueries({ queryKey: ["order-drafts"] });
    },
    payload: draftPayload,
    title: draftTitle,
    hasContent: hasDraftContent,
    restoredPayload: loadedDraft?.payload,
  });
  // „Ansicht aktualisieren": Entwurf vorher sichern; ohne Bestätigung abbrechen.
  useRefreshGuard(async () => {
    if (isEdit) return; // Bearbeiten: kein Entwurf, nur Speichern/Verwerfen
    if (!hasDraftContent) return;
    if (!autosaveEnabled) throw new Error("draft not ready");
    const id = await autosave.saveNow();
    if (!id) throw new Error("draft not saved");
  });

  // ---------------------------------------------------------------------
  // Bearbeiten-Modus: Maskenstand aus dem bestehenden Auftrag laden (derselbe Stand wie ein Entwurf)
  // ---------------------------------------------------------------------
  const editData = useOrderEditData(editOrderId);
  const locks = useMemo(() => deriveLocks(editData.facts), [editData.facts]);
  const editBaseline = useRef<EditSnapshot | null>(null);
  const [editHydrated, setEditHydrated] = useState(false);
  const [editReason, setEditReason] = useState("");
  // Stufe 3a: zum Entfernen vorgemerkte Dienstleistungen (service_id) – wirksam erst beim Speichern.
  const [removedServiceIds, setRemovedServiceIds] = useState<string[]>([]);
  const serviceInfos = useMemo(
    () => serviceRemovalInfo(editData.facts, editData.order?.order_measurements ?? []),
    [editData.facts, editData.order],
  );
  useEffect(() => {
    if (!isEdit || editHydrated || !editData.order || !editData.facts) return;
    const st = formStateFromOrder(editData.order);
    setSelectedProjectId(st.selectedProjectId);
    setOrderType(st.orderType);
    setOrderKind(st.orderKind);
    setPriority(st.priority);
    setDueDate(st.dueDate);
    setNotes(st.notes);
    setSelectedSampleIds(st.selectedSampleIds);
    setDynamicValues(st.dynamicValues);
    setDynamicFormId(st.dynamicFormId);
    setIsBilled(st.isBilled);
    editBaseline.current = snapshotFromOrder(editData.order);
    reconcileAllowed.current = false; // Dienstleistungen werden im Bearbeiten-Modus nicht automatisch abgeglichen
    setEditHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editHydrated, editData.order, editData.facts]);

  // Entwurf laden (?draft=<id>) – exakt an seinem bisherigen Stand.
  useEffect(() => {
    const id = searchParams.get("draft");
    if (!id) {
      setDraftLoading(false);
      if (loadedDraft) {
        setSelectedProjectId(""); setOrderType(""); setIsBilled(false); setOrderKind("labor"); setPriority("normal"); setDueDate(""); setNotes("");
        setMeasurements([]); setSelectedSampleIds([]); setProcessTemplateId("__none__");
        setMeasurementParams({}); setMeasurementFormValues({}); setDynamicValues({});
        reconcileAllowed.current = true;
      }
      setDraftId(null); setLoadedDraft(null);
      return;
    }
    if (id === localCreatedId.current) return;
    let cancelled = false;
    setDraftLoading(true);
    setDraftLoadFailed(false);
    reconcileAllowed.current = false;
    api.orderDrafts.get(id)
      .then((d) => {
        if (cancelled) return;
        if (!d) throw new Error("Entwurf nicht gefunden");
        const p = normalizeRestoredDraft(d.payload || {});
        const s = payloadToFormState(p);
        setSelectedProjectId(s.selectedProjectId);
        setOrderType(s.orderType);
        setOrderKind(s.orderKind);
        setPriority(s.priority);
        setDueDate(s.dueDate);
        setNotes(s.notes);
        setMeasurements(s.measurements);
        setSelectedSampleIds(s.selectedSampleIds);
        setProcessTemplateId(s.processTemplateId);
        setMeasurementParams(s.measurementParams);
        setMeasurementFormValues(s.measurementFormValues);
        setDynamicValues(s.dynamicValues);
        setDynamicFormId(s.dynamicFormId);
        // Zuletzt aktiver Reiter wird mit dem Entwurf wiederhergestellt.
        setServiceTab(s.serviceTab);
        setDraftId(d.id);
        setLoadedDraft({ ...d, payload: p });
      })
      .catch((e: any) => { if (!cancelled) { setDraftLoadFailed(true); toast.error("Entwurf konnte nicht geladen werden", { description: e.message }); } })
      .finally(() => { if (!cancelled) setDraftLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("draft")]);

  const handleSaveAndClose = async () => {
    if (closingDraft) return;
    setClosingDraft(true);
    try {
      const id = await autosave.saveNow();
      if (id) { toast.success("Entwurf gespeichert"); navigate("/auftraege"); }
      else toast.error("Entwurf konnte nicht gespeichert werden");
    } finally { setClosingDraft(false); }
  };
  const beforeDraftSwitch = async () => {
    if (!hasDraftContent || !autosave.dirty) return true;
    const saved = await autosave.saveNow();
    if (!saved) toast.error(t("orders:draftSafety.switchError"));
    return !!saved;
  };
  const startNewDraft = async () => {
    if (!await beforeDraftSwitch()) return;
    localCreatedId.current = null;
    setDraftId(null); setLoadedDraft(null); setDraftLoadFailed(false);
    setSelectedProjectId(""); setOrderType(""); setIsBilled(false); setOrderKind("labor"); setDueDate(""); setNotes("");
    setMeasurements([]); setSelectedSampleIds([]); setProcessTemplateId("__none__");
    setMeasurementParams({}); setMeasurementFormValues({}); setDynamicValues({});
    reconcileAllowed.current = true;
    setSearchParams({}, { replace: true });
  };


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
    const uid = newUid();
    pendingAddedUids.current.push(uid);
    setMeasurements((prev) => [
      ...prev,
      { uid, service_id: serviceId, service_name: svc.service_name, origin: "manual" },
    ]);
  };

  // ---------------------------------------------------------------------
  // Auswahl "Dienstleistungen" im Auftraggeberformular -> echte Positionen
  // ---------------------------------------------------------------------
  const measurementsRef = useRef(measurements);
  measurementsRef.current = measurements;
  const formValuesRef = useRef(measurementFormValues);
  formValuesRef.current = measurementFormValues;
  const [unresolvedSelection, setUnresolvedSelection] = useState<string[]>([]);

  const handleDynamicChange = (patch: Record<string, unknown>) => {
    if (isEdit) { setDynamicValues(prev => ({ ...prev, ...patch })); return; }
    if ((loadedDraft && !reconcileAllowed.current) || pendingDeselection) return;
    if (orderKind === "pilot_plant" && mode === "single") {
      const removal = planPilotServiceDeselection({ values: dynamicValues, patch, fields: templateFields, services, measurements });
      if (removal.names.length > 0) {
        setPendingDeselection({ patch, ...removal });
        return;
      }
    }
    setDynamicValues(prev => ({ ...prev, ...patch }));
  };

  const confirmServiceDeselection = () => {
    if (!pendingDeselection) return;
    const next = removeDraftServices(draftPayload, pendingDeselection.uids, pendingDeselection.patch);
    setMeasurements((next.measurements ?? []) as SelectedMeasurement[]);
    setMeasurementParams(next.measurementParams ?? {});
    setMeasurementFormValues(next.measurementFormValues ?? {});
    setDynamicValues(next.dynamicValues ?? {});
    setServiceTab({ active: next.activeMeasurementUid ?? null, order: next.serviceTabOrder ?? [] });
    pendingAddedUids.current = pendingAddedUids.current.filter(uid => !pendingDeselection.uids.includes(uid));
    setPendingDeselection(null);
  };

  /** Aktueller Abgleich Auswahl -> echte Positionen (eine einzige Quelle). */
  const buildServicePlan = (current: SelectedMeasurement[]) =>
    planServiceSync({
      selection: readServiceSelectionEntries(dynamicValues, templateFields as any, services as any),
      services: services as any,
      measurements: current,
      isEdited: (uid) => draftPositionEdited(draftPayload, uid),
      // Vor dem Speichern existiert noch keine Dienstleistung: Abwählen
      // entfernt die Position samt erfassten Eingaben aus dem Entwurf.
    });

  useEffect(() => {
    if (isEdit || draftLoading || draftLoadFailed || !templateReady || !servicesReady || !reconcileAllowed.current) return;
    const plan = buildServicePlan(measurementsRef.current);
    setUnresolvedSelection(plan.unresolved);
    if (plan.add.length === 0 && plan.remove.length === 0) return;

    const additions: SelectedMeasurement[] = plan.add.map((a) => ({
      uid: newUid(),
      service_id: a.service.id,
      service_name: a.service.service_name,
      origin: "template",
      selection_token: a.token,
    }));
    // Zuletzt über die Checkbox ausgewählte Dienstleistung wird aktiver Reiter.
    pendingAddedUids.current.push(...additions.map((a) => a.uid));
    setMeasurements((prev) => {
      const kept = prev.filter((m) => !plan.remove.includes(m.uid));
      return [...kept, ...additions];
    });
    if (plan.remove.length > 0) {
      // Nur der noch nicht gespeicherte Formularzustand wird geleert.
      setMeasurementFormValues((prev) => {
        const next = { ...prev };
        plan.remove.forEach((uid) => delete next[uid]);
        return next;
      });
      setMeasurementParams((prev) => {
        const next = { ...prev };
        plan.remove.forEach((uid) => delete next[uid]);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicValues, templateFields, services, draftLoading, templateReady, servicesReady]);

  // Aktiven Reiter nachführen: neu hinzugekommene Positionen aktivieren,
  // abgewählte aus der Reihenfolge entfernen, Fallback bei Abwahl des Aktiven.
  // Nur Dienstleistungen mit echtem Auftraggeberformular erhalten einen Reiter;
  // `measurements` selbst bleibt unverändert (reine Darstellungsfilterung).
  const customerFormStatus = useCustomerFormServices(
    measurements.map((m) => m.service_id),
    mode === "single" && orderKind === "pilot_plant",
  );
  const serviceTabPlan = planServiceTabs(measurements, customerFormStatus);
  const visibleTabKey = serviceTabPlan.visibleUids.join("|");
  const unresolvedTabKey = serviceTabPlan.unresolvedUids.join("|");
  useEffect(() => {
    const added = pendingAddedUids.current;
    // Neu hinzugefügte Positionen mit noch unbekannten Metadaten vormerken,
    // damit ihr Reiter nach dem Laden wie bisher aktiviert wird.
    pendingAddedUids.current = added.filter((u) => serviceTabPlan.unresolvedUids.includes(u));
    setServiceTab((prev) =>
      nextActiveServiceTab({ prev, visibleUids: serviceTabPlan.visibleUids, addedUids: added })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurements, visibleTabKey, unresolvedTabKey]);


  // ---------------------------------------------------------------------
  // Regel-Aktion „Dienstleistung auslösen“ (generisch, je Dienstleistung)
  // ---------------------------------------------------------------------
  const ruleServiceIds = useMemo(
    () => [...new Set(measurements.map((m) => m.service_id))].sort(),
    [measurements]
  );
  const { data: rulesByService = {}, isSuccess: ruleQueryReady } = useQuery({
    queryKey: ["service-rules-by-service", ruleServiceIds],
    queryFn: () => api.ruleTriggers.rulesByService(ruleServiceIds),
    enabled: ruleServiceIds.length > 0,
  });
  useEffect(() => { setRulesReady(ruleServiceIds.length === 0 || ruleQueryReady); }, [ruleQueryReady, ruleServiceIds.length]);
  const buildRulePlan = (current: SelectedMeasurement[], formVals: Record<string, Record<string, any>>) =>
    planRuleTriggers({
      sources: current.map((m) => ({ key: m.uid, service_id: m.service_id, sample_id: null, values: formVals[m.uid] ?? {} })),
      rulesByService,
      existing: current.map((m) => ({
        key: m.uid,
        service_id: m.service_id,
        sample_id: null,
        from_rule: m.origin === "rule",
        edited: draftPositionEdited({ measurementFormValues: formVals, measurementParams }, m.uid),
      })),
    });
  const ruleAdditions = (plan: ReturnType<typeof buildRulePlan>): SelectedMeasurement[] =>
    plan.add.flatMap((a) => {
      const svc = services.find((s) => s.id === a.target_service_id);
      if (!svc) return [];
      return [{
        uid: newUid(),
        service_id: svc.id,
        service_name: svc.service_name,
        origin: "rule" as const,
        rule_source_uid: a.source_key,
        rule_id: a.rule_id,
      }];
    });

  useEffect(() => {
    if (isEdit || draftLoading || !templateReady || !servicesReady || !ruleQueryReady || !reconcileAllowed.current) return;
    const plan = buildRulePlan(measurementsRef.current, formValuesRef.current);
    const additions = ruleAdditions(plan);
    if (additions.length === 0 && plan.remove.length === 0) return;
    setMeasurements((prev) => [...prev.filter((m) => !plan.remove.includes(m.uid)), ...additions]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementFormValues, measurements.length, rulesByService, services, draftLoading, templateReady, servicesReady, ruleQueryReady]);

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
          source_package_id: pkg.id,
          source_package_name: pkg.name,
        });
      }
      if (additions.length === 0) {
        toast.info(`Alle Dienstleistungen aus "${pkg.name}" sind bereits enthalten.`);
        return prev;
      }
      pendingAddedUids.current.push(...additions.map((a) => a.uid));
      toast.success(`${additions.length} Dienstleistung(en) aus "${pkg.name}" hinzugefügt`);
      return [...prev, ...additions];
    });
  };



  const handleApplyTemplate = (serviceIds: string[]) => {
    const newMeasurements: SelectedMeasurement[] = [];
    for (const sid of serviceIds) {
      const svc = services.find((s) => s.id === sid);
      if (svc) {
        newMeasurements.push({ uid: newUid(), service_id: sid, service_name: svc.service_name });
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

  /**
   * Papierkorb: endgültige Entfernung. Sind bereits Eingaben vorhanden,
   * nur nach ausdrücklicher Bestätigung des Datenverlusts.
   */
  const requestRemoveMeasurement = (uid: string) => {
    if (draftPositionEdited(draftPayload, uid)) setConfirmRemoveUid(uid);
    else removeMeasurement(uid);
  };

  const duplicateMeasurement = (uid: string) => {
    const newUidValue = newUid();
    pendingAddedUids.current.push(newUidValue);
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
    if (loadedDraft && !reconcileAllowed.current) return;
    // An unmounted Pilot-Plant form must not resurrect a confirmed removal.
    if (orderKind === "pilot_plant" && !measurementsRef.current.some(m => m.uid === uid)) return;
    setMeasurementFormValues((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), [key]: value } }));
  };

  // Projektbezogene Aufträge (F&E) benötigen ein Projekt; Kunden- und
  // Produktionsaufträge nicht. Keine Sonderlogik an anderer Stelle.
  const projectRequired = isProjectRequired(orderType);

  // Bearbeiten: Änderungen gegen den Ausgangsstand berechnen und atomar anwenden (Sperren prüft die Datenbank erneut).
  const { data: allSamplesForLabels = [] } = useSamples();
  const handleEditSubmit = async () => {
    if (!editOrderId || !editBaseline.current || !editData.facts) return;
    if (!orderType) { toast.error(t("orders:fill_required")); return; }
    if (projectRequired && !selectedProjectId) { toast.error(t("orders:select_project_error")); return; }
    if (orderKind !== "pilot_plant" && selectedSampleIds.length === 0) { toast.error(t("orders:fill_required")); return; }
    const diff = currentEditDiff();
    if (!diff || (!diff.changes && diff.billedChange === null && diff.addedServiceNames.length === 0)) { toast.info("Es gibt keine Änderungen zu speichern."); return; }
    if (measurements.length > 0 && (!servicesReady || !ruleQueryReady)) {
      toast.error("Dienstleistungen und Regeln werden noch geladen. Bitte einen Moment warten."); return;
    }
    const removalError = validateServiceRemoval(removedServiceIds, serviceInfos);
    if (removalError) { toast.error(removalError); return; }
    if (diff.reasonRequired && !editReason.trim()) {
      toast.error("Bitte eine Begründung für die Änderung angeben.", { description: diff.reasonWhy.join(", ") });
      return;
    }
    if (diff.reasonRequired && editReason.trim().length < diff.reasonMinLength) {
      toast.error(`Die Begründung muss mindestens ${diff.reasonMinLength} Zeichen lang sein.`, { description: diff.reasonWhy.join(", ") });
      return;
    }
    setSubmitting(true);
    try {
      if (diff.changes) await api.orders.applyChanges(editOrderId, diff.changes, editReason);
      if (diff.billedChange !== null) await api.orders.setBilled(editOrderId, diff.billedChange);

      // Stufe 3b: neue Dienstleistungen mit dem vorhandenen Erstellen-Ablauf anlegen (je Probe eine Aufgabe, Vorgaben,
      // Formularwerte, Dateien, Regeln). Nicht „ganz oder gar nicht“: bei einem Fehler wird klar gemeldet.
      let addError: string | null = null;
      if (measurements.length > 0 && user) {
        try {
          const effective: SelectedMeasurement[] = [...measurements];
          effective.push(...ruleAdditions(buildRulePlan(effective, measurementFormValues)));
          await createMeasurementTasks({
            order: { id: editOrderId }, user, effectiveMeasurements: effective, selectedSampleIds, dueDate,
            measurementParams, measurementFormValues, addMeasurement,
          });
          await runPostCreateSyncs(editOrderId);
          try {
            await api.orders.logServicesAdded(
              editOrderId, [...new Set(effective.map((m) => m.service_name))], effective.length * Math.max(1, selectedSampleIds.length),
            );
          } catch (logErr) { console.warn("Verlaufseintrag für hinzugefügte Dienstleistungen fehlgeschlagen", logErr); }
        } catch (err: any) {
          addError = err?.message ?? String(err);
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order", editOrderId] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["order-audit-log"] }),
        queryClient.invalidateQueries({ queryKey: ["order-activity", editOrderId] }),
        queryClient.invalidateQueries({ queryKey: ["sample-results-database"] }),
      ]);
      if (addError) {
        toast.error("Dienstleistungen nur teilweise angelegt", {
          description: `Die übrigen Änderungen wurden gespeichert, aber das Anlegen der neuen Dienstleistungen ist fehlgeschlagen (${addError}). Bitte die Aufgaben im Auftrag prüfen und Fehlendes erneut hinzufügen.`,
          duration: 20000,
        });
      } else {
        toast.success("Auftrag aktualisiert");
      }
      navigate(`/auftraege/${editOrderId}`);
    } catch (err: any) {
      toast.error("Änderungen konnten nicht gespeichert werden", { description: err.message });
    } finally { setSubmitting(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) { await handleEditSubmit(); return; }
    if (draftLoading || draftLoadFailed || !templateReady || !servicesReady || (measurements.length > 0 && !ruleQueryReady)) {
      toast.error("Formular wird noch geladen oder konnte nicht vollständig geladen werden"); return;
    }
    if (missingDraftFiles(draftPayload).length > 0 && JSON.stringify(draftPayload).includes("__draft_file_missing")) {
      toast.error("Bitte fehlende Dateianhänge erneut auswählen"); return;
    }
    const isPurePP = orderKind === "pilot_plant";
    // Labor requires sample + measurements. Pilot Plant / Combined may start without a sample; measurements optional for pure PP.
    if (!user || !orderType) {
      toast.error(t("orders:fill_required"));
      return;
    }
    if (!isPurePP && (measurements.length === 0 || selectedSampleIds.length === 0)) {
      toast.error(t("orders:fill_required"));
      return;
    }
    setSubmitting(true);
    try {
      // Projektzuordnung ist nur für projektbezogene Aufträge (F&E) verpflichtend.
      // Kunden- und Produktionsaufträge dürfen ohne Projekt gespeichert werden.
      const projectId = selectedProjectId || null;
      if (!projectId && projectRequired) { toast.error(t("orders:select_project_error")); setSubmitting(false); return; }

      const order = await createOrder.mutateAsync({
        project_id: projectId, order_type: orderType as any, created_by: user.id,
        is_billed: billedForCreate(orderType, isBilled),
        priority: priority as any,
        due_date: dueDate || undefined, notes: notes || undefined,
        sample_id: selectedSampleIds[0] || undefined,
        order_kind: orderKind,
        pp_issuer_user_id: orderKind === "pilot_plant" ? user.id : null,
        ...experimentNumberPatch(dynamicFormId ? templateFields : [], dynamicValues),
      });

      // Pilot-Plant-Bausteine, Auftragsformular, Prozessvorlage und Proben (Ablauf unverändert,
      // siehe src/lib/orders/createOrderFlow.ts).
      await persistOrderLevelData({
        order, user, orderKind, dynamicFormId, dynamicValues, processTemplateId,
        processTemplates: processTemplates as any[], projectId, selectedSampleIds,
      });

      // Sicherheitsnetz: Auswahl im Auftraggeberformular auch beim Speichern
      // abgleichen, falls der laufende Abgleich (z.B. direkt nach dem Laden
      // eines Entwurfs) noch nicht gegriffen hat. Gleiche Logik, keine zweite.
      const submitPlan = buildServicePlan(measurements);
      const effectiveMeasurements: SelectedMeasurement[] = [
        ...measurements,
        ...submitPlan.add.map((a) => ({
          uid: newUid(),
          service_id: a.service.id,
          service_name: a.service.service_name,
          origin: "template" as const,
          selection_token: a.token,
        })),
      ];
      effectiveMeasurements.push(...ruleAdditions(buildRulePlan(effectiveMeasurements, measurementFormValues)));
      if (submitPlan.unresolved.length > 0) {
        toast.warning("Nicht zugeordnete Auswahl", {
          description: `Ohne passende Dienstleistung: ${submitPlan.unresolved.join(", ")}`,
        });
      }

      // Je Probe und Dienstleistung entsteht eine eigene Aufgabe, damit
      // Ergebnisse eindeutig der jeweiligen Probe zugeordnet bleiben.
      await createMeasurementTasks({
        order, user, effectiveMeasurements, selectedSampleIds, dueDate,
        measurementParams, measurementFormValues, addMeasurement,
      });
      await runPostCreateSyncs(order.id);

      // Auftrag wurde eingereicht → Entwurf wird entfernt (kein Datenverlust,
      // die Daten leben ab jetzt im produktiven Auftrag).
      await autosave.discard();

      // Den endgültig gespeicherten Auftrag einschließlich der serverseitig
      // vergebenen Auftragsnummer vor dem Seitenwechsel in den Detail-Cache
      // übernehmen. Die Nummer wird hier ausschließlich gelesen, nie erzeugt.
      const persistedOrder = await api.orders.get(order.id);
      if (persistedOrder) {
        queryClient.setQueryData(["order", order.id], persistedOrder);
      }
      toast.success(t("orders:created_success"));
      navigate(`/auftraege/${order.id}`);
    } catch (err: any) {
      toast.error(t("orders:create_error"), { description: err.message });
    } finally { setSubmitting(false); }
  };

  const laborServices = services.filter((s) => s.category === "labor");
  // Aus der Auswahl im Auftraggeberformular entstandene Positionen vs.
  // zusätzlich gebuchte Dienstleistungen (gleiche Datenhaltung, nur Anzeige).
  const templateMeasurements = measurements.filter((m) => m.origin === "template");
  const extraMeasurements = measurements.filter((m) => m.origin !== "template");
  const pilotServices = services.filter((s) => s.category === "pilot_plant");

  const orderTypeLabels: Record<string, string> = {
    customer: t("common:order_type_customer"),
    production: t("common:order_type_production"),
    rnd: t("common:order_type_rnd"),
  };

  const priorityLabels: Record<string, string> = {
    niedrig: t("common:priority_low"),
    normal: t("common:priority_normal"),
    hoch: t("common:priority_high"),
    sehr_hoch: t("common:priority_very_high"),
  };

  const saveIndicator =
    autosave.state === "saving" ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Speichere Änderungen …
      </span>
    ) : autosave.state === "saved" ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Alle Änderungen gespeichert
      </span>
    ) : autosave.state === "error" ? (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <CloudOff className="h-3.5 w-3.5" /> Änderungen konnten nicht gespeichert werden
      </span>
    ) : autosave.state === "dirty" ? <span className="text-xs text-muted-foreground">{t("orders:draftSafety.unsaved")}</span> : null;

  // Zweispaltiger Dienstleistungsbereich nur für die Pilot-Plant-Einzelauftragserstellung.
  const pilotSingle = mode === "single" && orderKind === "pilot_plant" && !isEdit;

  // Felder des Auftragsformulars, die Dienstleistungen auslösen: im Bearbeiten-Modus gesperrt (Dienstleistungen
  // sind in dieser Stufe schreibgeschützt).
  const lockedTemplateKeys = isEdit
    ? templateFields.filter((f) => isServiceField(f as any, services as any)).map((f) => f.field_key)
    : undefined;

  // Vorschau (Bearbeiten-Modus): durch Regeln zusätzlich ausgelöste Dienstleistungen (nur Namen).
  const rulePreviewNames: string[] = isEdit && measurements.length > 0 && ruleQueryReady
    ? [...new Set(ruleAdditions(buildRulePlan(measurements, measurementFormValues)).map((a) => a.service_name))]
    : [];

  // Änderungen gegenüber dem Ausgangsstand (nur Bearbeiten-Modus).
  function currentEditDiff() {
    const base = editBaseline.current;
    if (!isEdit || !base || !editHydrated) return null;
    const exp = experimentNumberPatchForEdit(dynamicFormId ? templateFields : [], dynamicValues).pp_experiment_number;
    const cur: EditSnapshot = {
      orderType, projectId: selectedProjectId, priority, dueDate, notes,
      sampleIds: selectedSampleIds, templateFormId: base.templateFormId ?? dynamicFormId,
      templateValues: dynamicValues, isBilled,
    };
    return diffOrderEdit(base, cur, {
      started: locks.started,
      addServices: [...measurements.map((m) => ({ name: m.service_name })), ...rulePreviewNames.map((name) => ({ name }))],
      addSampleCount: selectedSampleIds.length,
      removeServices: serviceInfos
        .filter((i) => removedServiceIds.includes(i.serviceId))
        .map((i) => ({ id: i.serviceId, name: i.name, tasks: i.tasks.length })),
      experimentNumber: exp,
      expectedUpdatedAt: editData.facts?.updated_at,
      labels: {
        orderType: (v) => ({ customer: "Kunde", production: "Produktion", rnd: "F&E" } as Record<string, string>)[v] ?? v,
        project: (id) => {
          const p = (projects as any[]).find((x) => x.id === id);
          return p ? `${p.project_number}${p.project_name ? " – " + p.project_name : ""}` : "kein Projekt";
        },
        sample: (id) => (allSamplesForLabels as any[]).find((x) => x.id === id)?.sample_number ?? id,
        priority: (v) => ({ niedrig: "niedrig", normal: "normal", hoch: "hoch", sehr_hoch: "sehr hoch" } as Record<string, string>)[v] ?? v,
      },
    });
  }
  const editDiff = currentEditDiff();

  // Bearbeiten-Modus: Laden / keine Berechtigung (alle Hooks stehen oberhalb).
  if (isEdit && (editData.isLoading || (editData.order && editData.facts && !editHydrated))) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (isEdit && (editData.error || !editData.order || !editData.facts)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-3">
        <p className="text-lg font-medium">Auftrag nicht gefunden.</p>
        <p className="text-sm text-muted-foreground">{editData.error?.message || "Der Auftrag existiert nicht oder Sie haben keine Berechtigung."}</p>
        <Button variant="outline" onClick={() => navigate("/auftraege")}>Zur Auftragsübersicht</Button>
      </div>
    );
  }
  if (isEdit && !locks.canEdit) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-3">
        <p className="text-lg font-medium">Dieser Auftrag kann nicht bearbeitet werden.</p>
        <p className="text-sm text-muted-foreground">{locks.blockedReason}</p>
        <Button variant="outline" onClick={() => navigate(`/auftraege/${editOrderId}`)}>Zurück zum Auftrag</Button>
      </div>
    );
  }

  return (
    <div className={pilotSingle ? "space-y-6 max-w-none" : "space-y-6 max-w-3xl"}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? `Auftrag ${editData.facts?.order_number ?? ""} bearbeiten` : t("orders:create_title")}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Gleiche Maske wie beim Erstellen. 🔒 = gesperrt, weil bereits in Bearbeitung. Änderungen werden protokolliert." : t("orders:create_subtitle")}
          </p>
        </div>
        {!isEdit && mode === "single" && draftsEnabled && saveIndicator}
      </div>

      {!isEdit && mode === "single" && <OrderDraftsPanel activeDraftId={draftId} beforeSwitch={beforeDraftSwitch} onNew={startNewDraft} />}
      {!isEdit && mode === "single" && missingDraftFiles(draftPayload).length > 0 && (
        <p role="status" className="text-sm text-destructive">{t("orders:draftSafety.files", { names: missingDraftFiles(draftPayload).join(", ") })}</p>
      )}

      {mode === "single" && loadedDraft?.source_label && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <p className="text-sm">
            Dieser Auftrag wurde aus einer Vorlage erstellt (<strong>{loadedDraft.source_label}</strong>).
            Bitte prüfen Sie die übernommenen Angaben. Alle Inhalte sind vollständig editierbar.
          </p>
        </div>
      )}


      {/* Mode toggle (nicht im Bearbeiten-Modus) */}
      {!isEdit && <div className="flex gap-2">
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
      </div>}

      {mode === "single" ? (
      <form onSubmit={handleSubmit} onChangeCapture={() => { reconcileAllowed.current = true; }} onPointerDownCapture={() => { if (!draftLoading && templateReady) reconcileAllowed.current = true; }}>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("orders:order_details")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("orders:order_type")} *</Label>
              <Select value={orderType} onValueChange={setOrderType} disabled={isEdit && locks.typeLocked}>
                <SelectTrigger><SelectValue placeholder={t("orders:choose_type")} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(orderTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
              {isEdit && locks.typeLocked && (
                <p className="mt-1 text-xs text-muted-foreground">🔒 Gesperrt: Am Auftrag wurde bereits gearbeitet.</p>
              )}
              {isEdit && !locks.typeLocked && orderType !== editBaseline.current?.orderType && (
                <p className="mt-1 text-xs text-amber-700">
                  Folgen: F&amp;E braucht ein Projekt; das Verrechnet-Kennzeichen gilt nur für Kundenaufträge. Begründung erforderlich.
                </p>
              )}
            </div>
            {orderType === "customer" && (
              <div>
                <Label>{t("orders:billing.billed")}</Label>
                <Select value={isBilled ? "yes" : "no"} onValueChange={(v) => setIsBilled(v === "yes")}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">{t("orders:billing.no")}</SelectItem>
                    <SelectItem value="yes">{t("orders:billing.yes")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t("orders:kind_label")} *</Label>
              <Select
                value={orderKind}
                disabled={isEdit}
                onValueChange={(v) => {
                  const next = v as "labor" | "pilot_plant";
                  setOrderKind(next);
                  if (next === "labor") {
                    // Laborauftrag: nur Labor-Dienstleistungen zulässig
                    const laborIds = new Set(laborServices.map((s) => s.id));
                    setMeasurements((prev) => prev.filter((m) => laborIds.has(m.service_id)));
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">{t("orders:kind.labor")}</SelectItem>
                  <SelectItem value="pilot_plant">{t("orders:kind.pilot_plant")}</SelectItem>
                </SelectContent>
              </Select>
              {isEdit && <p className="mt-1 text-xs text-muted-foreground">🔒 Die Auftragsart kann nicht geändert werden.</p>}
            </div>
            {orderKind !== "pilot_plant" && (
              <div>
                <Label>{t("orders:sample")} *</Label>
                <SampleSelector values={selectedSampleIds} onValuesChange={setSelectedSampleIds} projectId={selectedProjectId || undefined} projectRequired={projectRequired} lockedValues={isEdit ? [...locks.lockedSampleIds] : undefined} />
                {isEdit && <p className="mt-1 text-xs text-muted-foreground">Proben mit Aufgaben (🔒) bleiben zugeordnet. Für neu hinzugefügte Proben werden in dieser Version noch keine Aufgaben angelegt.</p>}
              </div>
            )}
            <div>
              <Label>
                {t("common:project")} {projectRequired ? "*" : <span className="text-muted-foreground font-normal">({t("orders:project_optional")})</span>}
              </Label>
              <Select value={selectedProjectId || "__none__"} disabled={isEdit && locks.projectLocked} onValueChange={(v) => setSelectedProjectId(v === "__none__" ? "" : v)}>
                <SelectTrigger aria-label={t("orders:select_project")}><SelectValue placeholder={t("orders:choose_project")} /></SelectTrigger>
                <SelectContent>
                  {!projectRequired && <SelectItem value="__none__">{t("orders:no_project")}</SelectItem>}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.project_number} {p.project_name ? `– ${p.project_name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!projectRequired && (
                <p className="text-xs text-muted-foreground mt-1">{t("orders:project_optional_hint")}</p>
              )}
              {isEdit && locks.projectLocked && (
                <p className="mt-1 text-xs text-muted-foreground">🔒 Gesperrt: Am Auftrag wurde bereits gearbeitet.</p>
              )}
            </div>
            <div>
              <Label>{t("orders:priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("orders:due_date")}</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><Label>{t("orders:notes")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("orders:notes_placeholder")} rows={3} /></div>
          </CardContent>
        </Card>

      <div className={pilotSingle ? "space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start" : "space-y-6"}>
      <div className="space-y-6 min-w-0">
        {/* Dynamic, template-driven form for the selected Auftragsart.
            Fields, sections, labels and validations come exclusively from the
            configured template — never from code. */}
        <OrderKindDynamicForm
          orderKind={orderKind}
          values={dynamicValues}
          onChange={handleDynamicChange}
          onTemplateResolved={setDynamicFormId}
          onFieldsResolved={setTemplateFields}
          onReady={onTemplateReady}
          lockedFieldKeys={lockedTemplateKeys}
        />

        {/* Die im Auftraggeberformular ausgewählten Dienstleistungen erscheinen
            sofort mit ihrem bestehenden Auftraggeberformular – noch ohne
            Speicherung. Erst „Auftrag erstellen“ legt sie dauerhaft an. */}
        {/* Pilot Plant: die Formulare erscheinen als Reiter im rechten Bereich;
            hier nur noch der Hinweis auf nicht aufgelöste Auswahlen. */}
        {((!pilotSingle && templateMeasurements.length > 0) || unresolvedSelection.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ausgewählte Dienstleistungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!pilotSingle && templateMeasurements.map((m, idx) => (
                <MeasurementRow
                  key={m.uid}
                  m={m}
                  index={idx}
                  t={t}
                  formValues={measurementFormValues[m.uid] || {}}
                  onFormChange={(key, value) => updateFormValue(m.uid, key, value)}
                  onDuplicate={() => duplicateMeasurement(m.uid)}
                  onRemove={() => requestRemoveMeasurement(m.uid)}
                />
              ))}
              {unresolvedSelection.length > 0 && (
                <p className="text-xs text-amber-700">
                  Keine passende Dienstleistung hinterlegt für: {unresolvedSelection.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        )}








        {isEdit && (
          <ExistingServicesReadOnly
            measurements={editData.order?.order_measurements ?? []}
            facts={editData.facts}
            canAmend={locks.canEdit}
            removedServiceIds={removedServiceIds}
            onToggleRemove={(id) => setRemovedServiceIds((cur) => toggleServiceRemoval(cur, id, serviceInfos))}
            onAmended={() => { void editData.refetchOrder?.(); queryClient.invalidateQueries({ queryKey: ["order"] }); queryClient.invalidateQueries({ queryKey: ["order-activity", editOrderId] }); }}
          />
        )}
        {(!isEdit || locks.canEdit) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{isEdit ? "Dienstleistungen hinzufügen" : t("orders:measurements_section")}</CardTitle>
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
              <Label>
                {templateMeasurements.length > 0 || orderKind === "pilot_plant"
                  ? "Zusätzliche Dienstleistungen"
                  : t("orders:add_measurement")}
              </Label>
              <Popover open={servicePickerOpen} onOpenChange={setServicePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={servicePickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate text-muted-foreground">{t("orders:select_service")}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
                    <CommandInput placeholder={t("orders:search_service", { defaultValue: "Dienstleistung suchen…" })} />
                    <CommandList>
                      <CommandEmpty>{t("orders:no_service_found", { defaultValue: "Keine Dienstleistung gefunden." })}</CommandEmpty>
                      {laborServices.length > 0 && (
                        <CommandGroup heading={t("orders:header_lab", { defaultValue: "Lab" })}>
                          {laborServices.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.service_name} ${s.category ?? ""}`}
                              onSelect={() => { addService(s.id); setServicePickerOpen(false); }}
                            >
                              <span className="truncate">{s.service_name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {orderKind === "pilot_plant" && pilotServices.length > 0 && (
                        <CommandGroup heading={t("orders:header_pilot", { defaultValue: "Pilot Plant" })}>
                          {pilotServices.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.service_name} ${s.category ?? ""}`}
                              onSelect={() => { addService(s.id); setServicePickerOpen(false); }}
                            >
                              <span className="truncate">{s.service_name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("orders:duplicate_hint", { defaultValue: "Dieselbe Dienstleistung kann mehrfach hinzugefügt werden – jede Position ist unabhängig." })}
              </p>
            </div>

            {isEdit && measurements.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Neue Dienstleistungen werden beim Speichern für alle {selectedSampleIds.length || 1} Proben des Auftrags angelegt
                (je Probe eine Aufgabe), wie beim Erstellen.
                {rulePreviewNames.length > 0 && ` Durch Regeln zusätzlich ausgelöst (sofern noch nicht vorhanden): ${rulePreviewNames.join(", ")}.`}
              </p>
            )}
            {measurements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isEdit ? "Keine neue Dienstleistung ausgewählt." : t("orders:no_measurements_hint")}</p>
            ) : pilotSingle ? null : (
              <div className="space-y-3">
                {extraMeasurements.map((m, idx) => (
                  <MeasurementRow
                    key={m.uid}
                    m={m}
                    index={templateMeasurements.length + idx}
                    t={t}
                    formValues={measurementFormValues[m.uid] || {}}
                    onFormChange={(key, value) => updateFormValue(m.uid, key, value)}
                    onDuplicate={() => duplicateMeasurement(m.uid)}
                    onRemove={() => requestRemoveMeasurement(m.uid)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {!isEdit && role !== "auftraggeber" && measurements.length > 0 && (
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

        {loadedDraft?.template_baseline && (
          <TemplateReviewPanel
            baseline={loadedDraft.template_baseline}
            current={draftPayload}
            sourceLabel={loadedDraft.source_label}
            serviceCount={measurements.length}
            sampleCount={selectedSampleIds.length}
            requiresSamples={orderKind !== "pilot_plant"}
          />
        )}

        {isEdit && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Was wird geändert?</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editDiff && editDiff.lines.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {editDiff.lines.map((l, i) => (<li key={i}>{l}</li>))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Änderungen.</p>
              )}
              <div>
                <Label htmlFor="edit-reason">
                  Grund der Änderung {editDiff?.reasonRequired ? "*" : <span className="font-normal text-muted-foreground">(optional)</span>}
                </Label>
                <Textarea
                  id="edit-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={2}
                  placeholder="z. B. falsch angelegt, Projekt gewechselt …"
                  aria-required={!!editDiff?.reasonRequired}
                />
                {editDiff?.reasonRequired && (
                  <p className="mt-1 text-xs text-amber-700">Begründung erforderlich: {editDiff.reasonWhy.join(", ")}.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 flex-wrap items-center">
          <Button type="submit" disabled={submitting || (isEdit && (!editDiff || editDiff.lines.length === 0))}>
            {isEdit ? (submitting ? "Speichere …" : "Änderungen speichern") : submitting ? t("orders:submitting") : t("orders:submit_order")}
          </Button>
          {!isEdit && draftsEnabled && (
            <Button type="button" variant="secondary" onClick={handleSaveAndClose} disabled={!autosaveEnabled || closingDraft || submitting}>
              <Save className="h-4 w-4 mr-2" /> Entwurf speichern &amp; schließen
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => (isEdit ? navigate(`/auftraege/${editOrderId}`) : navigate(-1))}>
            {isEdit ? "Änderungen verwerfen" : t("common:cancel")}
          </Button>
          {!isEdit && draftsEnabled && saveIndicator}
        </div>
      </div>

      {pilotSingle && (
        <div className="min-w-0">
          <ServiceTabsCard
            measurements={serviceTabPlan.tabs}
            allMeasurements={measurements}
            activeUid={serviceTab.active}
            onActivate={(uid) => setServiceTab((prev) => nextActiveServiceTab({ prev, visibleUids: serviceTabPlan.visibleUids, clickedUid: uid }))}
            formValues={measurementFormValues}
            onFormChange={updateFormValue}
            onDuplicate={duplicateMeasurement}
            onRemove={requestRemoveMeasurement}
            t={t}
          />
        </div>
      )}
      </div>
      </div>

      <AlertDialog open={!!pendingDeselection} onOpenChange={(open) => { if (!open) setPendingDeselection(null); }}>
        <AlertDialogContent className="overflow-x-hidden">
          <AlertDialogHeader className="static m-0 min-w-0 shrink-0 p-0">
            <AlertDialogTitle>{t("orders:serviceTabs.deselectTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-normal break-words">
              {t("orders:serviceTabs.deselectWarning", { name: pendingDeselection?.names.join(", ") ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="static m-0 shrink-0 p-0">
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmServiceDeselection}>{t("orders:serviceTabs.deselectConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sicherheitsabfrage: endgültiges Löschen einer bearbeiteten Position. */}
      <AlertDialog open={!!confirmRemoveUid} onOpenChange={(open) => { if (!open) setConfirmRemoveUid(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders:serviceTabs.removeTitle", { defaultValue: "Dienstleistung endgültig entfernen?" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orders:serviceTabs.removeWarning", {
                defaultValue: "Zu dieser Dienstleistung wurden bereits Eingaben erfasst. Das Entfernen löscht alle ihre Eingaben endgültig und unwiderruflich.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmRemoveUid) removeMeasurement(confirmRemoveUid); setConfirmRemoveUid(null); }}
            >
              {t("orders:serviceTabs.removeConfirm", { defaultValue: "Endgültig löschen" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
