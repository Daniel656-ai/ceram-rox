import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProcessContextProvider } from "@/context/ProcessContextProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MeasurementContextProvider } from "@/components/curves/measurementContext";
import MeasurementCurvesCard from "@/components/curves/MeasurementCurvesCard";
import ServiceBookingForm from "@/components/ServiceBookingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, CheckCircle2, ClipboardList } from "lucide-react";
import OrderUploadedFiles from "@/components/OrderUploadedFiles";
import ServiceLinkedForms, { linkedFormValueKey } from "@/components/ServiceLinkedForms";
import { toast } from "sonner";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";
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
  const { user, profile, role } = useAuth();

  const { data: measurement, isLoading } = useQuery({
    queryKey: ["measurement-task", measurementId],
    queryFn: () => api.measurements.get(measurementId!),
    enabled: !!measurementId,
  });

  const serviceId: string | undefined = (measurement as any)?.service_id;

  /**
   * Strikte Rollentrennung: Der Messdienstleister sieht ausschließlich das
   * Messdienstleisterformular der Dienstleistung. Kein Fallback auf das
   * Auftraggeberformular und kein pauschales „Ergebnisformular".
   */
  const roleView: FormRoleView = "employee";
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

  const persistResults = async (requireOfficialCalculations = false) => {
    if (!measurementId) return;
    const existing = ((measurement as any).measurement_results ?? []) as any[];
    const existingByName = new Map(existing.map((r) => [r.result_name, r]));
    const measuredAt = new Date().toISOString().slice(0, 10);

    // Fetch authoritative definitions at save time. Completion must never
    // depend on whether a metadata query or a calculation render effect has
    // already finished in the UI.
    const [freshServiceFields, linkedDefinitions] = await Promise.all([
      serviceId ? api.serviceDataFields.listForService(serviceId) : Promise.resolve([]),
      Promise.all(formIds.map(async (formId) => {
        const [fields, calculations] = await Promise.all([
          api.formFields.listForForm(formId),
          api.formCalculations.listForForm(formId),
        ]);
        return { formId, fields, calculations };
      })),
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
        is_official: candidate.official,
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
        const num = typeof raw === "number" ? raw : parseFloat(raw);
        if (typeof raw === "number" || (!isNaN(num) && String(num) === String(raw).trim())) {
          payload.value = num;
        } else {
          payload.remarks = String(raw);
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
      await persistResults(true);
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
              {hasLayoutForm && (
                <ServiceBookingForm
                  serviceId={serviceId}
                  roleView={roleView}
                  values={values}
                  onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
                />
              )}
              <ServiceLinkedForms
                serviceId={serviceId}
                context="employee"
                values={values}
                onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
              />
            </>
          )}
          </MeasurementContextProvider>
        </CardContent>
      </Card>

      <MeasurementCurvesCard measurementId={m.id} readOnly={!canEdit || isCompleted} />

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
        {orderNotes?.trim() ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Anmerkung zum Auftrag</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{orderNotes}</p>
          </div>
        ) : null}

        {scalars.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {scalars.map((p) => (
              <div key={p.id} className="text-sm border-b border-border/50 py-1">
                <span className="text-muted-foreground">{p.parameter_name}: </span>
                <span className="font-medium">
                  {formatScalar(p.parameter_value)}
                  {p.unit ? ` ${p.unit}` : ""}
                </span>
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
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
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
                            <span className="text-muted-foreground">{k}: </span>
                            <span className="font-medium">{formatScalar(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>{formatScalar(row)}</span>
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
      <TaskExecutionPageInner />
    </ProcessContextProvider>
  );
}
