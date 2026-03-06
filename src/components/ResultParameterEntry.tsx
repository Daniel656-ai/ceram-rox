import { useState, useEffect, useMemo } from "react";
import { useServiceParameterDefs, type ServiceParameterDefinition } from "@/hooks/useServiceParameters";
import { useAuth } from "@/contexts/AuthContext";
import { useAddMeasurementResult, useUpdateMeasurementResult, useDeleteMeasurementResult } from "@/hooks/useMeasurementResults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  measurementId: string;
  serviceId: string;
  existingResults: any[];
  canEdit: boolean;
}

export default function ResultParameterEntry({ measurementId, serviceId, existingResults, canEdit }: Props) {
  const { user } = useAuth();
  const { data: defs = [] } = useServiceParameterDefs(serviceId);
  const addResult = useAddMeasurementResult();
  const updateResult = useUpdateMeasurementResult();
  const deleteResult = useDeleteMeasurementResult();

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Only output parameters
  const outputDefs = useMemo(() =>
    defs.filter((d) => d.parameter_category === "output").sort((a, b) => a.sort_order - b.sort_order),
    [defs]
  );

  // Map existing results to definitions by matching result_name to parameter_name
  useEffect(() => {
    if (outputDefs.length === 0) return;
    const initial: Record<string, string> = {};
    for (const def of outputDefs) {
      const existing = existingResults.find((r) => r.result_name === def.parameter_name);
      if (existing?.value != null) {
        initial[def.id] = String(existing.value);
      } else {
        initial[def.id] = "";
      }
    }
    setValues(initial);
    setInitialized(true);
  }, [outputDefs, existingResults]);

  // Validation
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const def of outputDefs) {
      const val = values[def.id] || "";
      if (def.is_required && !val.trim()) {
        errs[def.id] = "Pflichtfeld";
      } else if (val.trim()) {
        const num = parseFloat(val);
        if (isNaN(num)) {
          errs[def.id] = "Muss numerisch sein";
        } else {
          if (def.min_value != null && num < def.min_value) {
            errs[def.id] = `Min: ${def.min_value}`;
          }
          if (def.max_value != null && num > def.max_value) {
            errs[def.id] = `Max: ${def.max_value}`;
          }
        }
      }
    }
    return errs;
  }, [outputDefs, values]);

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) {
      toast.error("Bitte alle Validierungsfehler beheben");
      return;
    }
    setSaving(true);
    try {
      for (const def of outputDefs) {
        const val = values[def.id]?.trim() || "";
        const existing = existingResults.find((r) => r.result_name === def.parameter_name);

        if (val) {
          const payload = {
            result_name: def.parameter_name,
            unit: def.unit || null,
            value: parseFloat(val),
            measured_by: user?.id || null,
            measured_at: new Date().toISOString().slice(0, 10),
          };

          if (existing) {
            await updateResult.mutateAsync({ id: existing.id, ...payload });
          } else {
            await addResult.mutateAsync({ order_measurement_id: measurementId, ...payload });
          }
        } else if (existing && !val) {
          // Remove result if value cleared
          await deleteResult.mutateAsync(existing.id);
        }
      }
      toast.success("Ergebnisse gespeichert");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (outputDefs.length === 0 || !initialized) return null;

  const filledCount = outputDefs.filter((d) => (values[d.id] || "").trim()).length;

  return (
    <Card className="border-dashed border-primary/30">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> Ergebnisparameter
            <Badge variant="secondary" className="text-[10px] ml-1">
              {filledCount}/{outputDefs.length}
            </Badge>
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={saving || Object.keys(errors).length > 0}
            >
              <Save className="h-3 w-3 mr-1" /> Ergebnisse speichern
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outputDefs.map((def) => {
            const val = values[def.id] || "";
            const error = errors[def.id];
            const isFilled = val.trim() !== "";

            return (
              <div key={def.id} className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  {def.parameter_name}
                  {def.unit && (
                    <span className="text-muted-foreground font-normal">({def.unit})</span>
                  )}
                  {def.is_required && <span className="text-destructive">*</span>}
                  {isFilled && !error && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                  {error && <AlertCircle className="h-3 w-3 text-destructive" />}
                </Label>
                {def.description && (
                  <p className="text-[10px] text-muted-foreground">{def.description}</p>
                )}
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    value={val}
                    onChange={(e) => setValues((v) => ({ ...v, [def.id]: e.target.value }))}
                    disabled={!canEdit}
                    placeholder={
                      def.min_value != null && def.max_value != null
                        ? `${def.min_value} – ${def.max_value}`
                        : "Messwert eingeben"
                    }
                    className={`h-8 text-sm pr-12 ${error ? "border-destructive" : ""}`}
                  />
                  {def.unit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      {def.unit}
                    </span>
                  )}
                </div>
                {error && <p className="text-[10px] text-destructive">{error}</p>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
