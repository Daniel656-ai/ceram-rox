import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Workflow as WorkflowIcon } from "lucide-react";
import { toast } from "sonner";

interface WorkflowState {
  key: string;
  label: string;
  color?: string;
  description?: string;
}
interface WorkflowTransition {
  from: string;
  to: string;
  label?: string;
}
interface WorkflowDefinition {
  initial?: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

const DEFAULT_DEF: WorkflowDefinition = {
  initial: "open",
  states: [
    { key: "open", label: "Offen", color: "#94a3b8" },
    { key: "in_progress", label: "In Bearbeitung", color: "#f59e0b" },
    { key: "completed", label: "Abgeschlossen", color: "#22c55e" },
  ],
  transitions: [
    { from: "open", to: "in_progress", label: "Starten" },
    { from: "in_progress", to: "completed", label: "Abschließen" },
  ],
};

function slugKey(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export default function WorkflowDesigner({
  serviceId,
  canManage,
}: {
  serviceId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["service-workflow", serviceId],
    queryFn: () => api.serviceWorkflows.getForService(serviceId),
    enabled: !!serviceId,
  });

  const [def, setDef] = useState<WorkflowDefinition>(DEFAULT_DEF);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    const incoming = (data?.definition ?? null) as WorkflowDefinition | null;
    if (incoming && Array.isArray(incoming.states)) {
      setDef({
        initial: incoming.initial ?? incoming.states[0]?.key,
        states: incoming.states,
        transitions: Array.isArray(incoming.transitions) ? incoming.transitions : [],
      });
    } else {
      setDef(DEFAULT_DEF);
    }
    setDirty(false);
  }, [data, isLoading]);

  const save = useMutation({
    mutationFn: () => api.serviceWorkflows.upsert(serviceId, def, user?.id ?? null),
    onSuccess: () => {
      toast.success("Workflow gespeichert");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["service-workflow", serviceId] });
    },
    onError: (e: any) => toast.error(e?.message || "Speichern fehlgeschlagen"),
  });

  const update = (mut: (d: WorkflowDefinition) => WorkflowDefinition) => {
    setDef((prev) => mut(structuredClone(prev)));
    setDirty(true);
  };

  const stateKeys = useMemo(() => def.states.map((s) => s.key), [def]);

  const addState = () => {
    let base = "neu";
    let i = 1;
    while (stateKeys.includes(base)) {
      i += 1;
      base = `neu_${i}`;
    }
    update((d) => ({ ...d, states: [...d.states, { key: base, label: "Neuer Zustand", color: "#64748b" }] }));
  };

  const removeState = (key: string) =>
    update((d) => ({
      ...d,
      initial: d.initial === key ? d.states.find((s) => s.key !== key)?.key : d.initial,
      states: d.states.filter((s) => s.key !== key),
      transitions: d.transitions.filter((t) => t.from !== key && t.to !== key),
    }));

  const moveState = (idx: number, dir: -1 | 1) =>
    update((d) => {
      const arr = [...d.states];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...d, states: arr };
    });

  const patchState = (idx: number, patch: Partial<WorkflowState>) =>
    update((d) => {
      const arr = [...d.states];
      const before = arr[idx];
      const next = { ...before, ...patch };
      // if key changed, update references
      if (patch.key && patch.key !== before.key) {
        const newKey = slugKey(patch.key) || before.key;
        // ensure unique
        if (d.states.some((s, i) => i !== idx && s.key === newKey)) {
          toast.error("Schlüssel existiert bereits");
          return d;
        }
        next.key = newKey;
        d.transitions = d.transitions.map((t) => ({
          ...t,
          from: t.from === before.key ? newKey : t.from,
          to: t.to === before.key ? newKey : t.to,
        }));
        if (d.initial === before.key) d.initial = newKey;
      }
      arr[idx] = next;
      return { ...d, states: arr };
    });

  const addTransition = () =>
    update((d) => {
      if (d.states.length < 1) return d;
      const from = d.states[0].key;
      const to = d.states[1]?.key ?? d.states[0].key;
      return { ...d, transitions: [...d.transitions, { from, to, label: "" }] };
    });

  const patchTransition = (idx: number, patch: Partial<WorkflowTransition>) =>
    update((d) => {
      const arr = [...d.transitions];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...d, transitions: arr };
    });

  const removeTransition = (idx: number) =>
    update((d) => ({ ...d, transitions: d.transitions.filter((_, i) => i !== idx) }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Workflow wird geladen…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Fehler beim Laden des Workflows: {(error as any)?.message || "unbekannt"}
        </CardContent>
      </Card>
    );
  }

  const disabled = !canManage;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <WorkflowIcon className="h-4 w-4" /> Workflow-Definition
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Definiere Zustände und erlaubte Übergänge. Der Startzustand wird beim Anlegen einer neuen Messung gesetzt.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <Badge variant="outline">ungespeichert</Badge>}
            <Button size="sm" onClick={() => save.mutate()} disabled={disabled || !dirty || save.isPending}>
              <Save className="h-4 w-4 mr-1" /> Speichern
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Startzustand</Label>
              <Select
                value={def.initial ?? ""}
                onValueChange={(v) => update((d) => ({ ...d, initial: v }))}
                disabled={disabled || def.states.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Startzustand wählen" />
                </SelectTrigger>
                <SelectContent>
                  {def.states.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label || s.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Zustände</CardTitle>
          <Button size="sm" variant="outline" onClick={addState} disabled={disabled}>
            <Plus className="h-4 w-4 mr-1" /> Zustand hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {def.states.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Zustände definiert.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Reihenfolge</TableHead>
                  <TableHead>Schlüssel</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead className="w-32">Farbe</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {def.states.map((s, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => moveState(idx, -1)} disabled={disabled || idx === 0}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => moveState(idx, 1)} disabled={disabled || idx === def.states.length - 1}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 font-mono text-xs"
                        value={s.key}
                        onChange={(e) => patchState(idx, { key: e.target.value })}
                        disabled={disabled}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        value={s.label}
                        onChange={(e) => patchState(idx, { label: e.target.value })}
                        disabled={disabled}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="color"
                        className="h-8 w-16 p-1"
                        value={s.color || "#64748b"}
                        onChange={(e) => patchState(idx, { color: e.target.value })}
                        disabled={disabled}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeState(s.key)} disabled={disabled}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Übergänge</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Erlaubte Wechsel zwischen Zuständen (from → to).
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addTransition} disabled={disabled || def.states.length < 1}>
            <Plus className="h-4 w-4 mr-1" /> Übergang hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {def.transitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Übergänge definiert.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Von</TableHead>
                  <TableHead>Nach</TableHead>
                  <TableHead>Bezeichnung (optional)</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {def.transitions.map((t, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select value={t.from} onValueChange={(v) => patchTransition(idx, { from: v })} disabled={disabled}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {def.states.map((s) => <SelectItem key={s.key} value={s.key}>{s.label || s.key}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={t.to} onValueChange={(v) => patchTransition(idx, { to: v })} disabled={disabled}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {def.states.map((s) => <SelectItem key={s.key} value={s.key}>{s.label || s.key}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        value={t.label || ""}
                        onChange={(e) => patchTransition(idx, { label: e.target.value })}
                        placeholder="z. B. Starten"
                        disabled={disabled}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeTransition(idx)} disabled={disabled}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vorschau</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {def.states.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <Badge
                style={{ backgroundColor: s.color || undefined, color: "#fff" }}
                variant="secondary"
              >
                {s.label || s.key}
                {def.initial === s.key ? " ★" : ""}
              </Badge>
              {i < def.states.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
