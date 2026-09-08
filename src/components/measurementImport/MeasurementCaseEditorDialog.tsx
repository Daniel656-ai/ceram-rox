import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  MeasurementCase, MeasurementCaseInstance, MeasurementCaseElement,
} from "@/lib/api/measurementCases";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { elementLibrary, libraryElement, formatElementKey, elementKey, parseElementRange } from "@/lib/elementKeys";
import { Checkbox } from "@/components/ui/checkbox";
import { curveEvaluations } from "@/lib/curves/evaluations";
import { emptyCurveConfig, readCaseCurveConfig, type CaseCurveConfig } from "@/lib/measurementBlocks";
import { toast } from "sonner";

/**
 * Messfall direkt am Messblock anlegen/bearbeiten – analog zum Importprofil.
 * Nutzt ausschließlich die bestehende Messfall-Datenstruktur
 * (`measurement_cases` / `measurement_case_instances`).
 */

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] ?? c))
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "messfall";

interface DraftInstance {
  /** Vorhandene Instanz-ID, sonst null (neu). */
  id: string | null;
  label: string;
  method: string | null;
  import_profile_id: string | null;
  context: Record<string, string>;
  /** Messkurven-Vorgaben dieser Messung (Standardachsen, erlaubte Auswertungen). */
  curve: CaseCurveConfig;
}

/** Ein Ergebnis-Element des Messfalls (Auswahl aus der globalen Bibliothek). */
interface DraftElement {
  key: string;
  label: string | null;
  official: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = neuen Messfall anlegen */
  caseDef: MeasurementCase | null;
  onSaved?: (c: MeasurementCase) => void;
}

const emptyInstance = (n: number): DraftInstance => ({
  id: null,
  label: `Messung ${n}`,
  method: null,
  import_profile_id: null,
  context: {},
  curve: emptyCurveConfig(),
});

export default function MeasurementCaseEditorDialog({ open, onOpenChange, caseDef, onSaved }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [instances, setInstances] = useState<DraftInstance[]>([]);
  const [elements, setElements] = useState<DraftElement[]>([]);
  const [elementRange, setElementRange] = useState("");
  const parsedRange = parseElementRange(elementRange);

  const { data: profiles = [] } = useQuery({
    queryKey: ["measurement-import-profiles"],
    queryFn: () => api.measurementImportProfiles.list(),
  });

  useEffect(() => {
    if (!open) return;
    setName(caseDef?.name ?? "");
    setDescription(caseDef?.description ?? "");
    setMethod(caseDef?.method ?? "");
    setIsActive(caseDef?.is_active !== false);
    setElementRange(caseDef?.element_range ?? "");
    setInstances(
      (caseDef?.instances ?? []).map((i: MeasurementCaseInstance) => ({
        id: i.id,
        label: i.label,
        method: i.method ?? null,
        import_profile_id: i.import_profile_id ?? null,
        context: { ...(i.context ?? {}) },
        curve: readCaseCurveConfig((i as any).curve_config),
      }))
    );
    setElements(
      (caseDef?.elements ?? []).map((e: MeasurementCaseElement) => ({
        key: e.element_key,
        label: e.label ?? null,
        official: e.is_official !== false,
      }))
    );
  }, [open, caseDef]);

  const patchInstance = (idx: number, p: Partial<DraftInstance>) =>
    setInstances((prev) => prev.map((x, i) => (i === idx ? { ...x, ...p } : x)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= instances.length) return;
    const next = instances.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setInstances(next);
  };

  const saveElements = async (caseId: string) =>
    api.measurementCases.replaceElements(
      caseId,
      elements.map((e) => ({ element_key: e.key, label: e.label, is_official: e.official }))
    );

  const saveMut = useMutation({
    mutationFn: async (): Promise<MeasurementCase> => {
      if (!name.trim()) throw new Error("Bezeichnung erforderlich");
      if (elementRange.trim() && !parsedRange) {
        throw new Error("Elementbereich ungültig – erwartet z. B. „B-U“ (Elementsymbole).");
      }
      const rangeValue = parsedRange ? `${parsedRange.fromSymbol}-${parsedRange.toSymbol}` : null;
      let target = caseDef;
      if (target) {
        await api.measurementCases.update(target.id, {
          name: name.trim(),
          description: description.trim() || null,
          method: method.trim() || null,
          is_active: isActive,
          element_range: rangeValue,
        });
      } else {
        target = await api.measurementCases.create({
          case_key: slug(name),
          name: name.trim(),
          description: description.trim() || null,
          method: method.trim() || null,
        });
        if (!isActive || rangeValue) {
          await api.measurementCases.update(target.id, { is_active: isActive, element_range: rangeValue });
        }
      }

      // Entfernte Messungen löschen
      const keptIds = new Set(instances.map((i) => i.id).filter(Boolean) as string[]);
      for (const existing of caseDef?.instances ?? []) {
        if (!keptIds.has(existing.id)) await api.measurementCases.removeInstance(existing.id);
      }
      // Messungen anlegen/aktualisieren (Reihenfolge = Position)
      for (let pos = 0; pos < instances.length; pos++) {
        const inst = instances[pos];
        const payload = {
          label: inst.label.trim() || `Messung ${pos + 1}`,
          position: pos,
          method: inst.method?.trim() || null,
          import_profile_id: inst.import_profile_id,
          context: inst.context,
          curve_config: inst.curve,
        };
        if (inst.id) await api.measurementCases.updateInstance(inst.id, payload as any);
        else await api.measurementCases.addInstance({ case_id: target.id, ...payload } as any);
      }
      await saveElements(target.id);
      return target;
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ["measurement-cases"] });
      toast.success("Messfall gespeichert");
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{caseDef ? "Messfall bearbeiten" : "Messfall erstellen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Bezeichnung</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. BET Standard" />
            </div>
            <div>
              <Label className="text-xs">Messmethode</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="z.B. BET" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Beschreibung (optional)</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="case-active" />
            <Label htmlFor="case-active" className="text-xs">
              Aktiv – nur aktive Messfälle stehen bei neuen Messungen zur Auswahl
            </Label>
          </div>

          <CaseElementsEditor value={elements} onChange={setElements} />

          <div className="rounded border p-2 space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Elementbereich (optional, z. B. Standardlos)
            </Label>
            <div className="flex items-center gap-2">
              <Input className="h-8 w-32 font-mono text-xs" placeholder="B-U" value={elementRange}
                onChange={(e) => setElementRange(e.target.value)} />
              {elementRange.trim() && (
                parsedRange
                  ? <span className="text-[11px] text-muted-foreground">
                      {parsedRange.fromSymbol} (Z {parsedRange.from}) bis {parsedRange.toSymbol} (Z {parsedRange.to})
                    </span>
                  : <span className="text-[11px] text-destructive">ungültig – z. B. „B-U“</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Alle importierten Elemente/Oxide, deren Leitelement im Bereich liegt, werden als
              Ergebnisse übernommen – zusätzlich zur festen Liste oben. Ohne Bereich zählen nur
              die oben ausgewählten Ergebnis-Elemente.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Erforderliche Messungen (Reihenfolge)
              </Label>
              <Button size="sm" variant="outline" type="button"
                onClick={() => setInstances((p) => [...p, emptyInstance(p.length + 1)])}>
                <Plus className="h-3.5 w-3.5 mr-1" />Messung
              </Button>
            </div>

            {instances.map((inst, i) => (
              <InstanceEditor
                key={inst.id ?? `new_${i}`}
                index={i}
                instance={inst}
                profiles={profiles as any[]}
                onPatch={(p) => patchInstance(i, p)}
                onMove={(d) => move(i, d)}
                onRemove={() => setInstances((p) => p.filter((_, idx) => idx !== i))}
              />
            ))}
            {instances.length === 0 && (
              <p className="text-xs text-muted-foreground">Noch keine Messung hinterlegt.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstanceEditor({
  index, instance, profiles, onPatch, onMove, onRemove,
}: {
  index: number;
  instance: DraftInstance;
  profiles: Array<{ id: string; name: string }>;
  onPatch: (p: Partial<DraftInstance>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [newKey, setNewKey] = useState("");
  const ctx = instance.context ?? {};
  const setCtx = (key: string, value: string) => onPatch({ context: { ...ctx, [key]: value } });

  return (
    <div className="rounded border p-2 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{index + 1}</Badge>
        <Input className="h-8 flex-1" value={instance.label}
          onChange={(e) => onPatch({ label: e.target.value })} placeholder="z.B. Kalibriert + Pressling" />
        <Button size="icon" variant="ghost" type="button" className="h-8 w-8" onClick={() => onMove(-1)}>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" type="button" className="h-8 w-8" onClick={() => onMove(1)}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" type="button" className="h-8 w-8 text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label className="text-[11px]">Messmethode</Label>
          <Input className="h-8 text-xs" value={instance.method ?? ""} placeholder="z.B. RFA"
            onChange={(e) => onPatch({ method: e.target.value || null })} />
        </div>
        <div>
          <Label className="text-[11px]">Importprofil</Label>
          <Select value={instance.import_profile_id ?? "__none__"}
            onValueChange={(v) => onPatch({ import_profile_id: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Profil wählen…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none__">— beim Import wählen —</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <CurveConfigEditor
        value={instance.curve}
        onChange={(curve) => onPatch({ curve })}
      />
      <div className="space-y-1">
        <Label className="text-[11px]">Vorgabewerte / Messkontext</Label>
        {Object.entries(ctx).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-44 truncate font-mono text-[11px] text-muted-foreground">{k}</span>
            <Input className="h-8 text-xs flex-1" value={String(v ?? "")}
              onChange={(e) => setCtx(k, e.target.value)} />
            <Button size="icon" variant="ghost" type="button" className="h-8 w-8 text-destructive"
              onClick={() => {
                const next = { ...ctx };
                delete next[k];
                onPatch({ context: next });
              }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input className="h-8 text-xs w-44" placeholder="Schlüssel, z.B. probenvorbereitung"
            value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Button size="sm" variant="outline" type="button" disabled={!newKey.trim()}
            onClick={() => { setCtx(newKey.trim(), ""); setNewKey(""); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />Eigenschaft
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Messkurven-Vorgaben eines Messfalls – verfahrensunabhängig.
 * Die Kanalschlüssel stammen aus den importierten Messdaten (z. B. `temp`,
 * `dl_lo`, `alpha`, `dsc`, `mass`); leer = keine Vorgabe, frei wählbar.
 */
function CurveConfigEditor({
  value, onChange,
}: {
  value: CaseCurveConfig;
  onChange: (v: CaseCurveConfig) => void;
}) {
  const patch = (p: Partial<CaseCurveConfig>) => onChange({ ...value, ...p });
  const toggleEval = (id: string, on: boolean) =>
    patch({
      allowed_evaluations: on
        ? [...new Set([...value.allowed_evaluations, id])]
        : value.allowed_evaluations.filter((x) => x !== id),
    });

  return (
    <div className="space-y-2 rounded border bg-background/60 p-2">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Messkurve (optional)
      </Label>
      <div className="grid gap-2 md:grid-cols-4">
        <div>
          <Label className="text-[11px]">Erwarteter Messdatentyp</Label>
          <Input className="h-8 text-xs" placeholder="z.B. DIL, DSC" value={value.measurement_type ?? ""}
            onChange={(e) => patch({ measurement_type: e.target.value || null })} />
        </div>
        <div>
          <Label className="text-[11px]">Standard X-Achse</Label>
          <Input className="h-8 text-xs" placeholder="z.B. temp" value={value.x_key ?? ""}
            onChange={(e) => patch({ x_key: e.target.value || null })} />
        </div>
        <div>
          <Label className="text-[11px]">Standard Y-Achse(n)</Label>
          <Input className="h-8 text-xs" placeholder="z.B. alpha, dl_lo" value={value.y_keys.join(", ")}
            onChange={(e) =>
              patch({ y_keys: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
            } />
        </div>
        <div>
          <Label className="text-[11px]">Zweite Y-Achse</Label>
          <Input className="h-8 text-xs" placeholder="z.B. mass" value={value.y2_key ?? ""}
            onChange={(e) => patch({ y2_key: e.target.value || null })} />
        </div>
      </div>
      <div>
        <Label className="text-[11px]">
          Erlaubte Auswertungen (keine Auswahl = alle passenden)
        </Label>
        <div className="mt-1 grid gap-1 md:grid-cols-2">
          {curveEvaluations.map((ev) => (
            <label key={ev.id} className="flex items-center gap-2 text-[11px]">
              <Checkbox
                checked={value.allowed_evaluations.includes(ev.id)}
                onCheckedChange={(c) => toggleEval(ev.id, c === true)}
              />
              <span>{ev.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}


/**
 * Ergebnis-Elemente des Messfalls: Auswahl und Reihenfolge aus der globalen
 * Elementbibliothek. Diese Liste – und nicht die Unterkategorie oder der
 * Messkontext – bestimmt, welche offiziellen Ergebnisse der Messfall besitzt.
 */
function CaseElementsEditor({
  value, onChange,
}: {
  value: DraftElement[];
  onChange: (v: DraftElement[]) => void;
}) {
  const [pick, setPick] = useState("");
  const [free, setFree] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const add = (raw: string) => {
    const entry = libraryElement(raw);
    if (!entry.key || value.some((v) => v.key === entry.key)) return;
    onChange([...value, { key: entry.key, label: null, official: true }]);
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.length) return;
    const next = value.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const available = elementLibrary.filter((e) => !value.some((v) => v.key === e.key));

  return (
    <div className="space-y-2 rounded border p-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Ergebnis-Elemente ({value.length})
        </Label>
        <span className="text-[11px] text-muted-foreground">
          Reihenfolge per Ziehen ändern
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Diese Auswahl bestimmt die offiziellen Ergebnisse dieses Messfalls. Der
        Messdatenimport erkennt weiterhin alle Elemente der Messdatei.
      </p>

      {value.map((el, i) => (
        <div
          key={el.key}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragIndex != null) move(dragIndex, i); setDragIndex(null); }}
          className="flex items-center gap-2 rounded border bg-muted/20 px-2 py-1"
        >
          <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground" />
          <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
          <span className="w-28 font-medium">{formatElementKey(el.key)}</span>
          <Input
            className="h-8 flex-1 text-xs"
            placeholder="Eigene Bezeichnung (optional)"
            value={el.label ?? ""}
            onChange={(e) =>
              onChange(value.map((x, idx) => (idx === i ? { ...x, label: e.target.value || null } : x)))
            }
          />
          <label className="flex items-center gap-1 text-[11px] whitespace-nowrap">
            <Checkbox
              checked={el.official}
              onCheckedChange={(c) =>
                onChange(value.map((x, idx) => (idx === i ? { ...x, official: c === true } : x)))
              }
            />
            offiziell
          </label>
          <Button size="icon" variant="ghost" type="button" className="h-8 w-8 text-destructive"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Keine Elemente definiert – der Messfall gibt dann keine Ergebnisliste vor.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={pick} onValueChange={(v) => { add(v); setPick(""); }}>
          <SelectTrigger className="h-8 w-64 text-xs">
            <SelectValue placeholder="Element aus Bibliothek wählen…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {available.map((e) => (
              <SelectItem key={e.key} value={e.key}>
                {e.label} · {e.group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="h-8 w-44 text-xs" placeholder="oder eingeben, z.B. V2O5"
          value={free} onChange={(e) => setFree(e.target.value)} />
        <Button size="sm" variant="outline" type="button"
          disabled={!elementKey(free) && !free.trim()}
          onClick={() => { add(free); setFree(""); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Hinzufügen
        </Button>
      </div>
    </div>
  );
}
