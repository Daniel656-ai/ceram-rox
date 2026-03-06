import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ORDER_TYPE_LABELS, ORDER_PRIORITY_LABELS } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Trash2, AlertCircle } from "lucide-react";
import SampleSelector from "@/components/SampleSelector";

interface SelectedMeasurement {
  service_id: string;
  service_name: string;
  planned_hours: number;
  workstation_id: string;
}

// Inline component for required input parameters of a service
function ServiceRequiredParams({
  serviceId,
  paramValues,
  onParamChange,
}: {
  serviceId: string;
  paramValues: Record<string, string>;
  onParamChange: (paramId: string, value: string) => void;
}) {
  const { data: defs = [] } = useServiceParameterDefs(serviceId);
  
  // Show only required input parameters
  const requiredInputDefs = defs.filter(
    (d) => d.parameter_category === "input" && d.is_required && !d.conditional_on
  );

  if (requiredInputDefs.length === 0) return null;

  return (
    <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Pflichtparameter:</p>
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
                <Input
                  type="number"
                  step="any"
                  value={val}
                  onChange={(e) => onParamChange(def.id, e.target.value)}
                  placeholder={def.default_value || ""}
                  className={`h-7 text-xs ${hasError ? "border-destructive" : ""}`}
                />
              )}
              {def.parameter_type === "text" && (
                <Input
                  value={val}
                  onChange={(e) => onParamChange(def.id, e.target.value)}
                  placeholder={def.default_value || ""}
                  className={`h-7 text-xs ${hasError ? "border-destructive" : ""}`}
                />
              )}
              {def.parameter_type === "boolean" && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={val === "true"}
                    onCheckedChange={(c) => onParamChange(def.id, c ? "true" : "false")}
                  />
                  <span className="text-xs">{val === "true" ? "Ja" : "Nein"}</span>
                </div>
              )}
              {def.parameter_type === "select" && (
                <Select value={val} onValueChange={(v) => onParamChange(def.id, v)}>
                  <SelectTrigger className={`h-7 text-xs ${hasError ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Bitte wählen" />
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
  // Parameter values per measurement index, keyed by def.id
  const [measurementParams, setMeasurementParams] = useState<Record<number, Record<string, string>>>({});

  const addService = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc || measurements.some((m) => m.service_id === serviceId)) return;
    setMeasurements([...measurements, { service_id: serviceId, service_name: svc.service_name, planned_hours: 1, workstation_id: svc.workstation_id || "" }]);
  };

  const removeMeasurement = (idx: number) => {
    setMeasurements(measurements.filter((_, i) => i !== idx));
    setMeasurementParams((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const updateMeasurement = (idx: number, field: string, value: any) => {
    setMeasurements(measurements.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const updateParam = (measurementIdx: number, paramId: string, value: string) => {
    setMeasurementParams((prev) => ({
      ...prev,
      [measurementIdx]: { ...(prev[measurementIdx] || {}), [paramId]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orderType || measurements.length === 0 || !selectedSampleId) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus, wählen eine Probe und fügen mindestens eine Messung hinzu.");
      return;
    }

    setSubmitting(true);
    try {
      const projectId = selectedProjectId;
      if (!projectId) { toast.error("Bitte wählen Sie ein Projekt."); setSubmitting(false); return; }

      const order = await createOrder.mutateAsync({
        project_id: projectId,
        order_type: orderType as any,
        created_by: user.id,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        priority: priority as any,
        sample_id: selectedSampleId,
      });

      // Create measurements and save parameters
      for (let idx = 0; idx < measurements.length; idx++) {
        const m = measurements[idx];
        const createdMeasurement = await addMeasurement.mutateAsync({
          order_id: order.id,
          service_id: m.service_id,
          planned_hours: m.planned_hours,
          due_date: dueDate || undefined,
          workstation_id: m.workstation_id || undefined,
        });

        // Save required parameters if any were filled
        const params = measurementParams[idx];
        if (params && Object.keys(params).length > 0) {
          // We need to look up the defs to get parameter_name and unit
          const { data: defs } = await supabase
            .from("service_parameter_definitions")
            .select("id, parameter_name, unit")
            .eq("service_id", m.service_id)
            .in("id", Object.keys(params));

          if (defs && defs.length > 0) {
            const inserts = defs
              .filter((d) => (params[d.id] || "").trim())
              .map((d) => ({
                order_measurement_id: createdMeasurement.id,
                parameter_name: d.parameter_name,
                parameter_value: params[d.id],
                unit: d.unit || null,
              }));

            if (inserts.length > 0) {
              const { error } = await supabase.from("measurement_parameters").insert(inserts);
              if (error) throw error;
            }
          }
        }
      }

      toast.success("Messauftrag erfolgreich erstellt!");
      navigate(`/auftraege/${order.id}`);
    } catch (err: any) {
      toast.error("Fehler beim Erstellen", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const laborServices = services.filter((s) => s.category === "labor");
  const pilotServices = services.filter((s) => s.category === "pilot_plant");

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Neuer Messauftrag</h1>
          <p className="text-muted-foreground">Erstellen Sie einen neuen Messauftrag mit Messungen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Projekt */}
        <Card>
          <CardHeader><CardTitle className="text-base">Projekt</CardTitle></CardHeader>
          <CardContent>
            <div>
              <Label>Projekt auswählen</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_number} {p.project_name ? `– ${p.project_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Probe */}
        <Card>
          <CardHeader><CardTitle className="text-base">Probe *</CardTitle></CardHeader>
          <CardContent>
            <SampleSelector
              value={selectedSampleId}
              onSelect={setSelectedSampleId}
              projectId={selectedProjectId || undefined}
            />
          </CardContent>
        </Card>

        {/* Auftragsdetails */}
        <Card>
          <CardHeader><CardTitle className="text-base">Auftragsdetails</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Auftragstyp *</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger><SelectValue placeholder="Typ wählen..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorität *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_PRIORITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Fälligkeitsdatum</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Anmerkungen</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionale Anmerkungen zum Auftrag" rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Messungen */}
        <Card>
          <CardHeader><CardTitle className="text-base">Messungen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Messung hinzufügen</Label>
              <Select onValueChange={addService}>
                <SelectTrigger><SelectValue placeholder="Messdienstleistung auswählen..." /></SelectTrigger>
                <SelectContent>
                  {laborServices.length > 0 && (
                    <>
                      <SelectItem value="__labor_header" disabled>── Labor ──</SelectItem>
                      {laborServices.map((s) => (
                        <SelectItem key={s.id} value={s.id} disabled={measurements.some((m) => m.service_id === s.id)}>
                          {s.service_name} ({s.hourly_rate} €/h)
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {pilotServices.length > 0 && (
                    <>
                      <SelectItem value="__pilot_header" disabled>── Pilot Plant ──</SelectItem>
                      {pilotServices.map((s) => (
                        <SelectItem key={s.id} value={s.id} disabled={measurements.some((m) => m.service_id === s.id)}>
                          {s.service_name} ({s.hourly_rate} €/h)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {measurements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Messungen hinzugefügt. Wählen Sie mindestens eine Messdienstleistung aus.</p>
            ) : (
              <div className="space-y-3">
                {measurements.map((m, idx) => (
                  <div key={idx} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <p className="font-medium text-sm">{m.service_name}</p>
                      </div>
                      <div className="w-36">
                        <Label className="text-xs">Arbeitsplatz</Label>
                        <Select value={m.workstation_id || "__none"} onValueChange={(v) => updateMeasurement(idx, "workstation_id", v === "__none" ? "" : v)}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">– Keiner –</SelectItem>
                            {workstations.filter((w: any) => w.status === "active").map((w: any) => (
                              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Stunden</Label>
                        <Input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={m.planned_hours}
                          onChange={(e) => updateMeasurement(idx, "planned_hours", parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMeasurement(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Required parameters for this service */}
                    <ServiceRequiredParams
                      serviceId={m.service_id}
                      paramValues={measurementParams[idx] || {}}
                      onParamChange={(paramId, value) => updateParam(idx, paramId, value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Wird erstellt..." : "Messauftrag erstellen"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Abbrechen</Button>
        </div>
      </form>
    </div>
  );
}
