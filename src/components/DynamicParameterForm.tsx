import { useState, useEffect, useMemo } from "react";
import { useServiceParameterDefs, type ServiceParameterDefinition } from "@/hooks/useServiceParameters";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Beaker, FlaskConical, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  measurementId: string;
  serviceId: string;
  existingParams: { id: string; parameter_name: string; parameter_value: string | null; unit: string | null }[];
  canEdit: boolean;
}

export default function DynamicParameterForm({ measurementId, serviceId, existingParams, canEdit }: Props) {
  const { data: defs = [] } = useServiceParameterDefs(serviceId);
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize values from existing params or defaults
  useEffect(() => {
    if (defs.length === 0) return;
    const initial: Record<string, string> = {};
    for (const def of defs) {
      const existing = existingParams.find((p) => p.parameter_name === def.parameter_name);
      if (existing?.parameter_value != null) {
        initial[def.id] = existing.parameter_value;
      } else if (def.default_value) {
        initial[def.id] = def.default_value;
      } else if (def.parameter_type === "boolean") {
        initial[def.id] = "false";
      } else {
        initial[def.id] = "";
      }
    }
    setValues(initial);
    setInitialized(true);
  }, [defs, existingParams]);

  // Determine which params are visible (conditional logic)
  const visibleDefs = useMemo(() => {
    return defs.filter((d) => {
      if (!d.conditional_on) return true;
      const parentValue = values[d.conditional_on] || "";
      return parentValue === d.conditional_value;
    });
  }, [defs, values]);

  const inputDefs = visibleDefs.filter((d) => d.parameter_category === "input");
  const outputDefs = visibleDefs.filter((d) => d.parameter_category === "output");

  // Validate required fields
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const def of visibleDefs) {
      if (def.is_required && !(values[def.id] || "").trim()) {
        errs[def.id] = `${def.parameter_name} ist ein Pflichtfeld`;
      }
    }
    return errs;
  }, [visibleDefs, values]);

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    setSaving(true);
    try {
      // Delete existing params for this measurement
      await api.from("measurement_parameters").delete().eq("order_measurement_id", measurementId);

      // Insert visible params with values
      const inserts = visibleDefs
        .filter((d) => (values[d.id] || "").trim() !== "")
        .map((d) => ({
          order_measurement_id: measurementId,
          parameter_name: d.parameter_name,
          parameter_value: values[d.id],
          unit: d.unit || null,
        }));

      if (inserts.length > 0) {
        const { error } = await api.from("measurement_parameters").insert(inserts);
        if (error) throw error;
      }

      toast.success("Parameter gespeichert");
      qc.invalidateQueries({ queryKey: ["order"] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Auto-populate params from template if measurement has no params yet
  const handleInitFromTemplate = async () => {
    setSaving(true);
    try {
      const inserts = defs
        .filter((d) => !d.conditional_on || (values[d.conditional_on] === d.conditional_value))
        .filter((d) => d.default_value)
        .map((d) => ({
          order_measurement_id: measurementId,
          parameter_name: d.parameter_name,
          parameter_value: d.default_value!,
          unit: d.unit || null,
        }));
      if (inserts.length > 0) {
        const { error } = await api.from("measurement_parameters").insert(inserts);
        if (error) throw error;
      }
      toast.success("Parameter aus Vorlage geladen");
      qc.invalidateQueries({ queryKey: ["order"] });
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (defs.length === 0) return null;
  if (!initialized) return null;

  const renderField = (def: ServiceParameterDefinition) => {
    const value = values[def.id] || "";
    const hasError = !!errors[def.id];

    return (
      <div key={def.id} className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          {def.parameter_name}
          {def.unit && <span className="text-muted-foreground">({def.unit})</span>}
          {def.is_required && <span className="text-destructive">*</span>}
          {hasError && <AlertCircle className="h-3 w-3 text-destructive" />}
        </Label>
        {def.parameter_type === "number" && (
          <Input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValues((v) => ({ ...v, [def.id]: e.target.value }))}
            disabled={!canEdit}
            className={`h-8 text-sm ${hasError ? "border-destructive" : ""}`}
          />
        )}
        {def.parameter_type === "text" && (
          <Input
            value={value}
            onChange={(e) => setValues((v) => ({ ...v, [def.id]: e.target.value }))}
            disabled={!canEdit}
            className={`h-8 text-sm ${hasError ? "border-destructive" : ""}`}
          />
        )}
        {def.parameter_type === "boolean" && (
          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={value === "true"}
              onCheckedChange={(c) => setValues((v) => ({ ...v, [def.id]: c ? "true" : "false" }))}
              disabled={!canEdit}
            />
            <span className="text-sm">{value === "true" ? "Ja" : "Nein"}</span>
          </div>
        )}
        {def.parameter_type === "select" && (
          <Select value={value} onValueChange={(v) => setValues((vs) => ({ ...vs, [def.id]: v }))} disabled={!canEdit}>
            <SelectTrigger className={`h-8 text-sm ${hasError ? "border-destructive" : ""}`}>
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
  };

  const renderSection = (category: string, items: ServiceParameterDefinition[], icon: typeof Beaker) => {
    const Icon = icon;
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{category === "input" ? "Einstellparameter" : "Ergebnisparameter"}</span>
          <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {items.map(renderField)}
        </div>
      </div>
    );
  };

  const hasExisting = existingParams.length > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Definierte Parameter</CardTitle>
          <div className="flex gap-2">
            {!hasExisting && canEdit && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleInitFromTemplate} disabled={saving}>
                Vorlage laden
              </Button>
            )}
            {canEdit && (
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving || Object.keys(errors).length > 0}>
                <Save className="h-3 w-3 mr-1" /> Speichern
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {renderSection("input", inputDefs, Beaker)}
        {renderSection("output", outputDefs, FlaskConical)}
      </CardContent>
    </Card>
  );
}
