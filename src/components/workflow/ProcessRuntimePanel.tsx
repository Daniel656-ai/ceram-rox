import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormField } from "@/lib/api/formFields";
import type { OrderStepRun } from "@/lib/api/orderStepRuns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Circle, Clock, Lock, PlayCircle, Loader2, Info, Factory } from "lucide-react";
import { toast } from "sonner";
import { evaluateFormula } from "@/lib/formulaEngine";
import { useSystemVariables } from "@/context/ProcessContextProvider";
import { PilotPlantGuidedStepper } from "./PilotPlantGuidedStepper";
import { StepMaterialAvailability, useStepStartBlocked } from "./StepMaterialAvailability";
import RawMaterialRecipeField from "@/components/RawMaterialRecipeField";
import RawMaterialSelectField from "@/components/RawMaterialSelectField";

interface Props {
  /** Legacy measurement_orders.id — used to locate the linked order_instance. */
  legacyOrderId: string;
  /** Fallback: pass the instance id directly, skipping the lookup. */
  orderInstanceId?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Offen",
  in_progress: "In Bearbeitung",
  completed: "Erledigt",
  skipped: "Übersprungen",
  blocked: "Blockiert",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-amber-600" />;
  if (status === "blocked") return <Lock className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export function ProcessRuntimePanel({ legacyOrderId, orderInstanceId }: Props) {
  const qc = useQueryClient();

  const { data: instance, isLoading: loadingInstance } = useQuery({
    queryKey: ["order-instance", orderInstanceId ?? legacyOrderId],
    queryFn: () =>
      orderInstanceId
        ? api.orderInstances.get(orderInstanceId)
        : api.orderInstances.getByLegacyOrderId(legacyOrderId),
    enabled: !!(orderInstanceId || legacyOrderId),
  });

  const instanceId = instance?.id;

  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: ["order-step-runs", instanceId],
    queryFn: () => api.orderStepRuns.listForOrder(instanceId!),
    enabled: !!instanceId,
  });

  // Kind aus template_snapshot oder Live-Template ermitteln.
  const snapshotKind = (instance?.template_snapshot as any)?.kind as string | undefined;
  const { data: template } = useQuery({
    queryKey: ["process-template-kind", instance?.template_id],
    queryFn: () => api.processTemplates.get(instance!.template_id!),
    enabled: !!instance?.template_id && !snapshotKind,
  });
  const kind = snapshotKind ?? template?.kind ?? null;
  const isPilotPlant = kind === "pilot_plant";

  // Aktuellen Schritt automatisch aufklappen (Pilot Plant).
  const currentRun = useMemo(
    () =>
      runs.find((r) => r.status === "in_progress") ??
      runs.find((r) => r.status !== "completed" && r.status !== "skipped") ??
      null,
    [runs],
  );
  const [openStepId, setOpenStepId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (isPilotPlant && currentRun && !openStepId) {
      setOpenStepId(currentRun.id);
    }
  }, [isPilotPlant, currentRun, openStepId]);

  if (loadingInstance || loadingRuns) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Prozess wird geladen…
        </CardContent>
      </Card>
    );
  }

  if (!instance) {
    return null;
  }

  const locked = !!instance.locked_at;
  const done = runs.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-4">
      {isPilotPlant && runs.length > 0 && (
        <PilotPlantGuidedStepper
          runs={runs}
          activeRunId={openStepId ?? currentRun?.id ?? null}
          onSelect={(id) => setOpenStepId(id)}
        />
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {isPilotPlant && <Factory className="h-4 w-4 text-primary" />}
              Prozessablauf
              {locked && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Gesperrt</Badge>}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {done} / {runs.length} Schritte erledigt
              {instance.order_number ? ` · ${instance.order_number}` : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Prozessschritte vorhanden.</p>
          ) : (
            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={openStepId}
              onValueChange={(v) => setOpenStepId(v || undefined)}
            >
              {runs.map((run) => (
                <StepRunItem
                  key={run.id}
                  run={run}
                  locked={locked}
                  onChanged={() => {
                    qc.invalidateQueries({ queryKey: ["order-step-runs", instanceId] });
                    qc.invalidateQueries({ queryKey: ["order-instance", orderInstanceId ?? legacyOrderId] });
                  }}
                />
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepRunItem({
  run,
  locked,
  onChanged,
}: {
  run: OrderStepRun;
  locked: boolean;
  onChanged: () => void;
}) {
  const snap = (run.step_snapshot ?? {}) as {
    name?: string;
    form_id?: string | null;
    role_required?: string | null;
    is_mandatory?: boolean;
  };

  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields-for-run", snap.form_id ?? null],
    queryFn: () => (snap.form_id ? api.formFields.listForForm(snap.form_id) : Promise.resolve([])),
    enabled: !!snap.form_id,
  });

  const [values, setValues] = useState<Record<string, any>>(() => (run.form_response ?? {}) as Record<string, any>);
  const [notes, setNotes] = useState<string>(run.notes ?? "");
  const [busy, setBusy] = useState(false);

  const systemVars = useSystemVariables();
  const computedValues = useMemo(() => {
    const merged = { ...values };
    for (const f of fields) {
      if (f.field_type === "computed" && f.formula) {
        try {
          // Systemvariablen sind nur Eingabe für die Formel und werden
          // bewusst NICHT mitgespeichert (Single Source of Truth).
          const res = evaluateFormula(f.formula, { ...systemVars, ...merged });
          merged[f.field_key] = res;
        } catch {
          /* ignore */
        }
      }
    }
    return merged;
  }, [values, fields, systemVars]);


  const disabled = locked || run.status === "completed" || run.status === "skipped";
  const startBlocked = useStepStartBlocked(run.step_id, 1);
  const canStart = !disabled && run.status === "pending" && !startBlocked;
  const canComplete = !disabled && run.status === "in_progress";

  async function handleStart() {
    setBusy(true);
    try {
      await api.workflowEngine.startStep(run.id);
      toast.success("Schritt gestartet");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Start fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    // Validate required fields
    const missing = fields.filter((f) => f.is_required && (computedValues[f.field_key] === undefined || computedValues[f.field_key] === "" || computedValues[f.field_key] === null));
    if (missing.length > 0) {
      toast.error(`Pflichtfelder fehlen: ${missing.map((f) => f.display_name).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      await api.workflowEngine.completeStep(run.id, computedValues, notes || null);
      toast.success("Schritt abgeschlossen");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Abschluss fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccordionItem value={run.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 w-full">
          <StatusIcon status={run.status} />
          <span className="text-sm font-medium">
            {run.order_index + 1}. {snap.name ?? run.step_key}
          </span>
          <Badge variant="outline" className="ml-auto mr-2 text-xs">
            {STATUS_LABEL[run.status] ?? run.status}
          </Badge>
          {snap.role_required && (
            <Badge variant="secondary" className="text-xs">{snap.role_required}</Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          <StepMaterialAvailability stepId={run.step_id} scale={1} />
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" /> Keine Felder für diesen Schritt konfiguriert.
            </p>
          )}
          {fields.map((f) => (
            <FieldInput
              key={f.id}
              field={f}
              value={f.field_type === "computed" ? computedValues[f.field_key] : values[f.field_key]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.field_key]: v }))}
              disabled={disabled}
            />
          ))}

          <div>
            <Label htmlFor={`notes-${run.id}`} className="text-xs">Bemerkungen</Label>
            <Textarea
              id={`notes-${run.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={disabled}
              className="mt-1"
              rows={2}
            />
          </div>

          {run.opened_at && (
            <p className="text-xs text-muted-foreground">
              Gestartet: {new Date(run.opened_at).toLocaleString("de-DE")}
              {run.completed_at && ` · Beendet: ${new Date(run.completed_at).toLocaleString("de-DE")}`}
              {run.auto_time_minutes ? ` · ${run.auto_time_minutes} Min erfasst` : ""}
            </p>
          )}

          {!disabled && (
            <div className="flex gap-2">
              {canStart && (
                <Button size="sm" onClick={handleStart} disabled={busy}>
                  <PlayCircle className="h-4 w-4 mr-1" /> Starten
                </Button>
              )}
              {canComplete && (
                <Button size="sm" onClick={handleComplete} disabled={busy}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Abschließen
                </Button>
              )}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  disabled: boolean;
}) {
  const label = (
    <Label htmlFor={`f-${field.id}`} className="text-xs">
      {field.display_name}
      {field.is_required && <span className="text-destructive ml-0.5">*</span>}
      {field.unit && <span className="text-muted-foreground ml-1">[{field.unit}]</span>}
    </Label>
  );
  const isReadonly = disabled || field.readonly || field.field_type === "computed";

  const renderInput = () => {
    switch (field.field_type) {
      case "longtext":
        return (
          <Textarea
            id={`f-${field.id}`}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={isReadonly}
            rows={3}
          />
        );
      case "number":
      case "decimal":
      case "percent":
      case "computed":
        return (
          <Input
            id={`f-${field.id}`}
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={isReadonly}
          />
        );
      case "boolean":
        return (
          <div className="flex items-center h-9">
            <Switch checked={!!value} onCheckedChange={onChange} disabled={isReadonly} />
          </div>
        );
      case "date":
      case "datetime":
      case "time":
        return (
          <Input
            id={`f-${field.id}`}
            type={field.field_type === "date" ? "date" : field.field_type === "time" ? "time" : "datetime-local"}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={isReadonly}
          />
        );
      case "select": {
        const opts = (field.select_options ?? []) as Array<any>;
        return (
          <Select value={value ?? ""} onValueChange={onChange} disabled={isReadonly}>
            <SelectTrigger id={`f-${field.id}`}><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {opts.map((o, i) => {
                const v = typeof o === "string" ? o : o.value;
                const l = typeof o === "string" ? o : o.label;
                return <SelectItem key={i} value={String(v)}>{l}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        );
      }
      case "ref_material":
        return <RawMaterialSelectField value={value} onChange={onChange} disabled={isReadonly} />;
      case "raw_material_recipe":
        return <RawMaterialRecipeField value={value} onChange={onChange} readonly={isReadonly} />;
      default:
        return (
          <Input
            id={`f-${field.id}`}
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={isReadonly}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      {label}
      {renderInput()}
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
    </div>
  );
}
