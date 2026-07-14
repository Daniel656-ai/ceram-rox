import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkflowTask, WorkflowTaskPosition } from "@/lib/api/workflowDesigner";
import ServiceBookingForm from "@/components/ServiceBookingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, PlayCircle, ListChecks, User, Timer } from "lucide-react";

/**
 * Runtime panel for the workflow steps of ONE order.
 * - Loads all tasks + the shared_form_data of the order.
 * - Each task shows: its form (prefilled from shared store), position grid,
 *   Start / Save draft / Complete buttons.
 * - Completion validation + shared store merge + time-entry + instance
 *   status are handled by the DB trigger installed in the migration.
 */
export function WorkflowRuntimePanel({ order }: { order: any }) {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const orderId: string = order.id;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["wf-tasks", orderId],
    queryFn: () => api.workflowTasks.listForOrder(orderId),
  });

  const { data: shared = {} } = useQuery({
    queryKey: ["wf-shared", orderId],
    queryFn: () => api.orderSharedFormData.get(orderId),
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["wf-steps-for-order", orderId, tasks.map((t) => t.step_id).join(",")],
    enabled: tasks.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(tasks.map((t) => t.step_id)));
      // Cheap: reuse designer API by iterating (tasks small)
      const out: any[] = [];
      for (const id of ids) {
        const s = await api.from("service_workflow_steps" as any).select("*").eq("id", id).maybeSingle();
        if (s.data) out.push(s.data);
      }
      return out;
    },
  });

  const stepById = useMemo(() => {
    const m = new Map<string, any>();
    steps.forEach((s: any) => m.set(s.id, s));
    return m;
  }, [steps]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["wf-tasks", orderId] });
    qc.invalidateQueries({ queryKey: ["wf-shared", orderId] });
    qc.invalidateQueries({ queryKey: ["order", orderId] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Lädt…</p>;
  if (tasks.length === 0)
    return (
      <p className="text-sm text-muted-foreground p-4">
        Für diesen Auftrag wurde kein Workflow instanziert. Ordne der Dienstleistung im
        Service Designer einen aktiven Workflow zu — beim nächsten Auftrag werden die
        Schritte automatisch angelegt.
      </p>
    );

  return (
    <div className="space-y-4 pt-4">
      {tasks.map((task, idx) => (
        <TaskCard
          key={task.id}
          index={idx + 1}
          task={task}
          step={stepById.get(task.step_id)}
          sharedData={shared as Record<string, unknown>}
          isMaster={role === "master"}
          currentUserId={user?.id}
          onChanged={invalidateAll}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TaskCard({
  index,
  task,
  step,
  sharedData,
  isMaster,
  currentUserId,
  onChanged,
}: {
  index: number;
  task: WorkflowTask;
  step: any;
  sharedData: Record<string, unknown>;
  isMaster: boolean;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const canEdit =
    isMaster ||
    task.assigned_to === currentUserId ||
    (task.assigned_to == null && task.status !== "completed");

  const isCompleted = task.status === "completed";
  const isStarted = task.status === "in_progress";

  // Local form values, seeded from shared store then overlaid with the task's
  // own draft (form_response). Same field_key → same value automatically.
  const initialValues = useMemo(() => {
    const base: Record<string, any> = { ...(sharedData || {}) };
    const draft = (task.form_response as any) || {};
    return { ...base, ...draft };
  }, [sharedData, task.form_response]);

  const [values, setValues] = useState<Record<string, any>>(initialValues);

  // Positions
  const { data: positions = [] } = useQuery({
    queryKey: ["wf-positions", task.id],
    queryFn: () => api.workflowTaskPositions.listForTask(task.id),
    enabled: isStarted || isCompleted,
  });

  const [posDraft, setPosDraft] = useState<Record<string, Partial<WorkflowTaskPosition>>>({});
  const posEffective = (p: WorkflowTaskPosition): WorkflowTaskPosition => ({
    ...p,
    ...(posDraft[p.id] || {}),
  });

  const savePositionsMut = useMutation({
    mutationFn: async () => {
      const rows = positions
        .filter((p) => posDraft[p.id])
        .map((p) => ({ ...p, ...posDraft[p.id] }));
      if (rows.length === 0) return;
      await api.workflowTaskPositions.upsertMany(rows as any);
    },
    onSuccess: () => {
      setPosDraft({});
      qc.invalidateQueries({ queryKey: ["wf-positions", task.id] });
      toast.success("Positionen gespeichert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: () => api.workflowTasks.start(task.id),
    onSuccess: () => { onChanged(); qc.invalidateQueries({ queryKey: ["wf-positions", task.id] }); toast.success("Schritt gestartet"); },
    onError: (e: any) => toast.error(e.message),
  });

  const draftMut = useMutation({
    mutationFn: () => api.workflowTasks.saveDraft(task.id, values),
    onSuccess: () => { onChanged(); toast.success("Zwischenstand gespeichert"); },
    onError: (e: any) => toast.error(e.message),
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      // Persist any pending position changes first
      if (Object.keys(posDraft).length > 0) {
        const rows = positions
          .filter((p) => posDraft[p.id])
          .map((p) => ({ ...p, ...posDraft[p.id] }));
        await api.workflowTaskPositions.upsertMany(rows as any);
        setPosDraft({});
      }
      // Client-side validation mirrors the DB trigger (better UX)
      const merged = positions.map((p) => posEffective(p));
      const gaps = merged.filter(
        (p) =>
          !(
            (p.result_value && p.result_value.trim().length > 0) ||
            (p.status === "not_feasible" && p.not_feasible_reason && p.not_feasible_reason.trim().length > 0)
          )
      );
      if (gaps.length > 0) {
        throw new Error(
          `Abschluss nicht möglich: ${gaps.length} Position(en) ohne Ergebnis oder Begründung.`
        );
      }
      await api.workflowTasks.complete(task.id, values);
    },
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: ["wf-positions", task.id] });
      toast.success("Schritt abgeschlossen");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const serviceId: string | undefined = step?.service_id ?? undefined;
  const roleView = step?.role_required === "auftraggeber" ? "customer" : "employee";

  return (
    <Card className={isCompleted ? "border-green-500/40 bg-green-500/5" : ""}>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">Schritt {index}</Badge>
          <span>{step?.name ?? "Workflow-Schritt"}</span>
          <StatusPill status={task.status} />
          {task.assigned_to && (
            <Badge variant="outline" className="gap-1">
              <User className="h-3 w-3" />
              {task.assigned_to === currentUserId ? "Mir zugewiesen" : "Zugewiesen"}
            </Badge>
          )}
          {task.auto_time_minutes != null && (
            <Badge variant="outline" className="gap-1">
              <Timer className="h-3 w-3" />
              {task.auto_time_minutes} min gebucht
            </Badge>
          )}
        </CardTitle>
        {step?.description && (
          <p className="text-xs text-muted-foreground">{step.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!isStarted && !isCompleted && (
          <div className="flex items-center justify-between border rounded-md p-3 bg-muted/40">
            <p className="text-sm text-muted-foreground">
              Schritt noch nicht gestartet. Beim Start werden Positionen automatisch
              aus den Proben des Auftrags erzeugt.
            </p>
            <Button size="sm" onClick={() => startMut.mutate()} disabled={!canEdit || startMut.isPending}>
              <PlayCircle className="h-4 w-4 mr-1" /> Starten
            </Button>
          </div>
        )}

        {(isStarted || isCompleted) && serviceId && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Formular (Prefill aus vorherigen Schritten übernommen)
            </p>
            <ServiceBookingForm
              serviceId={serviceId}
              roleView={roleView as any}
              values={values}
              onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
            />
          </div>
        )}

        {(isStarted || isCompleted) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="h-4 w-4" />
              <p className="text-sm font-medium">Positionen</p>
              <Badge variant="outline">{positions.length}</Badge>
            </div>
            {positions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Keine Positionen vorhanden. Lege Proben im Reiter „Proben" an und starte den Schritt erneut.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ergebnis</TableHead>
                    <TableHead>Bemerkung</TableHead>
                    <TableHead>Begründung (falls nicht durchführbar)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((p) => {
                    const eff = posEffective(p);
                    const setField = (field: keyof WorkflowTaskPosition, v: any) =>
                      setPosDraft((prev) => ({
                        ...prev,
                        [p.id]: { ...(prev[p.id] || {}), [field]: v },
                      }));
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{eff.position_label ?? "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={eff.status}
                            onValueChange={(v) => setField("status", v)}
                            disabled={!canEdit || isCompleted}
                          >
                            <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Offen</SelectItem>
                              <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                              <SelectItem value="completed">Abgeschlossen</SelectItem>
                              <SelectItem value="not_feasible">Nicht durchführbar</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={eff.result_value ?? ""}
                            onChange={(e) => setField("result_value", e.target.value)}
                            disabled={!canEdit || isCompleted || eff.status === "not_feasible"}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={eff.remarks ?? ""}
                            onChange={(e) => setField("remarks", e.target.value)}
                            disabled={!canEdit || isCompleted}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={eff.not_feasible_reason ?? ""}
                            onChange={(e) => setField("not_feasible_reason", e.target.value)}
                            disabled={!canEdit || isCompleted || eff.status !== "not_feasible"}
                            className="h-8"
                            placeholder={eff.status === "not_feasible" ? "Pflicht" : "—"}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {Object.keys(posDraft).length > 0 && !isCompleted && (
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => savePositionsMut.mutate()} disabled={savePositionsMut.isPending}>
                  Positionen speichern
                </Button>
              </div>
            )}
          </div>
        )}

        {task.notes && (
          <div>
            <Label className="text-xs">Notiz</Label>
            <p className="text-sm text-muted-foreground">{task.notes}</p>
          </div>
        )}

        {(isStarted || isCompleted) && canEdit && !isCompleted && (
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => draftMut.mutate()} disabled={draftMut.isPending}>
              Zwischenstand speichern
            </Button>
            <Button size="sm" onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Schritt abschließen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
    pending: { label: "Offen", variant: "outline" },
    in_progress: { label: "In Bearbeitung", variant: "secondary" },
    completed: { label: "Abgeschlossen", variant: "default" },
    skipped: { label: "Übersprungen", variant: "outline" },
    escalated: { label: "Eskaliert", variant: "destructive" },
  };
  const s = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
