import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MeasurementCase, MeasurementCaseInstance } from "@/lib/api/measurementCases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "messfall";

/**
 * Verwaltung der Messfälle (Analyseschemata).
 *
 * Ein Messfall legt fest, welche Messungen für eine Probe erforderlich sind.
 * Messfälle sind reine Konfiguration – im Frontend ist nichts fest codiert.
 */
export default function MeasurementCasesSection() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const { data: cases = [] } = useQuery({ queryKey: ["measurement-cases"], queryFn: () => api.measurementCases.list() });
  const { data: profiles = [] } = useQuery({
    queryKey: ["measurement-import-profiles"],
    queryFn: () => api.measurementImportProfiles.list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["measurement-cases"] });

  const createCase = useMutation({
    mutationFn: () => api.measurementCases.create({ case_key: slug(newName), name: newName.trim() }),
    onSuccess: () => { setNewName(""); invalidate(); toast.success("Messfall angelegt"); },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Neuer Messfall</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Bezeichnung</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z.B. Unbekannte Probe" />
          </div>
          <Button disabled={!newName.trim() || createCase.isPending} onClick={() => createCase.mutate()}>
            <Plus className="h-4 w-4 mr-1" />Anlegen
          </Button>
        </CardContent>
      </Card>

      {cases.map((c) => (
        <CaseEditor key={c.id} caseDef={c} profiles={profiles as any[]} onChanged={invalidate} />
      ))}
      {cases.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Messfälle konfiguriert.</p>
      )}
    </div>
  );
}

function CaseEditor({
  caseDef, profiles, onChanged,
}: { caseDef: MeasurementCase; profiles: Array<{ id: string; name: string }>; onChanged: () => void }) {
  const instances = caseDef.instances ?? [];

  const patchCase = async (updates: Partial<MeasurementCase>) => {
    await api.measurementCases.update(caseDef.id, updates);
    onChanged();
  };

  const addInstance = async () => {
    await api.measurementCases.addInstance({
      case_id: caseDef.id,
      label: `Messung ${instances.length + 1}`,
      position: instances.length,
      method: caseDef.method ?? null,
      context: {},
    });
    onChanged();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= instances.length) return;
    await api.measurementCases.updateInstance(instances[i].id, { position: j });
    await api.measurementCases.updateInstance(instances[j].id, { position: i });
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {caseDef.name}
          <Badge variant="outline" className="font-mono text-[10px]">{caseDef.case_key}</Badge>
          <Badge variant="secondary" className="text-[10px]">
            {instances.length} Messung{instances.length === 1 ? "" : "en"}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive"
            onClick={async () => {
              if (!confirm(`Messfall „${caseDef.name}“ löschen?`)) return;
              await api.measurementCases.remove(caseDef.id);
              onChanged();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Bezeichnung</Label>
            <Input defaultValue={caseDef.name} onBlur={(e) => e.target.value !== caseDef.name && patchCase({ name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Messmethode</Label>
            <Input defaultValue={caseDef.method ?? ""} placeholder="z.B. RFA"
              onBlur={(e) => patchCase({ method: e.target.value || null })} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => patchCase({ is_active: !caseDef.is_active })}>
              {caseDef.is_active ? "Aktiv" : "Inaktiv"}
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Beschreibung</Label>
          <Textarea rows={2} defaultValue={caseDef.description ?? ""}
            onBlur={(e) => patchCase({ description: e.target.value || null })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Erforderliche Messungen</Label>
            <Button size="sm" variant="outline" onClick={addInstance}>
              <Plus className="h-3.5 w-3.5 mr-1" />Messung
            </Button>
          </div>
          {instances.map((inst, i) => (
            <InstanceRow
              key={inst.id}
              index={i}
              instance={inst}
              profiles={profiles}
              onChanged={onChanged}
              onMove={(d) => move(i, d)}
            />
          ))}
          {instances.length === 0 && (
            <p className="text-xs text-muted-foreground">Noch keine Messung hinterlegt.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InstanceRow({
  index, instance, profiles, onChanged, onMove,
}: {
  index: number;
  instance: MeasurementCaseInstance;
  profiles: Array<{ id: string; name: string }>;
  onChanged: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const ctx = instance.context ?? {};
  const patch = async (updates: Partial<MeasurementCaseInstance>) => {
    await api.measurementCases.updateInstance(instance.id, updates);
    onChanged();
  };
  const setCtx = (key: string, value: string) =>
    patch({ context: { ...ctx, [key]: value } as any });

  const [newKey, setNewKey] = useState("");

  return (
    <div className="rounded border p-2 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{index + 1}</Badge>
        <Input className="h-8 flex-1" defaultValue={instance.label}
          onBlur={(e) => e.target.value !== instance.label && patch({ label: e.target.value })} />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMove(-1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMove(1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
          onClick={async () => { await api.measurementCases.removeInstance(instance.id); onChanged(); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label className="text-[11px]">Messmethode</Label>
          <Input className="h-8 text-xs" defaultValue={instance.method ?? ""} placeholder="z.B. RFA"
            onBlur={(e) => patch({ method: e.target.value || null })} />
        </div>
        <div>
          <Label className="text-[11px]">Importprofil</Label>
          <Select value={instance.import_profile_id ?? "__none__"}
            onValueChange={(v) => patch({ import_profile_id: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Profil wählen…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none__">— beim Import wählen —</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Eigenschaften (Messkontext)</Label>
        {Object.entries(ctx).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-44 truncate font-mono text-[11px] text-muted-foreground">{k}</span>
            <Input className="h-8 text-xs flex-1" defaultValue={String(v ?? "")}
              onBlur={(e) => e.target.value !== v && setCtx(k, e.target.value)} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
              onClick={() => {
                const next = { ...ctx };
                delete next[k];
                patch({ context: next as any });
              }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input className="h-8 text-xs w-44" placeholder="Schlüssel, z.B. probenvorbereitung"
            value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Button size="sm" variant="outline" disabled={!newKey.trim()}
            onClick={() => { setCtx(newKey.trim(), ""); setNewKey(""); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />Eigenschaft
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Der Schlüssel entspricht dem Feldschlüssel eines Kontext-Unterfeldes im Messblock
          (z.&nbsp;B. „probenvorbereitung“, „analyseart“). Unbekannte Schlüssel werden als
          Messkontext der Messung gespeichert.
        </p>
      </div>
    </div>
  );
}
