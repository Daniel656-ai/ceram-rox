import type { OrderStepRun } from "@/lib/api/orderStepRuns";
import { CheckCircle2, Circle, Clock, Lock, ArrowRight, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  runs: OrderStepRun[];
  onSelect?: (runId: string) => void;
  activeRunId?: string | null;
}

function statusMeta(status: string) {
  switch (status) {
    case "completed":
      return { icon: CheckCircle2, tone: "text-emerald-600", ring: "ring-emerald-500/40", bg: "bg-emerald-50 dark:bg-emerald-950/30", label: "Erledigt" };
    case "in_progress":
      return { icon: Clock, tone: "text-amber-600", ring: "ring-amber-500/60", bg: "bg-amber-50 dark:bg-amber-950/30", label: "In Bearbeitung" };
    case "blocked":
      return { icon: Lock, tone: "text-destructive", ring: "ring-destructive/40", bg: "bg-destructive/10", label: "Blockiert" };
    case "skipped":
      return { icon: Circle, tone: "text-muted-foreground", ring: "ring-muted", bg: "bg-muted/30", label: "Übersprungen" };
    default:
      return { icon: Circle, tone: "text-muted-foreground", ring: "ring-border", bg: "bg-background", label: "Offen" };
  }
}

function name(r: OrderStepRun) {
  const snap = (r.step_snapshot ?? {}) as { name?: string };
  return snap.name ?? r.step_key;
}

/**
 * Der "rote Faden" für Pilot-Plant-Aufträge.
 * Zeigt den vollständigen Ablauf als horizontales Stepper-Band und
 * fasst darunter aktuellen Schritt, nächsten Schritt sowie den
 * Fortschritt zusammen.
 */
export function PilotPlantGuidedStepper({ runs, onSelect, activeRunId }: Props) {
  if (runs.length === 0) return null;

  const done = runs.filter((r) => r.status === "completed" || r.status === "skipped").length;
  const total = runs.length;
  const percent = Math.round((done / total) * 100);

  // Current = first in_progress, sonst erster nicht abgeschlossener Schritt
  const current =
    runs.find((r) => r.status === "in_progress") ??
    runs.find((r) => r.status !== "completed" && r.status !== "skipped") ??
    null;
  const currentIdx = current ? runs.findIndex((r) => r.id === current.id) : -1;
  const next = currentIdx >= 0 ? runs[currentIdx + 1] ?? null : null;
  const allDone = !current;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        {/* Header: Fortschrittsbalken */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Pilot-Plant-Ablauf</span>
            <Badge variant="outline" className="text-xs">
              {done} / {total} Schritte
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{percent}%</div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Horizontaler Stepper mit "rotem Faden" */}
        <div className="overflow-x-auto pb-2 -mx-1">
          <div className="flex items-start gap-0 min-w-max px-1">
            {runs.map((r, i) => {
              const meta = statusMeta(r.status);
              const Icon = meta.icon;
              const isActive = activeRunId === r.id || (activeRunId == null && current?.id === r.id);
              const isCurrent = current?.id === r.id;
              const connectorDone = i < runs.length - 1 && (runs[i].status === "completed" || runs[i].status === "skipped");
              return (
                <div key={r.id} className="flex items-start">
                  <button
                    type="button"
                    onClick={() => onSelect?.(r.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 w-28 group focus:outline-none",
                    )}
                    title={name(r)}
                  >
                    <div
                      className={cn(
                        "relative flex items-center justify-center h-9 w-9 rounded-full ring-2 transition-all",
                        meta.bg,
                        meta.ring,
                        isActive && "ring-4 scale-105",
                        isCurrent && "shadow-md",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", meta.tone)} />
                      <span className="absolute -bottom-1 -right-1 text-[10px] font-semibold bg-background border rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "text-[11px] leading-tight text-center line-clamp-2 px-1",
                        isCurrent ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {name(r)}
                    </div>
                  </button>
                  {i < runs.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 w-6 mt-[18px] transition-colors",
                        connectorDone ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Zusammenfassung: aktueller & nächster Schritt */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Aktueller Schritt
            </div>
            {allDone ? (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Prozess abgeschlossen
              </div>
            ) : current ? (
              <button
                type="button"
                onClick={() => onSelect?.(current.id)}
                className="text-left w-full"
              >
                <div className="text-sm font-semibold">
                  {currentIdx + 1}. {name(current)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {statusMeta(current.status).label}
                  {(current.step_snapshot as any)?.role_required
                    ? ` · Rolle: ${(current.step_snapshot as any).role_required}`
                    : ""}
                </div>
              </button>
            ) : (
              <div className="text-sm text-muted-foreground">–</div>
            )}
          </div>
          <div className="rounded-md border bg-background p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Nächster Schritt
            </div>
            {next ? (
              <button
                type="button"
                onClick={() => onSelect?.(next.id)}
                className="text-left w-full"
              >
                <div className="text-sm font-medium">
                  {currentIdx + 2}. {name(next)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(next.step_snapshot as any)?.is_mandatory === false ? "Optional" : "Pflicht"}
                </div>
              </button>
            ) : (
              <div className="text-sm text-muted-foreground">
                {allDone ? "Keiner – alles erledigt." : "Letzter Schritt."}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
