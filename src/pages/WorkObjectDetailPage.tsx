import { useMemo } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { WorkObjectHeader } from "@/components/workflow/WorkObjectHeader";
import { WorkflowProgress } from "@/components/workflow/WorkflowProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Play, CheckCircle2 } from "lucide-react";

export default function WorkObjectDetailPage() {
  const { id = "" } = useParams();
  const [sp, setSp] = useSearchParams();
  const focusTaskId = sp.get("task");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: obj } = useQuery({
    queryKey: ["work-object", id],
    queryFn: () => api.workObjects.get(id),
    enabled: !!id,
  });
  const { data: progress } = useQuery({
    queryKey: ["work-object-progress", id],
    queryFn: () => api.workObjects.getProgress(id),
    enabled: !!id,
  });
  const { data: samples = [] } = useQuery({
    queryKey: ["work-object-samples", id],
    queryFn: () => api.samples.listForOrder(id),
    enabled: !!id,
  });

  const steps = progress?.steps ?? [];
  const done = steps.filter((s) => s.task?.status === "completed").length;

  const activeStep = useMemo(() => {
    if (focusTaskId) return steps.find((s) => s.task?.id === focusTaskId) ?? null;
    return steps.find((s) => s.task?.status === "in_progress")
      ?? steps.find((s) => s.task?.status === "pending")
      ?? null;
  }, [steps, focusTaskId]);

  const startTask = useMutation({
    mutationFn: (taskId: string) => api.workTasks.start(taskId, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-object-progress", id] }),
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      await api.workTasks.complete(taskId, {});
    },
    onSuccess: () => {
      toast.success("Schritt abgeschlossen");
      qc.invalidateQueries({ queryKey: ["work-object-progress", id] });
      qc.invalidateQueries({ queryKey: ["my-work-tasks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: ({ taskId, notes }: { taskId: string; notes: string }) =>
      api.workTasks.updateNotes(taskId, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-object-progress", id] }),
  });

  if (!obj) return <div className="p-6 text-muted-foreground">Lädt …</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/arbeit")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zur Arbeitsliste
      </Button>

      <WorkObjectHeader
        referenceNumber={obj.reference_number ?? obj.order_number}
        origin={obj.origin}
        status={obj.status}
        workflowStatus={obj.workflow_status}
        project={obj.projects ?? null}
        customerName={obj.customer_name}
        progress={{ done, total: steps.length }}
      />

      <Card>
        <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
        <CardContent>
          <WorkflowProgress
            steps={steps as any}
            onStepClick={(sid) => {
              const s = steps.find((x) => x.id === sid);
              if (s?.task) setSp({ task: s.task.id });
            }}
          />
        </CardContent>
      </Card>

      {activeStep && activeStep.task && (
        <Card>
          <CardHeader>
            <CardTitle>Aktueller Schritt: {activeStep.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground">{activeStep.task.status}</span>
            </div>
            <Textarea
              defaultValue={activeStep.task.notes ?? ""}
              placeholder="Bemerkungen zu diesem Schritt …"
              onBlur={(e) => {
                if (e.target.value !== (activeStep.task!.notes ?? "")) {
                  saveNotes.mutate({ taskId: activeStep.task!.id, notes: e.target.value });
                }
              }}
            />
            <div className="flex gap-2">
              {activeStep.task.status === "pending" && (
                <Button onClick={() => startTask.mutate(activeStep.task!.id)} disabled={startTask.isPending}>
                  <Play className="mr-2 h-4 w-4" /> Bearbeitung starten
                </Button>
              )}
              {activeStep.task.status === "in_progress" && (
                <Button onClick={() => completeTask.mutate(activeStep.task!.id)} disabled={completeTask.isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Als erledigt markieren
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="samples">
        <TabsList>
          <TabsTrigger value="samples">Proben ({samples.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="samples">
          <Card>
            <CardContent className="pt-4">
              {samples.length === 0 ? (
                <p className="text-muted-foreground">Noch keine Proben zu diesem Arbeitsobjekt.</p>
              ) : (
                <ul className="divide-y">
                  {samples.map((s: any) => (
                    <li key={s.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-mono">{s.sample_number}</div>
                        <div className="text-sm text-muted-foreground">{s.sample_name}</div>
                      </div>
                      <Link className="text-sm text-primary hover:underline" to={`/proben/${s.id}`}>
                        Öffnen
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="details">
          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div><span className="text-muted-foreground">Interne Auftragsnummer: </span><span className="font-mono">{obj.order_number}</span></div>
              <div><span className="text-muted-foreground">Referenztyp: </span>{obj.reference_type ?? "—"}</div>
              <div><span className="text-muted-foreground">Priorität: </span>{obj.priority ?? "—"}</div>
              <div><span className="text-muted-foreground">Fällig: </span>{obj.due_date ?? "—"}</div>
              <div className="pt-2">
                <Link to={`/auftraege/${obj.id}`} className="text-primary hover:underline">
                  Klassische Auftragsansicht öffnen
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
