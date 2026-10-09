import { useEffect, useMemo, useRef, useState } from "react";
import { SpecChangeHistory, groupSpecChanges } from "@/components/order/SpecAmendment";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMeasurementAutosave, type AutosaveState } from "@/hooks/useMeasurementAutosave";
import { useRefreshGuard } from "@/lib/refreshGuard";
import { ProcessContextProvider } from "@/context/ProcessContextProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MeasurementContextProvider } from "@/components/curves/measurementContext";
import MeasurementCurvesCard from "@/components/curves/MeasurementCurvesCard";
import ServiceBookingForm from "@/components/ServiceBookingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { releaseRun } from "@/lib/measurementRun/leaveRun";
import ReassignMeasurementDialog from "@/components/measurementRun/ReassignMeasurementDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, CheckCircle2, ClipboardList } from "lucide-react";
import OrderUploadedFiles from "@/components/OrderUploadedFiles";
import RichText from "@/components/forms/RichText";
import ServiceLinkedForms, { linkedFormValueKey } from "@/components/ServiceLinkedForms";
import SampleGeometryCard from "@/components/geometry/SampleGeometryCard";
import { toast } from "sonner";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";
import { ORDER_PRIORITY_LABELS, type OrderPriority } from "@/lib/types";
import {
  buildLinkedFormResultCandidates,
  buildServiceResultCandidates,
  type OfficialResultCandidate,
} from "@/lib/officialResults";

/**
 * Task-focused execution view for a measurement (Messdienstleister workflow).
 *
 * Loads the Service-Designer form for the measurement's service, lets the
 * assigned technician fill it in, and on submit persists every filled field
 * to `measurement_results` (never to service parameters / form definition)
 * and marks the measurement as completed.
 */
function TaskExecutionPageInner() {
  const { measurementId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile, role, hasRole } = useAuth();

  // Im Messdurchlauf wird die Probe beim Wechsel immer frisch geladen: der
  // Zwischenspeicher könnte einen Stand vor dem letzten Autosave enthalten.
  const inRun = new URLSearchParams(window.location.search)
    .get("run")?.split(",").includes(measurementId ?? "") ?? false;
  const { data: measurement, isLoading, isFetchedAfterMount } = useQuery({
    queryKey: ["measurement-task", measurementId],
    queryFn: () => api.measurements.get(measurementId!),
    enabled: !!measurementId,
    ...(inRun ? { refetchOnMount: "always" as const } : {}),
  });
  const hydrationReady = !inRun || isFetchedAfterMount;

  const serviceId: string | undefined = (measurement as any)?.service_id;

  /**
   * Werte vorangegangener Workflow-Schritte des Auftrags. Grundlage für
   * Feldverknüpfungen und darauf aufbauende Berechnungen (kein zweiter
   * Speicherort – es wird die bestehende `shared_form_data` gelesen).
   */
  const orderId: string | undefined = (measurement as any)?.order_id;
  const { data: stepData = {} } = useQuery({
    queryKey: ["order-shared-form-data", orderId],
    queryFn: () => api.orderSharedFormData.get(orderId!),
    enabled: !!orderId,
  });

  /**
   * Wertquelle „Wert aus verknüpftem Formular": Werte der Globalen Formulare
   * anderer Dienstleistungen desselben Auftrags (und derselben Probe).
   * Rein lesend aus den bestehenden Messergebnissen – es entsteht kein
   * zweiter Speicherort und keine zusätzliche Zuordnungslogik.
   */
  const sampleId: string | undefined = (measurement as any)?.sample_id ?? undefined;
  const { data: linkedFormData = {} } = useQuery({
    queryKey: ["order-linked-form-values", orderId, sampleId, measurementId],
    queryFn: () => api.measurementResults.listFormValuesForOrder(orderId!, sampleId, measurementId),
    enabled: !!orderId,
  });

  /**
   * Strikte Rollentrennung: Der Messdienstleister sieht ausschließlich das
   * Messdienstleisterformular der Dienstleistung. Kein Fallback auf das
   * Auftraggeberformular und kein pauschales „Ergebnisformular".
   */
  // Doppelrolle Auftraggeber + Messdienstleister: reine Arbeitsansicht
  // umschaltbar. Berechtigungen (canEdit etc.) bleiben davon unberührt;
  // beide Ansichten arbeiten auf derselben Wertetasche.
  const canSwitchFormView = hasRole("auftraggeber") && hasRole("durchfuehrer");
  const [formView, setFormView] = useState<"customer" | "employee">("employee");
  const roleView: FormRoleView = canSwitchFormView ? formView : "employee";
  const { data: employeeLayout } = useQuery({
    queryKey: ["service-form-layout", serviceId, "employee"],
    queryFn: () => api.serviceFormLayouts.get(serviceId!, "employee"),
    enabled: !!serviceId,
  });

  const hasLayoutForm = !!employeeLayout?.layout?.sections?.length;

  // Mit der Dienstleistung verknüpftes Globales Formular (Ansicht
  // „Messdienstleister" wird im Formular selbst aufgelöst).
  const { data: linkedForms = [] } = useQuery({
    queryKey: ["service-form-links", serviceId],
    queryFn: () => api.serviceFormLinks.listForService(serviceId!),
    enabled: !!serviceId,
  });

  const hasForm = hasLayoutForm || linkedForms.length > 0;

  const [values, setValues] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  // Preload existing results into the form (so partial saves resume nicely).
  useEffect(() => {
    if (initialized || !measurement || !hydrationReady) return;
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
  }, [measurement, initialized, hydrationReady]);

  const canEdit = useMemo(() => {
    if (!measurement) return false;
    if (role === "master") return true;
    return (measurement as any).assigned_to === user?.id;
  }, [measurement, role, user]);

  const isCompleted = (measurement as any)?.status === "completed";

  // „Zuweisung ändern": nur Anzeige-Steuerung; die Datenbank prüft erneut.
  const [reassignOpen, setReassignOpen] = useState(false);
  const projectIdForRole = (measurement as any)?.measurement_orders?.project_id as string | undefined;
  const { data: myProjectRole = null } = useQuery({
    queryKey: ["my-project-role", projectIdForRole, user?.id],
    queryFn: () => api.measurements.myProjectRole(projectIdForRole!, user!.id),
    enabled: !!projectIdForRole && !!user && role !== "master",
  });
  const canReassign =
    !!measurement && !isCompleted &&
    (role === "master" ||
      (measurement as any).assigned_to === user?.id ||
      myProjectRole === "owner" || myProjectRole === "leader");

  /**
   * Ergebnis-Definition: NUR Felder/Berechnungen, die im Designer als
   * „offizielles Ergebnis" markiert sind, gelangen als Ergebnisspalte in die
   * Ergebnisdatenbank. Alle übrigen Werte werden weiterhin gespeichert
   * (Zwischenstand/Formularwerte), aber nicht als Ergebnis geführt.
   */
  const { data: serviceFields = [] } = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId!),
    enabled: !!serviceId,
  });

  const formIds = useMemo(
    () => (linkedForms as any[]).map((l) => l.form_definition_id as string),
    [linkedForms]
  );

  /** Felder + Berechnungen aller verknüpften Globalen Formulare. */
  const { data: linkedMeta } = useQuery({
    queryKey: ["task-result-meta", formIds],
    enabled: formIds.length > 0,
    queryFn: async () => {
      const out: Array<{ key: string; label: string; official: boolean }> = [];
      for (const fid of formIds) {
        const [fields, calcs] = await Promise.all([
          api.formFields.listForForm(fid),
          api.formCalculations.listForForm(fid),
        ]);
        for (const f of fields as any[]) {
          out.push({
            key: linkedFormValueKey(fid, f.field_key),
            label: (f.result_label || f.display_name || f.field_key) as string,
            official: !!f.is_result,
          });
        }
        for (const c of calcs as any[]) {
          out.push({
            key: linkedFormValueKey(fid, c.calc_key),
            label: (c.result_label || c.display_name || c.calc_key) as string,
            official: !!c.is_result,
          });
        }
      }
      return out;
    },
  });

  /** key → { label, official } für alle bekannten Felder/Berechnungen. */
  const resultMeta = useMemo(() => {
    const map = new Map<string, { label: string; official: boolean }>();
    for (const f of serviceFields as any[]) {
      map.set(f.field_key, {
        label: (f.result_label || f.display_name || f.field_key) as string,
        official: !!f.is_result,
      });
    }
    for (const m of linkedMeta ?? []) {
      map.set(m.key, { label: m.label, official: m.official });
    }
    return map;
  }, [serviceFields, linkedMeta]);



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

  /**
   * Stundenaufzeichnung am Ende der Dienstleistung nur bei F&E-Aufträgen:
   * Der Dialog zur tatsächlichen Messdauer wird ausschließlich geöffnet, wenn
   * der übergeordnete Auftrag den Typ „F&E-Auftrag" (rnd) hat. Bei allen
   * anderen Typen (oder wenn der Typ nicht ermittelt werden kann) wird die
   * Messung ohne Zeitangabe und ohne Dialog abgeschlossen – es wird kein
   * Stundenaufzeichnungsdatensatz (actual_duration_hours) erzeugt.
   */
  const isRndOrder =
    (measurement as any)?.measurement_orders?.order_type === "rnd";

  const handleCompleteClick = () => {
    if (isRndOrder) {
      openCompleteDialog();
      return;
    }
    void completeWithoutTimeLog();
  };

  const completeWithoutTimeLog = async () => {
    if (!measurementId) return;
    setSubmitting(true);
    try {
      await persist(true);
      // Nur Status setzen – bewusst kein actual_duration_hours schreiben.
      await api.measurements.updateStatus(measurementId, "completed");
      toast.success("Messung abgeschlossen und Ergebnisse gespeichert");
      qc.invalidateQueries({ queryKey: ["measurement-task", measurementId] });
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      afterComplete();
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const persistResults = async (
    requireOfficialCalculations = false,
    opts: { draftOnly?: boolean } = {},
  ) => {
    if (!measurementId) return;
    // Nach einer Neuzuweisung lehnt die Datenbank (RLS) Schreibzugriffe des
    // bisherigen Bearbeiters ohnehin ab; hier wird das zusätzlich erkannt und
    // als Fehler gemeldet, statt stillschweigend „gespeichert" anzuzeigen.
    if (role !== "master") {
      const [fresh] = await api.measurements.listRunStateByIds([measurementId]);
      if (!fresh || fresh.assigned_to !== user?.id) {
        throw new Error("Diese Aufgabe ist dir nicht mehr zugewiesen – Speichern nicht möglich.");
      }
    }
    // Immer den aktuellen Stand der gespeicherten Ergebnisse lesen: nach einem
    // Import direkt gefolgt vom Speichern wäre eine Momentaufnahme veraltet und
    // würde Ergebnisse doppelt anlegen.
    const existing = ((await api.measurementResults.list(measurementId)) ??
      (measurement as any).measurement_results ??
      []) as any[];
    const existingByName = new Map(existing.map((r) => [r.result_name, r]));
    const measuredAt = new Date().toISOString().slice(0, 10);


    // Fetch authoritative definitions at save time. Completion must never
    // depend on whether a metadata query or a calculation render effect has
    // already finished in the UI.
    const [freshServiceFields, linkedDefinitions, globalConstants] = await Promise.all([
      serviceId ? api.serviceDataFields.listForService(serviceId) : Promise.resolve([]),
      Promise.all(formIds.map(async (formId) => {
        const [fields, calculations] = await Promise.all([
          api.formFields.listForForm(formId),
          api.formCalculations.listForForm(formId),
        ]);
        return { formId, fields, calculations };
      })),
      api.globalFields.list().then((fields) => fields.filter((field) => field.data_source === "constant")),
    ]);

    const candidates = new Map<string, OfficialResultCandidate>();
    for (const candidate of buildServiceResultCandidates(freshServiceFields, values)) {
      candidates.set(candidate.key, candidate);
    }
    for (const definition of linkedDefinitions) {
      for (const candidate of buildLinkedFormResultCandidates(
        definition.formId,
        definition.fields,
        definition.calculations,
        values,
        globalConstants,
      )) {
        candidates.set(candidate.key, candidate);
      }
    }

    // Preserve values outside the currently known definitions (legacy data,
    // removed forms). They must not be deleted or declassified accidentally.
    for (const [key, raw] of Object.entries(values)) {
      if (candidates.has(key)) continue;
      const prev = existingByName.get(key);
      candidates.set(key, {
        key,
        label: prev?.display_label ?? resultMeta.get(key)?.label ?? key,
        value: raw,
        official: prev?.is_official === true,
        kind: "field",
      });
    }

    const invalidOfficialCalculation = [...candidates.values()].find((candidate) =>
      requireOfficialCalculations &&
      candidate.kind === "calculation" &&
      candidate.official &&
      (candidate.value == null || candidate.error)
    );
    if (invalidOfficialCalculation) {
      throw new Error(
        `Das offizielle Ergebnis „${invalidOfficialCalculation.label}“ konnte nicht berechnet werden${invalidOfficialCalculation.error ? `: ${invalidOfficialCalculation.error}` : "."}`
      );
    }

    /** Bereits gespeicherte Einheit erhalten, wenn die Definition keine liefert. */
    const prevUnit = (map: Map<string, any>, name: string): string | null =>
      ((map.get(name)?.unit as string | null) || "").trim() || null;

    const knownKeys = new Set(candidates.keys());
    const activeKeys = new Set<string>();

    for (const candidate of candidates.values()) {
      const { key, value: raw } = candidate;
      const isEmpty =
        raw == null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0);
      if (isEmpty) {
        const prev = existingByName.get(key);
        // A temporarily non-evaluable calculation must never erase an already
        // stored official result. On final completion it is rejected above;
        // during draft saves the last valid official value is retained.
        if (candidate.kind === "calculation" && candidate.official && prev?.is_official === true) {
          activeKeys.add(key);
        }
        continue;
      }
      const resultName = key;
      activeKeys.add(resultName);

      // Numeric single value → store in `value`; everything else → JSON in `remarks`.
      const payload: any = {
        result_name: resultName,
        display_label: candidate.label,
        // Einheit stammt aus der Felddefinition und bleibt ein eigenes Attribut.
        unit: (candidate.unit ?? "").trim() || prevUnit(existingByName, resultName),
        // Autosave (Messdurchlauf) erzeugt nie neue offizielle Ergebnisse:
        // bestehende Kennzeichnung bleibt, neue Zeilen sind nicht offiziell.
        is_official: opts.draftOnly
          ? existingByName.get(resultName)?.is_official === true
          : candidate.official,
        measured_by: user?.id ?? null,
        measured_at: measuredAt,
        value: null,
        remarks: null,
        // Zuordnung zur konkreten Messung (Messdatenblock). Ohne Block bleibt
        // die Zuordnung leer – bestehende Ergebnisse ändern sich dadurch nicht.
        instance_key: candidate.instanceKey ?? null,
        instance_label: candidate.instanceLabel ?? null,
        instance_context: candidate.instanceContext ?? {},
      };


      if (typeof raw === "string" || typeof raw === "number") {
        if (typeof raw === "number") {
          payload.value = raw;
        } else {
          // Zahlenwerte aus Messdatenimporten kommen auch in deutscher
          // Schreibweise („0,293“). Sie müssen als Zahl gespeichert werden,
          // sonst fehlen sie in der Ergebnisdatenbank.
          const text = raw.trim();
          const numeric = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)([eE][+-]?\d+)?$/.test(text);
          const num = numeric ? parseFloat(text.replace(",", ".")) : NaN;
          if (numeric && !isNaN(num)) payload.value = num;
          else payload.remarks = raw;
        }
      } else {
        payload.remarks = JSON.stringify(raw);
      }


      const prev = existingByName.get(resultName);
      if (prev) {
        await api.measurementResults.update(prev.id, payload);
      } else {
        await api.measurementResults.create({
          order_measurement_id: measurementId,
          ...payload,
        });
      }
    }

    // Delete only values belonging to a currently known definition that was
    // explicitly cleared. Unknown/historical official rows remain untouched.
    for (const r of existing) {
      if (knownKeys.has(r.result_name) && !activeKeys.has(r.result_name)) {
        await api.measurementResults.delete(r.id);
      }
    }
    // Regel-Aktion „Dienstleistung auslösen“: nachträgliche Wertänderungen
    // wirken auf den gespeicherten Auftrag (idempotent, ohne Duplikate).
    const orderIdForRules = (measurement as any)?.order_id;
    // Autosave löst keine Workflow-/Regelaktionen aus.
    if (orderIdForRules && !opts.draftOnly) {
      try {
        const r = await api.ruleTriggers.syncOrder(orderIdForRules);
        if (r.added > 0) toast.info(`${r.added} Dienstleistung(en) durch Regel im Auftrag ergänzt`);
        if (r.kept > 0) toast.warning("Ausgelöste Dienstleistung bleibt erhalten, da bereits bearbeitet");
      } catch (err) {
        console.warn("Regel-Auslöser konnten nicht abgeglichen werden", err);
      }
    }
  };

  // Im Messdurchlauf laufen alle Speichervorgänge strikt nacheinander und
  // jeweils mit dem neuesten Stand. Einzelaufruf: unverändert direkt.
  const persistRef = useRef(persistResults);
  persistRef.current = persistResults;
  const persistLock = useRef<Promise<unknown>>(Promise.resolve());
  const persist = (req = false, opts: { draftOnly?: boolean } = {}): Promise<void> => {
    if (!runModeRef.current) return persistResults(req, opts);
    const p = persistLock.current.then(
      () => persistRef.current(req, opts),
      () => persistRef.current(req, opts),
    );
    persistLock.current = p.catch(() => {});
    return p;
  };
  const runModeRef = useRef(false);
  runModeRef.current = new URLSearchParams(window.location.search).get("run")?.split(",").includes(measurementId ?? "") ?? false;

  /** Nach Abschluss: im Durchlauf zur nächsten offenen Probe, sonst wie bisher. */
  const afterComplete = () => {
    if (runModeRef.current) {
      const run = new URLSearchParams(window.location.search).get("run") || "";
      const ids = run.split(",").filter(Boolean);
      const idx = ids.indexOf(measurementId ?? "");
      const next = ids.slice(idx + 1).concat(ids.slice(0, idx))[0];
      qc.invalidateQueries({ queryKey: ["measurement-run-items"] });
      if (next) {
        navigate(`/aufgaben/${next}?run=${run}`);
        return;
      }
    }
    navigate("/auftraege");
  };

  /**
   * Ein Messabschluss ist nur zulässig, wenn alle Rohdatenimporte tatsächlich
   * gespeichert wurden. Fehlgeschlagene Rohdaten dürfen nie als erfolgreich
   * abgeschlossene Messung erscheinen.
   */
  const rawDataIncomplete = (): boolean =>
    Object.values(values).some((v) => {
      if (typeof v !== "string" || !v.startsWith("{")) return false;
      try {
        const j = JSON.parse(v);
        return !!j?.has_curves && !j?.raw_dataset_id;
      } catch {
        return false;
      }
    });

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
    if (rawDataIncomplete()) {
      toast.error("Rohdaten unvollständig", {
        description:
          "Der Rohdatenimport wurde nicht erfolgreich gespeichert. Bitte die Messdatei erneut importieren, bevor die Messung abgeschlossen wird.",
      });
      return;
    }
    setSubmitting(true);

    try {
      await persist(true);
      await api.measurements.complete(measurementId, dur, deviationReason);
      toast.success("Messung abgeschlossen und Ergebnisse gespeichert");
      qc.invalidateQueries({ queryKey: ["measurement-task", measurementId] });
      qc.invalidateQueries({ queryKey: ["measurement-results"] });
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      // Abschluss ändert Status in Auftrags-, Aufgaben- und Probenlisten.
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["my-measurements"] });
      qc.invalidateQueries({ queryKey: ["samples"] });
      qc.invalidateQueries({ queryKey: ["sample_measurements"] });
      setCompleteOpen(false);
      afterComplete();
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Direkt nach einem Messdatenimport werden die erkannten Ergebnisse sofort
   * über den bestehenden Ergebnispfad (`persistResults`) gespeichert. Dadurch
   * entsteht genau eine Datenquelle: dieselben Ergebnisse erscheinen im
   * Auftrag und in der Ergebnisdatenbank, ohne zusätzlichen Speichern-Klick.
   */
  const [persistRequest, setPersistRequest] = useState(0);
  const handledPersist = useRef(0);
  useEffect(() => {
    if (persistRequest === 0 || handledPersist.current === persistRequest) return;
    handledPersist.current = persistRequest;
    void (async () => {
      try {
        await persist();
        toast.success("Importierte Ergebnisse gespeichert");
        qc.invalidateQueries({ queryKey: ["measurement-task", measurementId] });
        qc.invalidateQueries({ queryKey: ["measurement-results"] });
        qc.invalidateQueries({ queryKey: ["results-database"] });
      } catch (err: any) {
        toast.error("Ergebnisse konnten nicht gespeichert werden", {
          description: err?.message,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistRequest, values]);

  const handleSaveDraft = async () => {
    setSubmitting(true);
    try {
      await persist();
      toast.success("Zwischenstand gespeichert");
      qc.invalidateQueries({ queryKey: ["measurement-task", measurementId] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Temporärer Messdurchlauf (?run=…) – reine Navigation, nichts wird persistiert ----
  const [searchParams] = useSearchParams();
  const runIds = useMemo(
    () => (searchParams.get("run") || "").split(",").map((s) => s.trim()).filter(Boolean),
    [searchParams]
  );
  const runMode = runIds.length > 0 && !!measurementId && runIds.includes(measurementId);
  const runParam = searchParams.get("run") || "";

  const autosave = useMeasurementAutosave({
    enabled: runMode && canEdit && !isCompleted && hasForm,
    ready: initialized,
    values,
    save: () => persist(false, { draftOnly: true }),
  });
  // „Ansicht aktualisieren": offenen Zwischenstand zuerst sichern; scheitert
  // das, wird nicht aktualisiert. Ohne Autosave bleiben die Eingaben im
  // Formular erhalten (Werte werden nur einmalig aus dem Server übernommen).
  useRefreshGuard(async () => {
    await autosave.flush();
    if (autosave.hasUnsaved()) throw new Error("unsaved");
  });

  const { data: runItems = [] } = useQuery({
    queryKey: ["measurement-run-items", runParam],
    queryFn: () => api.measurements.listByIds(runIds),
    enabled: runMode,
  });

  const goToRunMeasurement = async (id: string) => {
    if (id === measurementId) return;
    try {
      await autosave.flush();
    } catch (err: any) {
      toast.error("Zwischenstand konnte nicht gespeichert werden – Probe wird nicht gewechselt", {
        description: err?.message,
      });
      return;
    }
    qc.invalidateQueries({ queryKey: ["measurement-task", id] });
    navigate(`/aufgaben/${id}?run=${runParam}`);
  };

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  /** Schritt 1: Zwischenstand sichern; nur bei Erfolg Bestätigung anzeigen. */
  const requestLeaveRun = async () => {
    try {
      await autosave.flush();
    } catch (err: any) {
      toast.error("Zwischenstand konnte nicht gespeichert werden – Durchlauf wird nicht verlassen", {
        description: err?.message,
      });
      return;
    }
    setLeaveOpen(true);
  };

  /** Schritte 3–4: frischen Stand laden, eigene offene Aufgaben freigeben. */
  const confirmLeaveRun = async () => {
    if (!user?.id) return;
    setLeaving(true);
    try {
      await autosave.flush();
      const r = await releaseRun({
        runIds,
        userId: user.id,
        loadState: api.measurements.listRunStateByIds,
        release: api.measurements.release,
      });
      if (r.failed.length > 0) {
        toast.warning(`${r.failed.length} Aufgabe(n) konnten nicht freigegeben werden`, {
          description: "Sie bleiben Ihnen zugewiesen. Gespeicherte Zwischenstände sind erhalten.",
        });
      } else if (r.released.length > 0) {
        toast.success(`${r.released.length} Aufgabe(n) wieder freigegeben`);
      }
      qc.invalidateQueries();
      setLeaveOpen(false);
      navigate("/auftraege");
    } catch (err: any) {
      toast.error("Durchlauf konnte nicht verlassen werden", { description: err?.message });
    } finally {
      setLeaving(false);
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

  /** Priorität: gespeicherter Rang der Messung, sonst des Auftrags, sonst Auftragspriorität. */
  const rank: number | null = m.ranking ?? order?.ranking ?? null;
  const priorityLabel = rank
    ? `Prio ${rank}${order?.priority ? ` · ${ORDER_PRIORITY_LABELS[order.priority as OrderPriority] ?? order.priority}` : ""}`
    : order?.priority
      ? (ORDER_PRIORITY_LABELS[order.priority as OrderPriority] ?? String(order.priority))
      : "Keine Priorität";

  /** Fälligkeit: eigenes Datum der Messung, sonst des Auftrags – nie abgeleitet. */
  const dueRaw: string | null = m.due_date ?? order?.due_date ?? null;
  const dueLabel = dueRaw ? new Date(dueRaw).toLocaleDateString("de-AT") : "Keine Fälligkeit";

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
        <div className="flex items-center gap-2">
          {canReassign && (
            <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)}>
              Zuweisung ändern
            </Button>
          )}
          <StatusBadge status={m.status} />
        </div>
      </div>

      {canReassign && (
        <ReassignMeasurementDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          measurementId={measurementId!}
          serviceId={(m as any).service_id}
          currentAssignee={(m as any).assigned_to ?? null}
          onDone={() => qc.invalidateQueries({ queryKey: ["measurement-task", measurementId] })}
        />
      )}

      {runMode && (
        <RunNavigation
          ids={runIds}
          items={runItems as any[]}
          activeId={measurementId!}
          autosaveState={autosave.state}
          autosaveActive={canEdit && !isCompleted && hasForm}
          onSelect={goToRunMeasurement}
          onLeave={requestLeaveRun}
        />
      )}

      <AlertDialog open={leaveOpen} onOpenChange={(o) => !leaving && setLeaveOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Messdurchlauf verlassen?</AlertDialogTitle>
            <AlertDialogDescription>
              Nicht abgeschlossene Aufgaben werden wieder für andere qualifizierte Mitarbeiter freigegeben.
              Bereits gespeicherte Zwischenstände bleiben erhalten. Abgeschlossene Messungen bleiben abgeschlossen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Zurück</AlertDialogCancel>
            <AlertDialogAction
              disabled={leaving}
              onClick={(e) => { e.preventDefault(); confirmLeaveRun(); }}
            >
              Durchlauf verlassen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Auftragsdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Auftragsnummer</p>
            <p className="font-medium font-mono">{order?.order_number || "Keine Auftragsnummer"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Projektnummer</p>
            <p className="font-medium font-mono">{project?.project_number || "Kein Projekt"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Priorität</p>
            <p className="font-medium">{priorityLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Fälligkeit</p>
            <p className="font-medium">{dueLabel}</p>
          </div>
          <div className="col-span-2 md:col-span-4">
            <p className="text-muted-foreground text-xs">Anforderungen</p>
            <p className="font-medium whitespace-pre-wrap">
              {order?.notes?.trim() ? order.notes : "Keine Anforderungen hinterlegt"}
            </p>
          </div>
        </CardContent>
      </Card>

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

      {/* Arbeitsauftrag des Auftraggebers – schreibgeschützte Anzeige aller vom
          Auftraggeber im Bestellformular eingegebenen Werte und hochgeladenen Dateien. */}
      <CustomerOrderBriefingCard measurement={m} />




      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            Messdienstleisterformular
            {m.measurement_services?.service_name && (
              <span className="font-normal text-muted-foreground">
                – {m.measurement_services.service_name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MeasurementContextProvider
            value={
              m?.id
                ? {
                    orderMeasurementId: m.id,
                    sampleId: sample?.id ?? null,
                    serviceId: serviceId ?? null,
                    profileId: profile?.id ?? null,
                    persistResults:
                      canEdit && !isCompleted
                        ? () => setPersistRequest((n) => n + 1)
                        : undefined,
                  }
                : null
            }
          >
          {!serviceId ? (
            <p className="text-sm text-muted-foreground">Keine Dienstleistung verknüpft.</p>
          ) : !hasForm ? (
            <p className="text-sm text-muted-foreground">
              Für diese Dienstleistung ist kein Messdienstleisterformular hinterlegt.
              Bitte im Service- und Prozessdesigner ein Formular der Rolle
              „Messdienstleister" zuordnen.
            </p>
          ) : (
            <>
              {canSwitchFormView && (
                <Tabs value={formView} onValueChange={(v) => setFormView(v as "customer" | "employee")} className="mb-3">
                  <TabsList>
                    <TabsTrigger value="customer">Auftraggeber</TabsTrigger>
                    <TabsTrigger value="employee">Messdienstleister</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {(hasLayoutForm || roleView === "customer") && (
                <ServiceBookingForm
                  serviceId={serviceId}
                  roleView={roleView}
                  values={values}
                  onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
                />
              )}
              <ServiceLinkedForms
                serviceId={serviceId}
                context={roleView === "customer" ? "customer" : "employee"}
                stepData={stepData as any}
                formData={linkedFormData as any}
                values={values}
                onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
              />
            </>
          )}
          </MeasurementContextProvider>
        </CardContent>
      </Card>

      {/* Platten-Geometrie der Probe (BENCH NOx / BENCH SOx) – gemeinsam genutzt,
          getrennt von der bestehenden Wabenkörper-Geometrie. */}
      {sample?.id && (
        <SampleGeometryCard
          sampleId={sample.id}
          profileId={profile?.id ?? null}
          readOnly={!canEdit || isCompleted}
        />
      )}

      <MeasurementCurvesCard measurementId={m.id} readOnly={!canEdit || isCompleted} />

      {canEdit && hasForm && !isCompleted && (
        <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background/95 border-t py-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>
            Zwischenstand speichern
          </Button>
          <Button onClick={handleCompleteClick} disabled={submitting}>
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

/* -------------------------------------------------------------------------- */
/*  Arbeitsauftrag des Auftraggebers                                          */
/* -------------------------------------------------------------------------- */

function tryParseJSON(s: string): any {
  try {
    const p = JSON.parse(s);
    return p;
  } catch {
    return s;
  }
}

function formatScalar(v: any): string {
  if (v == null || v === "") return "–";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(", ") : "–";
  // Mehrfachauswahl wird als JSON-Array gespeichert
  const s = String(v);
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.length ? parsed.map((x) => String(x)).join(", ") : "–";
    } catch { /* Rohwert anzeigen */ }
  }
  return s;
}

function CustomerOrderBriefingCard({ measurement }: { measurement: any }) {
  const params: any[] = measurement.measurement_parameters ?? [];
  // Nur lesend: nachträgliche Änderungen der Auftraggeber-Vorgaben (activity_log).
  const { data: specEvents = [] } = useQuery({
    queryKey: ["spec-changes", measurement.id],
    queryFn: () => api.activityLog.listSpecChangesForMeasurement(measurement.id) as Promise<any[]>,
    enabled: !!measurement.id,
  });
  const specChanges = groupSpecChanges(specEvents as any[]);
  const orderNotes: string | null = measurement.measurement_orders?.notes ?? null;

  // Split scalar vs. repeatable parameters (repeatable are stored with parameter_name starting "repeat:")
  const scalars = params.filter((p) => !String(p.parameter_name).startsWith("repeat:"));
  const repeats = params.filter((p) => String(p.parameter_name).startsWith("repeat:"));

  const hasContent =
    scalars.length > 0 ||
    repeats.length > 0 ||
    (orderNotes && orderNotes.trim().length > 0) ||
    !!measurement.id;

  if (!hasContent) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Arbeitsauftrag des Auftraggebers
          <Badge variant="outline" className="text-[10px]">
            Angaben des Auftraggebers · schreibgeschützt
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {specChanges.size > 0 && (
          <div className="rounded border border-warning bg-warning/10 px-3 py-2 text-sm font-medium">
            Auftraggeber-Vorgabe nachträglich geändert – es gilt der unten angezeigte aktuelle Stand.
          </div>
        )}
        {orderNotes?.trim() ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Anmerkung zum Auftrag</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed"><RichText value={orderNotes} /></p>
          </div>
        ) : null}

        {scalars.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {scalars.map((p) => (
              <div key={p.id} className="text-sm border-b border-border/50 py-1">
                <span className="text-muted-foreground"><RichText value={p.parameter_name} />: </span>
                <span className="font-medium">
                  <RichText value={formatScalar(p.parameter_value)} />
                  {p.unit ? <> <RichText value={p.unit} /></> : ""}
                </span>
                {specChanges.get(p.id) && (
                  <div className="mt-1"><SpecChangeHistory changes={specChanges.get(p.id)!} title="Nachträglich geändert" /></div>
                )}
              </div>
            ))}
          </div>
        )}

        {repeats.map((p) => {
          const parsed = tryParseJSON(p.parameter_value);
          const rows: any[] = Array.isArray(parsed) ? parsed : [];
          const label = String(p.parameter_name).replace(/^repeat:/, "");
          return (
            <div key={p.id}>
              <p className="text-xs text-muted-foreground mb-1"><RichText value={label} /></p>
              {specChanges.get(p.id) && (
                <div className="mb-2"><SpecChangeHistory changes={specChanges.get(p.id)!} /></div>
              )}
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="rounded border border-border/60 bg-background/60 px-3 py-2 text-sm"
                  >
                    <p className="text-xs text-muted-foreground mb-1">#{i + 1}</p>
                    {row && typeof row === "object" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(row).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-muted-foreground"><RichText value={k} />: </span>
                            <span className="font-medium"><RichText value={formatScalar(v)} /></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span><RichText value={formatScalar(row)} /></span>
                    )}
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Keine Einträge</p>
                )}
              </div>
            </div>
          );
        })}

        {scalars.length === 0 && repeats.length === 0 && !orderNotes?.trim() && (
          <p className="text-sm text-muted-foreground italic">
            Der Auftraggeber hat keine zusätzlichen Angaben erfasst.
          </p>
        )}

        {/* Vom Auftraggeber hochgeladene Dateien (schreibgeschützt für Techniker) */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">Vom Auftraggeber bereitgestellte Dateien</p>
          <OrderUploadedFiles measurementId={measurement.id} canDelete={false} />
        </div>
      </CardContent>
    </Card>
  );
}


/**
 * Prozessmanager-Wrapper: stellt dem gesamten Formularbaum den aktuellen
 * Kontext (Auftrag, Probe, Projekt, Benutzer, Prozess) als schreibgeschützte
 * Systemvariablen bereit.
 */
export default function TaskExecutionPage() {
  const { measurementId } = useParams();
  const { data: measurement } = useQuery({
    queryKey: ["measurement-task", measurementId],
    queryFn: () => api.measurements.get(measurementId!),
    enabled: !!measurementId,
  });
  const order = (measurement as any)?.measurement_orders;
  return (
    <ProcessContextProvider
      orderId={order?.id ?? null}
      sampleId={order?.samples?.id ?? null}
      projectId={order?.projects?.id ?? null}
    >
      <TaskExecutionPageInner key={measurementId} />
    </ProcessContextProvider>
  );
}

/** Kompakte Navigation innerhalb des temporären Messdurchlaufs. */
function RunNavigation({
  ids, items, activeId, autosaveState, autosaveActive, onSelect, onLeave,
}: {
  ids: string[];
  items: any[];
  activeId: string;
  autosaveState: AutosaveState;
  autosaveActive: boolean;
  onSelect: (id: string) => void;
  onLeave: () => void;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const statusText: Record<AutosaveState, string> = {
    idle: "Automatisches Zwischenspeichern aktiv",
    pending: "Änderungen werden gleich gespeichert …",
    saving: "Wird gespeichert …",
    saved: "Zwischenstand gespeichert",
    error: "Speichern fehlgeschlagen – bitte erneut versuchen",
  };
  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
        <CardTitle className="text-sm">Messdurchlauf ({ids.length} Proben)</CardTitle>
        <div className="flex items-center gap-3">
          {autosaveActive && (
            <span className={`text-xs ${autosaveState === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {statusText[autosaveState]}
            </span>
          )}
          <button type="button" onClick={onLeave} className="text-xs text-primary hover:underline">Durchlauf verlassen</button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const it = byId.get(id);
          const active = id === activeId;
          const done = it?.status === "completed";
          const symbol = done ? "✓" : active ? "●" : "○";
          return (
            <Button
              key={id}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => onSelect(id)}
              title={it?.measurement_services?.service_name ?? ""}
            >
              <span className="mr-1">{symbol}</span>
              <span className="font-mono">{it?.samples?.sample_number || it?.measurement_number || "…"}</span>
              {it?.measurement_orders?.order_number && (
                <span className="ml-1 opacity-70">· {it.measurement_orders.order_number}</span>
              )}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
