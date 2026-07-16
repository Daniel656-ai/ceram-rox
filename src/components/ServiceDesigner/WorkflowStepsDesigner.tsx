import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WorkflowStep, WorkflowDefinition } from "@/lib/api/workflowDesigner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Workflow, Link2, Lock, Users } from "lucide-react";
import { ROLE_VIEW_PRESETS, DEFAULT_ROLE_KEY } from "@/lib/api/formRoleViews";

const STEP_TYPES = [
  { value: "form", label: "Formular-Schritt" },
  { value: "approval", label: "Freigabe" },
  { value: "condition", label: "Bedingung" },
  { value: "action", label: "Automatische Aktion" },
  { value: "end", label: "Abschluss" },
];

const ROLES = [
  { value: "auftraggeber", label: "Auftraggeber" },
  { value: "durchfuehrer", label: "Messdienstleister" },
  { value: "master", label: "Administrator" },
];

interface Props {
  serviceId: string;
  canManage: boolean;
}

export default function WorkflowStepsDesigner({ serviceId, canManage }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<WorkflowStep> | null>(null);
  const [linkedServiceIds, setLinkedServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");

  const { data: workflow, isLoading } = useQuery({
    queryKey: ["workflow-active", serviceId],
    queryFn: () => api.workflowDefinitions.getActive(serviceId),
  });

  const { data: forms = [] } = useQuery({
    queryKey: ["service-forms", serviceId],
    queryFn: () => api.serviceForms.list(serviceId),
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ["measurement-services-active"],
    queryFn: () => api.measurementServices.listActive(),
  });

  const stepIds = (workflow?.steps ?? []).map((s) => s.id);
  const { data: allLinks = [] } = useQuery({
    queryKey: ["workflow-step-services", workflow?.id, stepIds.join(",")],
    enabled: stepIds.length > 0,
    queryFn: () => api.workflowStepServices.listForSteps(stepIds),
  });

  const linksByStep = allLinks.reduce<Record<string, string[]>>((acc, l) => {
    (acc[l.step_id] ||= []).push(l.service_id);
    return acc;
  }, {});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workflow-active", serviceId] });

  const createWorkflow = useMutation({
    mutationFn: () =>
      api.workflowDefinitions.create({
        service_id: serviceId,
        name: "Standard-Workflow",
        version: 1,
        is_active: true,
      }),
    onSuccess: () => { invalidate(); toast.success("Workflow erstellt"); },
  });

  const invalidateLinks = () => qc.invalidateQueries({ queryKey: ["workflow-step-services"] });

  const saveStep = useMutation({
    mutationFn: async (step: Partial<WorkflowStep>) => {
      let saved: WorkflowStep;
      if (step.id) {
        await api.workflowSteps.update(step.id, step);
        saved = { ...(step as WorkflowStep) };
      } else {
        saved = await api.workflowSteps.create({
          ...step,
          workflow_id: workflow!.id,
          step_key: step.step_key || `step_${Date.now()}`,
          name: step.name!,
          step_type: step.step_type || "form",
        } as any);
      }
      await api.workflowStepServices.setForStep(saved.id, linkedServiceIds);
      return saved;
    },
    onSuccess: () => { invalidate(); invalidateLinks(); setEditing(null); setLinkedServiceIds([]); toast.success("Gespeichert"); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeStep = useMutation({
    mutationFn: (id: string) => api.workflowSteps.remove(id),
    onSuccess: () => { invalidate(); toast.success("Schritt gelöscht"); },
  });

  const moveStep = useMutation({
    mutationFn: async ({ step, dir }: { step: WorkflowStep; dir: -1 | 1 }) => {
      const steps = workflow?.steps ?? [];
      const idx = steps.findIndex((s) => s.id === step.id);
      const target = idx + dir;
      if (target < 0 || target >= steps.length) return;
      const swap = steps[target];
      await api.workflowSteps.reorder([
        { id: step.id, order_index: swap.order_index },
        { id: swap.id, order_index: step.order_index },
      ]);
    },
    onSuccess: () => invalidate(),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Lädt…</div>;

  if (!workflow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" />Kein Workflow definiert</CardTitle>
          <CardDescription>Für diese Dienstleistung wurde noch kein Workflow angelegt.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={!canManage} onClick={() => createWorkflow.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> Standard-Workflow anlegen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const steps = workflow.steps ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{workflow.name} <Badge variant="outline" className="ml-2">v{workflow.version}</Badge></CardTitle>
            <CardDescription>Prozessschritte für diese Dienstleistung. Reihenfolge = Ausführungsreihenfolge.</CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => { setLinkedServiceIds([]); setServiceSearch(""); setEditing({ step_type: "form", is_mandatory: true, order_index: (steps.at(-1)?.order_index ?? 0) + 10 }); }}>
              <Plus className="h-4 w-4 mr-1" /> Neuer Schritt
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.length === 0 && <p className="text-muted-foreground text-sm">Keine Schritte definiert.</p>}
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3 border rounded-md p-3 bg-card">
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" disabled={!canManage || i === 0} onClick={() => moveStep.mutate({ step, dir: -1 })}><ArrowUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" disabled={!canManage || i === steps.length - 1} onClick={() => moveStep.mutate({ step, dir: 1 })}><ArrowDown className="h-3 w-3" /></Button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{step.name}</span>
                  <Badge variant="secondary">{STEP_TYPES.find((t) => t.value === step.step_type)?.label ?? step.step_type}</Badge>
                  {step.role_required && <Badge variant="outline">{ROLES.find((r) => r.value === step.role_required)?.label ?? step.role_required}</Badge>}
                  {step.is_mandatory && <Badge variant="destructive" className="text-[10px]">Pflicht</Badge>}
                  {step.due_hours && <Badge variant="outline">Frist: {step.due_hours}h</Badge>}
                  {(linksByStep[step.id]?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" />{linksByStep[step.id].length} Dienstleistungen</Badge>
                  )}
                </div>
                {step.description && <p className="text-xs text-muted-foreground mt-1">{step.description}</p>}
                {step.form_id && (
                  <p className="text-xs text-muted-foreground">
                    Formular: {forms.find((f) => f.id === step.form_id)?.name ?? "—"}
                  </p>
                )}
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setLinkedServiceIds(linksByStep[step.id] ?? []); setServiceSearch(""); setEditing(step); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Schritt "${step.name}" löschen?`)) removeStep.mutate(step.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setLinkedServiceIds([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Schritt bearbeiten" : "Neuer Schritt"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Typ</Label>
                  <Select value={editing.step_type ?? "form"} onValueChange={(v) => setEditing({ ...editing, step_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STEP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rolle</Label>
                  <Select value={editing.role_required ?? "__none__"} onValueChange={(v) => setEditing({ ...editing, role_required: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Rolle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— keine —</SelectItem>
                      {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Formular</Label>
                <Select value={editing.form_id ?? "__none__"} onValueChange={(v) => setEditing({ ...editing, form_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Formular wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— kein Formular —</SelectItem>
                    {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Frist (Stunden)</Label><Input type="number" value={editing.due_hours ?? ""} onChange={(e) => setEditing({ ...editing, due_hours: e.target.value ? Number(e.target.value) : null })} /></div>
                <div>
                  <Label>Eskalations-Rolle</Label>
                  <Select value={editing.escalation_role ?? "__none__"} onValueChange={(v) => setEditing({ ...editing, escalation_role: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— keine —</SelectItem>
                      {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_mandatory ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_mandatory: v })} />
                <Label>Pflichtschritt</Label>
              </div>

              {editing.form_id && (
                <StepFormRoleControls
                  formId={editing.form_id}
                  roleViewKey={editing.role_view_key ?? null}
                  lockedFieldIds={(editing.locked_field_ids as string[] | undefined) ?? []}
                  onChangeRoleView={(v) => setEditing({ ...editing, role_view_key: v })}
                  onChangeLocked={(ids) => setEditing({ ...editing, locked_field_ids: ids as any })}
                />
              )}

              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Verknüpfte Dienstleistungen</Label>
                    <p className="text-xs text-muted-foreground">
                      Beim Abschluss dieses Schritts werden alle gewählten Dienstleistungen im Auftrag automatisch auf „Erledigt" gesetzt.
                    </p>
                  </div>
                  <Badge variant="secondary">{linkedServiceIds.length} ausgewählt</Badge>
                </div>
                <Input
                  placeholder="Dienstleistung suchen…"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
                <ScrollArea className="h-56 border rounded-md p-2">
                  <div className="space-y-1">
                    {allServices
                      .filter((s: any) =>
                        !serviceSearch ||
                        (s.service_name ?? "").toLowerCase().includes(serviceSearch.toLowerCase())
                      )
                      .map((s: any) => {
                        const checked = linkedServiceIds.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setLinkedServiceIds((prev) =>
                                  v ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                                );
                              }}
                            />
                            <span className="text-sm flex-1">{s.service_name}</span>
                            {s.category && <Badge variant="outline" className="text-[10px]">{s.category}</Badge>}
                          </label>
                        );
                      })}
                    {allServices.length === 0 && (
                      <p className="text-xs text-muted-foreground p-2">Keine Dienstleistungen verfügbar.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setLinkedServiceIds([]); }}>Abbrechen</Button>
            <Button onClick={() => editing && saveStep.mutate(editing)} disabled={!editing?.name}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepFormRoleControls({
  formId,
  roleViewKey,
  lockedFieldIds,
  onChangeRoleView,
  onChangeLocked,
}: {
  formId: string;
  roleViewKey: string | null;
  lockedFieldIds: string[];
  onChangeRoleView: (v: string | null) => void;
  onChangeLocked: (ids: string[]) => void;
}) {
  const { data: roleViews = [] } = useQuery({
    queryKey: ["form-role-views", formId],
    queryFn: () => api.formRoleViews.list(formId),
  });
  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: () => api.formFields.listForForm(formId),
  });

  const availableRoles = [
    { key: DEFAULT_ROLE_KEY, label: "Standard (Formular-Layout)" },
    ...ROLE_VIEW_PRESETS.filter((p) => roleViews.some((rv) => rv.role_key === p.key)),
    ...roleViews
      .filter((rv) => !ROLE_VIEW_PRESETS.some((p) => p.key === rv.role_key))
      .map((rv) => ({ key: rv.role_key, label: rv.label })),
  ];

  const toggleLock = (id: string, on: boolean) =>
    onChangeLocked(on ? [...lockedFieldIds, id] : lockedFieldIds.filter((x) => x !== id));

  return (
    <div className="border-t pt-3 space-y-3">
      <div>
        <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Rollenansicht</Label>
        <p className="text-xs text-muted-foreground mb-1">
          Welche Rollenansicht des Formulars in diesem Schritt geöffnet wird. Wenn keine passende Ansicht existiert, wird das Standard-Layout verwendet.
        </p>
        <Select
          value={roleViewKey ?? DEFAULT_ROLE_KEY}
          onValueChange={(v) => onChangeRoleView(v === DEFAULT_ROLE_KEY ? null : v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableRoles.map((r) => (
              <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="flex items-center gap-2"><Lock className="h-4 w-4" /> Felder sperren nach Abschluss</Label>
        <p className="text-xs text-muted-foreground mb-1">
          Diese Felder werden für alle Rollen schreibgeschützt, sobald der Schritt abgeschlossen ist.
        </p>
        <ScrollArea className="h-40 border rounded-md p-2">
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">Keine Felder verfügbar (oder Formular gehört nicht zum Formular-Designer).</p>
          )}
          <div className="space-y-1">
            {fields.map((f) => {
              const checked = lockedFieldIds.includes(f.id);
              return (
                <label key={f.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={(v) => toggleLock(f.id, !!v)} />
                  <span className="text-sm flex-1">{f.display_name}</span>
                  <span className="text-xs text-muted-foreground">{f.field_type}</span>
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
