import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AlertTriangle, CheckCircle2, Loader2, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatQuantity } from "@/lib/formatQuantity";

interface Props {
  /** process_steps.id (template step). Renders nothing if the step has no materials. */
  stepId: string | null | undefined;
  /** Multiplier applied to target quantities (e.g. number of samples). */
  scale?: number;
}

/**
 * Materialverfügbarkeits-Check zur Laufzeit.
 * Zeigt Hinweis, wenn Rohstoffe fehlen, ansonsten Bestätigung.
 * Rendert nichts, wenn dem Schritt keine Rohstoffe zugeordnet sind.
 */
export function StepMaterialAvailability({ stepId, scale = 1 }: Props) {
  const enabled = !!stepId;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["step-mat-availability", stepId, scale],
    queryFn: () => api.processStepRawMaterials.availability(stepId!, scale),
    enabled,
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => api.companySettings.get(),
  });

  if (!enabled) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Materialverfügbarkeit wird geprüft…
      </div>
    );
  }
  if (rows.length === 0) return null;

  const missing = rows.filter((r) => Number(r.missing) > 0);
  const mode = (settings as any)?.raw_material_check_mode ?? "warn";

  if (missing.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle className="text-sm">Alle Rohstoffe verfügbar</AlertTitle>
        <AlertDescription className="text-xs">
          {rows.length} Rohstoff{rows.length === 1 ? "" : "e"} auf Lager (Gebinde / LOTs).
        </AlertDescription>
      </Alert>
    );
  }

  const blocking = mode === "block";

  return (
    <Alert variant={blocking ? "destructive" : "default"} className={!blocking ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : undefined}>
      {blocking ? <AlertTriangle className="h-4 w-4" /> : <Package className="h-4 w-4 text-amber-600" />}
      <AlertTitle className="text-sm">
        {blocking ? "Auftrag gesperrt – Material fehlt" : "Materialengpass erkannt"}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-xs">
          {missing.map((r) => (
            <li key={r.psrm_id}>
              <strong>{r.material_name}</strong>
              {r.material_number ? ` (${r.material_number})` : ""}: benötigt{" "}
              {formatQuantity(r.required)} {r.unit}, verfügbar {formatQuantity(r.available)} {r.unit},{" "}
              <strong>fehlt {formatQuantity(r.missing)} {r.unit}</strong>
            </li>
          ))}
        </ul>
        {mode === "warn" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Hinweis: Der Auftrag kann trotzdem gestartet werden. Diese Regel lässt sich in den Firmen-Einstellungen ändern.
          </p>
        )}
        {mode === "block" && (
          <p className="mt-2 text-xs">
            Der Schritt kann laut Firmen-Einstellung erst nach ausreichender Materialverfügbarkeit gestartet werden.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Convenience hook: returns whether starting a step should be blocked
 * according to the company-wide raw-material check mode.
 */
export function useStepStartBlocked(stepId: string | null | undefined, scale = 1) {
  const { data: rows = [] } = useQuery({
    queryKey: ["step-mat-availability", stepId, scale],
    queryFn: () => api.processStepRawMaterials.availability(stepId!, scale),
    enabled: !!stepId,
  });
  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => api.companySettings.get(),
  });
  const mode = (settings as any)?.raw_material_check_mode ?? "warn";
  const missing = rows.some((r) => Number(r.missing) > 0);
  return mode === "block" && missing;
}
