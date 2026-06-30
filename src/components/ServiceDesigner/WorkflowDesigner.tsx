import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, ArrowRight, Save, RotateCcw, Flag, CircleCheck,
  Pencil, Workflow as WorkflowIcon, AlertCircle,
} from "lucide-react";
import type {
  ServiceWorkflow, WorkflowDefinition, WorkflowState, WorkflowTransition,
  WorkflowRoleKey,
} from "@/lib/api/serviceWorkflows";

const ROLE_OPTIONS: { value: WorkflowRoleKey; label: string; group: string }[] = [
  { value: "any_authenticated", label: "Alle eingeloggten Nutzer", group: "Allgemein" },
  { value: "creator",           label: "Ersteller des Auftrags",   group: "Beziehung" },
  { value: "project_owner",     label: "Projekteigner",            group: "Projekt-Rolle" },
  { value: "project_leader",    label: "Projektleiter",            group: "Projekt-Rolle" },
  { value: "project_member",    label: "Projektmitarbeiter",       group: "Projekt-Rolle" },
  { value: "role:master",       label: "Master",                   group: "Basisrolle" },
  { value: "role:durchfuehrer", label: "Messdienstleister",        group: "Basisrolle" },
  { value: "role:auftraggeber", label: "Auftraggeber",             group: "Basisrolle" },
  { value: "perm:projects.edit",         label: "Berechtigung: Projekte bearbeiten",  group: "Berechtigung" },
  { value: "perm:raw_materials.manage",  label: "Berechtigung: Rohstoffe verwalten",  group: "Berechtigung" },
  { value: "perm:mixtures.produce",      label: "Berechtigung: Knetungen produzieren",group: "Berechtigung" },
  { value: "perm:admin.system",          label: "Berechtigung: Systemadmin",          group: "Berechtigung" },
];
const ROLE_LABEL = new Map(ROLE_OPTIONS.map((r) => [r.value, r.label]));

const STATE_COLORS = ["#64748b","#3b82f6","#06b6d4","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];

const uid = () => Math.random().toString(36).slice(2, 10);

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "state";
}

function defaultDefinition(): WorkflowDefinition {
  const s1: WorkflowState = { id: uid(), key: "neu",        label: "Neu",        color: "#64748b", is_initial: true };
  const s2: WorkflowState = { id: uid(), key: "in_arbeit",  label: "In Arbeit",  color: "#3b82f6" };
  const s3: WorkflowState = { id: uid(), key: "geprueft",   label: "Geprüft",    color: "#10b981" };
  const s4: WorkflowState = { id: uid(), key: "freigegeben",label: "Freigegeben",color: "#22c55e", is_final: true };
  return {
    states: [s1, s2, s3, s4],
    initial_state: s1.id,
    transitions: [
      { id: uid(), label: "Starten",     from_state: s1.id, to_state: s2.id, allowed_roles: ["role:durchfuehrer","role:master"] },
      { id: uid(), label: "Zur Prüfung", from_state: s2.id, to_state: s3.id, allowed_roles: ["role:durchfuehrer","role:master"] },
      { id: uid(), label: "Freigeben",   from_state: s3.id, to_state: s4.id, allowed_roles: ["project_leader","role:master"], requires_comment: true },
    ],
  };
}

// ================================ Main ================================

export default function WorkflowDesignerTab({
  serviceId, canManage,
}: { serviceId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: saved, isLoading } = useQuery({
    queryKey: ["service-workflow", serviceId],
    queryFn: () => api.serviceWorkflows.get(serviceId),
  });

  const [def, setDef] = useState<WorkflowDefinition>(defaultDefinition());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (saved?.definition?.states?.length) setDef(saved.definition);
    else setDef(defaultDefinition());
    setDirty(false);
  }, [saved]);

  const update = (next: WorkflowDefinition) => { setDef(next); setDirty(true); };

  const save = useMutation({
    mutationFn: () => api.serviceWorkflows.upsert(serviceId, def),
    onSuccess: () => {
      toast.success("Workflow gespeichert");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["service-workflow", serviceId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const reset = () => {
    if (saved?.definition?.states?.length) setDef(saved.definition);
    else setDef(defaultDefinition());
    setDirty(false);
  };

  // ---- state ops ----
  const [editState, setEditState] = useState<WorkflowState | null>(null);
  const [creatingState, setCreatingState] = useState(false);
  const [confirmDeleteState, setConfirmDeleteState] = useState<WorkflowState | null>(null);

  const upsertState = (s: WorkflowState) => {
    const exists = def.states.some((x) => x.id === s.id);
    let states = exists ? def.states.map((x) => x.id === s.id ? s : x) : [...def.states, s];
    // ensure exactly one initial
    if (s.is_initial) states = states.map((x) => x.id === s.id ? x : { ...x, is_initial: false });
    const initial_state = states.find((x) => x.is_initial)?.id ?? states[0]?.id ?? null;
    update({ ...def, states, initial_state });
  };

  const deleteState = (s: WorkflowState) => {
    const states = def.states.filter((x) => x.id !== s.id);
    const transitions = def.transitions.filter((t) => t.from_state !== s.id && t.to_state !== s.id);
    const initial_state = def.initial_state === s.id ? (states[0]?.id ?? null) : def.initial_state;
    update({ ...def, states, transitions, initial_state });
  };

  // ---- transition ops ----
  const [editTr, setEditTr] = useState<WorkflowTransition | null>(null);
  const [creatingTr, setCreatingTr] = useState(false);
  const upsertTransition = (t: WorkflowTransition) => {
    const exists = def.transitions.some((x) => x.id === t.id);
    const transitions = exists ? def.transitions.map((x) => x.id === t.id ? t : x) : [...def.transitions, t];
    update({ ...def, transitions });
  };
  const deleteTransition = (id: string) =>
    update({ ...def, transitions: def.transitions.filter((t) => t.id !== id) });

  const stateById = useMemo(() => new Map(def.states.map((s) => [s.id, s])), [def.states]);

  // ---- validation ----
  const issues = useMemo(() => {
    const arr: string[] = [];
    if (def.states.length === 0) arr.push("Keine Zustände definiert.");
    if (!def.initial_state) arr.push("Kein Startzustand markiert.");
    const finals = def.states.filter((s) => s.is_final);
    if (finals.length === 0) arr.push("Mindestens ein Endzustand sollte markiert werden.");
    // unreachable
    if (def.initial_state) {
      const reachable = new Set<string>([def.initial_state]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of def.transitions) {
          const sources = t.from_state === "*" ? def.states.map((s) => s.id) : [t.from_state];
          if (sources.some((s) => reachable.has(s)) && !reachable.has(t.to_state)) {
            reachable.add(t.to_state); changed = true;
          }
        }
      }
      for (const s of def.states) {
        if (!reachable.has(s.id)) arr.push(`Zustand „${s.label}" ist nicht erreichbar.`);
      }
    }
    return arr;
  }, [def]);

  if (isLoading) return <Card><CardContent className="p-6 text-muted-foreground">Lade …</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <WorkflowIcon className="h-4 w-4" />
          {def.states.length} Zustand/Zustände · {def.transitions.length} Übergang/Übergänge
          {dirty && <Badge variant="outline" className="text-amber-600 border-amber-400">Ungespeichert</Badge>}
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={reset} disabled={!dirty}>
                <RotateCcw className="h-4 w-4 mr-1" /> Verwerfen
              </Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                <Save className="h-4 w-4 mr-1" /> Speichern
              </Button>
            </>
          )}
        </div>
      </div>

      {issues.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/10">
          <CardContent className="p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium text-amber-700">
              <AlertCircle className="h-4 w-4" /> Hinweise
            </div>
            <ul className="list-disc list-inside text-amber-700/90 text-xs space-y-0.5">
              {issues.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* States */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Flag className="h-4 w-4" />Zustände</CardTitle>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setCreatingState(true)}>
                <Plus className="h-4 w-4 mr-1" /> Zustand
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-1.5">
            {def.states.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Zustände.</p>}
            {def.states.map((s) => (
              <div key={s.id} className="flex items-center gap-2 border rounded-md p-2">
                <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {s.label}
                    {s.is_initial && <Badge variant="secondary" className="text-[9px]">Start</Badge>}
                    {s.is_final && <Badge variant="secondary" className="text-[9px]">Ende</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    <code>{s.key}</code>{s.sla_hours ? ` · SLA ${s.sla_hours}h` : ""}
                  </div>
                </div>
                {canManage && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditState(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDeleteState(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Transitions */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><ArrowRight className="h-4 w-4" />Übergänge</CardTitle>
            {canManage && (
              <Button size="sm" variant="outline" disabled={def.states.length < 2} onClick={() => setCreatingTr(true)}>
                <Plus className="h-4 w-4 mr-1" /> Übergang
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-1.5">
            {def.transitions.length === 0 && (
              <p className="text-xs text-muted-foreground">Noch keine Übergänge definiert.</p>
            )}
            {def.transitions.map((t) => {
              const from = t.from_state === "*" ? null : stateById.get(t.from_state);
              const to = stateById.get(t.to_state);
              return (
                <div key={t.id} className="border rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium flex-1 min-w-0 truncate">{t.label}</div>
                    {canManage && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTr(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTransition(t.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <StatePill state={from} fallback="Beliebig" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <StatePill state={to} />
                    {t.requires_comment && <Badge variant="outline" className="text-[9px]">Kommentar Pflicht</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.allowed_roles.length === 0 && (
                      <span className="text-[10px] text-destructive">Keine Rolle erlaubt!</span>
                    )}
                    {t.allowed_roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[9px]">{ROLE_LABEL.get(r) ?? r}</Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Flow diagram */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ablauf-Vorschau</CardTitle></CardHeader>
        <CardContent>
          <FlowDiagram def={def} />
        </CardContent>
      </Card>

      {/* Role/State permission matrix */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Rollen-Übergangsmatrix</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <RoleMatrix def={def} />
        </CardContent>
      </Card>

      {(editState || creatingState) && (
        <StateDialog
          state={editState}
          existingKeys={def.states.map((s) => s.key)}
          onClose={() => { setEditState(null); setCreatingState(false); }}
          onSave={(s) => { upsertState(s); setEditState(null); setCreatingState(false); }}
        />
      )}

      {(editTr || creatingTr) && (
        <TransitionDialog
          transition={editTr}
          states={def.states}
          onClose={() => { setEditTr(null); setCreatingTr(false); }}
          onSave={(t) => { upsertTransition(t); setEditTr(null); setCreatingTr(false); }}
        />
      )}

      <AlertDialog open={!!confirmDeleteState} onOpenChange={(o) => !o && setConfirmDeleteState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zustand löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{confirmDeleteState?.label}" und alle damit verbundenen Übergänge werden entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDeleteState) deleteState(confirmDeleteState); setConfirmDeleteState(null); }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================ Helpers ============================

function StatePill({ state, fallback }: { state?: WorkflowState | null; fallback?: string }) {
  if (!state) {
    return <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px]">{fallback ?? "—"}</span>;
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] text-white" style={{ background: state.color }}>
      {state.label}
    </span>
  );
}

function FlowDiagram({ def }: { def: WorkflowDefinition }) {
  if (def.states.length === 0) {
    return <p className="text-xs text-muted-foreground">Noch nichts zu zeigen.</p>;
  }
  // BFS layers from initial
  const stateById = new Map(def.states.map((s) => [s.id, s]));
  const layers: string[][] = [];
  const visited = new Set<string>();
  let frontier: string[] = def.initial_state ? [def.initial_state] : [def.states[0].id];
  while (frontier.length) {
    const layer: string[] = [];
    const next: string[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      layer.push(id);
      for (const t of def.transitions) {
        const sources = t.from_state === "*" ? def.states.map((s) => s.id) : [t.from_state];
        if (sources.includes(id) && !visited.has(t.to_state)) next.push(t.to_state);
      }
    }
    if (layer.length) layers.push(layer);
    frontier = next;
  }
  // append orphans
  const orphans = def.states.filter((s) => !visited.has(s.id)).map((s) => s.id);
  if (orphans.length) layers.push(orphans);

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {layers.map((layer, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex flex-col gap-2">
            {layer.map((id) => {
              const s = stateById.get(id)!;
              const outgoing = def.transitions.filter((t) => t.from_state === id || t.from_state === "*");
              return (
                <div key={id} className="border rounded-md p-2 min-w-[140px] bg-card">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                    <span className="text-sm font-medium truncate">{s.label}</span>
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {s.is_initial && <Badge variant="secondary" className="text-[9px]">Start</Badge>}
                    {s.is_final && <Badge variant="secondary" className="text-[9px]">Ende</Badge>}
                  </div>
                  {outgoing.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {outgoing.map((t) => {
                        const to = stateById.get(t.to_state);
                        return (
                          <div key={t.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <ArrowRight className="h-3 w-3" />
                            <span className="truncate">{t.label}</span>
                            {to && <span>→ <span style={{ color: to.color }}>{to.label}</span></span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {i < layers.length - 1 && <ArrowRight className="h-5 w-5 text-muted-foreground self-center" />}
        </div>
      ))}
    </div>
  );
}

function RoleMatrix({ def }: { def: WorkflowDefinition }) {
  if (def.states.length === 0 || def.transitions.length === 0) {
    return <p className="text-xs text-muted-foreground">Sobald Zustände und Übergänge bestehen, erscheint hier die Matrix.</p>;
  }
  const stateById = new Map(def.states.map((s) => [s.id, s]));
  return (
    <table className="text-xs w-full min-w-[640px]">
      <thead>
        <tr className="border-b">
          <th className="text-left p-2 font-medium">Rolle</th>
          {def.transitions.map((t) => (
            <th key={t.id} className="text-left p-2 font-medium whitespace-nowrap">
              <div>{t.label}</div>
              <div className="text-[10px] text-muted-foreground font-normal">
                {t.from_state === "*" ? "Beliebig" : stateById.get(t.from_state)?.label}
                {" → "}
                {stateById.get(t.to_state)?.label}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROLE_OPTIONS.map((r) => (
          <tr key={r.value} className="border-b last:border-b-0">
            <td className="p-2">{r.label}</td>
            {def.transitions.map((t) => (
              <td key={t.id} className="p-2 text-center">
                {t.allowed_roles.includes(r.value)
                  ? <CircleCheck className="h-4 w-4 text-emerald-600 inline" />
                  : <span className="text-muted-foreground">—</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================ State Dialog ============================

function StateDialog({
  state, existingKeys, onClose, onSave,
}: {
  state: WorkflowState | null;
  existingKeys: string[];
  onClose: () => void;
  onSave: (s: WorkflowState) => void;
}) {
  const isEdit = !!state;
  const [form, setForm] = useState<WorkflowState>(state ?? {
    id: uid(), key: "", label: "", color: STATE_COLORS[0],
  });
  const [keyEdited, setKeyEdited] = useState(isEdit);

  const collidingKey = !isEdit && existingKeys.includes(form.key);
  const valid = form.label.trim().length > 0 && form.key.trim().length > 0 && !collidingKey;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Zustand bearbeiten" : "Neuer Zustand"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Bezeichnung</Label>
            <Input
              value={form.label}
              onChange={(e) => {
                const label = e.target.value;
                setForm((f) => ({ ...f, label, key: keyEdited ? f.key : slug(label) }));
              }}
              placeholder="z. B. In Prüfung"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Schlüssel (Code)</Label>
            <Input
              value={form.key}
              disabled={isEdit}
              onChange={(e) => { setKeyEdited(true); setForm((f) => ({ ...f, key: slug(e.target.value) })); }}
            />
            {collidingKey && <p className="text-[11px] text-destructive">Schlüssel existiert bereits.</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Beschreibung</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Farbe</Label>
              <div className="flex gap-1.5 flex-wrap">
                {STATE_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`h-7 w-7 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SLA (Stunden, optional)</Label>
              <Input type="number" min={0} step={0.5}
                value={form.sla_hours ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, sla_hours: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!form.is_initial} onCheckedChange={(c) => setForm((f) => ({ ...f, is_initial: c, is_final: c ? false : f.is_final }))} />
              Startzustand
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!form.is_final} onCheckedChange={(c) => setForm((f) => ({ ...f, is_final: c, is_initial: c ? false : f.is_initial }))} />
              Endzustand
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!valid} onClick={() => onSave(form)}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================== Transition Dialog ===========================

function TransitionDialog({
  transition, states, onClose, onSave,
}: {
  transition: WorkflowTransition | null;
  states: WorkflowState[];
  onClose: () => void;
  onSave: (t: WorkflowTransition) => void;
}) {
  const isEdit = !!transition;
  const [form, setForm] = useState<WorkflowTransition>(transition ?? {
    id: uid(), label: "", from_state: states[0]?.id ?? "*", to_state: states[1]?.id ?? states[0]?.id ?? "",
    allowed_roles: ["role:master"], requires_comment: false,
  });
  const valid = form.label.trim().length > 0 && form.to_state && form.allowed_roles.length > 0 && form.from_state !== form.to_state;

  const toggleRole = (r: WorkflowRoleKey) => {
    setForm((f) => ({
      ...f,
      allowed_roles: f.allowed_roles.includes(r)
        ? f.allowed_roles.filter((x) => x !== r)
        : [...f.allowed_roles, r],
    }));
  };

  const grouped = useMemo(() => {
    const g = new Map<string, typeof ROLE_OPTIONS>();
    for (const r of ROLE_OPTIONS) {
      if (!g.has(r.group)) g.set(r.group, [] as any);
      g.get(r.group)!.push(r);
    }
    return Array.from(g.entries());
  }, []);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? "Übergang bearbeiten" : "Neuer Übergang"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Aktionsname</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="z. B. Freigeben" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Von Zustand</Label>
              <Select value={form.from_state} onValueChange={(v) => setForm((f) => ({ ...f, from_state: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">Beliebiger Zustand</SelectItem>
                  {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nach Zustand</Label>
              <Select value={form.to_state} onValueChange={(v) => setForm((f) => ({ ...f, to_state: v }))}>
                <SelectTrigger><SelectValue placeholder="Zielzustand …" /></SelectTrigger>
                <SelectContent>
                  {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Wer darf diesen Übergang ausführen?</Label>
            <div className="border rounded-md p-2 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1 max-h-60 overflow-y-auto">
              {grouped.map(([group, items]) => (
                <div key={group} className="space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{group}</div>
                  {items.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.allowed_roles.includes(r.value)}
                        onCheckedChange={() => toggleRole(r.value)}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            {form.allowed_roles.length === 0 && (
              <p className="text-[11px] text-destructive">Mindestens eine Rolle wählen.</p>
            )}
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!form.requires_comment} onCheckedChange={(c) => setForm((f) => ({ ...f, requires_comment: c }))} />
              Kommentar erforderlich
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!form.notify} onCheckedChange={(c) => setForm((f) => ({ ...f, notify: c }))} />
              Benachrichtigung senden
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!valid} onClick={() => onSave(form)}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
