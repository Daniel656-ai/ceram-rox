import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { GlobalCalculation } from "@/lib/api/globalLibrary";
import { FORMULA_FUNCTIONS } from "@/lib/formulaEngine";
import {
  CALC_INPUT_SOURCES,
  CALC_OUTPUT_TARGETS,
  parseInputBindings,
  parseOutputBinding,
  runCalculation,
  type CalcInputBinding,
  type CalcInputSource,
  type CalcOutputBinding,
  type CalcOutputTarget,
} from "@/lib/calculationBindings";
import { listMasterDataTokens } from "@/lib/masterData";
import { listSystemVariables } from "@/lib/systemVariables";

const slug = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

interface Draft {
  id?: string;
  calc_key: string;
  display_name: string;
  description: string;
  formula: string;
  unit: string;
  decimals: number;
  inputs: CalcInputBinding[];
  output: CalcOutputBinding;
}

const emptyDraft = (): Draft => ({
  calc_key: "", display_name: "", description: "", formula: "", unit: "", decimals: 2,
  inputs: [],
  output: { target: "form_field", ref: "" },
});

export default function CalculationsSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [testValues, setTestValues] = useState("");

  const { data: calcs = [] } = useQuery({ queryKey: ["global-calculations"], queryFn: () => api.globalCalculations.list() });
  const { data: globalFields = [] } = useQuery({ queryKey: ["global-fields"], queryFn: () => api.globalFields.list() });
  const { data: catalog = [] } = useQuery({ queryKey: ["master-data-catalog"], queryFn: () => api.masterData.catalog() });

  const systemPaths = useMemo(() => listSystemVariables().map((v) => v.path), []);
  const masterPaths = useMemo(() => listMasterDataTokens(catalog).map((t) => t.path), [catalog]);
  const fieldKeys = useMemo(
    () => (globalFields as any[]).map((f) => f.field_key ?? f.key).filter(Boolean) as string[],
    [globalFields]
  );

  const suggestions = (source: CalcInputSource): string[] => {
    if (source === "system") return systemPaths;
    if (source === "master_data") return masterPaths;
    if (source === "calculation") return calcs.map((c: GlobalCalculation) => c.calc_key);
    if (source === "form_field") return fieldKeys;
    return [];
  };

  const save = useMutation({
    mutationFn: async () => {
      const inputs = draft.inputs.filter((i) => i.variable.trim());
      const payload = {
        calc_key: draft.calc_key || slug(draft.display_name),
        display_name: draft.display_name.trim(),
        description: draft.description.trim() || null,
        formula: draft.formula.trim(),
        unit: draft.unit.trim() || null,
        decimals: draft.decimals,
        inputs: inputs.map((i) => i.variable),
        input_bindings: inputs,
        output_binding: draft.output.ref.trim() ? { ...draft.output, ref: draft.output.ref.trim() } : null,
      };
      if (!payload.display_name || !payload.formula) throw new Error("Bezeichnung und Formel erforderlich");
      if (draft.id) {
        const { calc_key: _k, ...rest } = payload;
        await api.globalCalculations.update(draft.id, rest as any);
      } else {
        await api.globalCalculations.create(payload as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-calculations"] });
      setOpen(false);
      toast.success("Berechnung gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.globalCalculations.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-calculations"] }),
  });

  /** Testwerte: "brenntemperaturen=550;600;650, gewicht=12" */
  const testContext = useMemo(() => {
    const ctx: Record<string, unknown> = {};
    for (const pair of testValues.split(/[\n,]+/)) {
      const idx = pair.indexOf("=");
      if (idx < 0) continue;
      const k = pair.slice(0, idx).trim();
      const raw = pair.slice(idx + 1).trim();
      if (!k) continue;
      ctx[k] = raw.includes(";") ? raw.split(";").map((s) => s.trim()).filter(Boolean) : raw;
    }
    return ctx;
  }, [testValues]);

  const testResult = useMemo(() => {
    if (!draft.formula.trim()) return null;
    const r = runCalculation(
      { calc_key: draft.calc_key, formula: draft.formula, input_bindings: draft.inputs, output_binding: draft.output },
      { formValues: testContext, systemVariables: testContext, calculations: calcs as GlobalCalculation[] }
    );
    if (r.error) return `Fehler: ${r.error}`;
    return r.value != null ? r.value.toFixed(draft.decimals) : "—";
  }, [draft, testContext, calcs]);

  const edit = (c: GlobalCalculation) => {
    setDraft({
      id: c.id, calc_key: c.calc_key, display_name: c.display_name,
      description: c.description ?? "", formula: c.formula, unit: c.unit ?? "", decimals: c.decimals,
      inputs: parseInputBindings(c.input_bindings),
      output: parseOutputBinding(c.output_binding) ?? { target: "form_field", ref: "" },
    });
    setTestValues("");
    setOpen(true);
  };

  const duplicate = (c: GlobalCalculation) => {
    const existing = new Set((calcs as GlobalCalculation[]).map((x) => x.calc_key));
    let key = `${c.calc_key}_kopie`;
    let n = 2;
    while (existing.has(key)) key = `${c.calc_key}_kopie_${n++}`;
    setDraft({
      calc_key: key,
      display_name: `${c.display_name} (Kopie)`,
      description: c.description ?? "", formula: c.formula, unit: c.unit ?? "", decimals: c.decimals,
      inputs: parseInputBindings(c.input_bindings).map((b) => ({ ...b })),
      output: parseOutputBinding(c.output_binding) ?? { target: "form_field", ref: "" },
    });
    setTestValues("");
    setOpen(true);
  };



  const setInput = (i: number, patch: Partial<CalcInputBinding>) =>
    setDraft((d) => ({ ...d, inputs: d.inputs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) }));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-sm">Globale Berechnungen</CardTitle>
        <Button size="sm" onClick={() => { setDraft(emptyDraft()); setTestValues(""); setOpen(true); }}>
          <Plus className="mr-1 h-3.5 w-3.5" />Berechnung
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Schlüssel</TableHead>
              <TableHead>Formel</TableHead>
              <TableHead>Eingänge</TableHead>
              <TableHead>Ausgabe</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {calcs.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Noch keine Berechnungen definiert.</TableCell></TableRow>
            )}
            {calcs.map((c: GlobalCalculation) => {
              const inputs = parseInputBindings(c.input_bindings);
              const output = parseOutputBinding(c.output_binding);
              return (
                <TableRow key={c.id}>
                  <TableCell>{c.display_name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.calc_key}</TableCell>
                  <TableCell className="font-mono text-xs">{c.formula}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {inputs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {inputs.map((i) => <Badge key={i.variable} variant="secondary" className="text-[10px]">{i.variable}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{output ? output.ref : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => edit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => archive.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{draft.id ? "Berechnung bearbeiten" : "Neue globale Berechnung"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bezeichnung</Label><Input value={draft.display_name} onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))} placeholder="z.B. Benötigte Bauteile" /></div>
              <div><Label>Schlüssel</Label><Input value={draft.calc_key} disabled={!!draft.id} onChange={(e) => setDraft((d) => ({ ...d, calc_key: slug(e.target.value) }))} placeholder={slug(draft.display_name) || "benoetigte_bauteile"} /></div>
            </div>

            {/* 1. Eingangsvariablen */}
            <div className="rounded border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">1. Eingangsvariablen</Label>
                <Button size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, inputs: [...d.inputs, { variable: "", source: "form_field", ref: "" }] }))}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Variable
                </Button>
              </div>
              {draft.inputs.length === 0 && (
                <p className="text-xs text-muted-foreground">Noch keine Variablen zugeordnet. Ohne Zuordnung werden Formularwerte direkt über den Feldschlüssel gelesen.</p>
              )}
              <div className="space-y-2">
                {draft.inputs.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_150px_1fr_32px] items-end gap-2">
                    <div>
                      {i === 0 && <Label className="text-xs">Variable</Label>}
                      <Input className="font-mono text-xs" value={b.variable} onChange={(e) => setInput(i, { variable: e.target.value })} placeholder="Brenntemperaturen" />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs">Quelle</Label>}
                      <Select value={b.source} onValueChange={(v) => setInput(i, { source: v as CalcInputSource, ref: "", value: null })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CALC_INPUT_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs">{b.source === "constant" ? "Wert" : "Zuordnung"}</Label>}
                      {b.source === "constant" ? (
                        <Input className="font-mono text-xs" value={String(b.value ?? "")} onChange={(e) => setInput(i, { value: e.target.value })} placeholder="z.B. 3" />
                      ) : (
                        <>
                          <Input
                            list={`calc-src-${b.source}`}
                            className="font-mono text-xs"
                            value={b.ref ?? ""}
                            onChange={(e) => setInput(i, { ref: e.target.value })}
                            placeholder={b.source === "master_data" ? "material.rohdichte" : b.source === "system" ? "auftrag.auftragsnummer" : "feldschluessel"}
                          />
                          <datalist id={`calc-src-${b.source}`}>
                            {suggestions(b.source).map((s) => <option key={s} value={s} />)}
                          </datalist>
                        </>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setDraft((d) => ({ ...d, inputs: d.inputs.filter((_, idx) => idx !== i) }))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Formel */}
            <div className="rounded border p-3">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">2. Formel</Label>
              <Textarea rows={2} className="mt-1 font-mono text-sm" value={draft.formula} onChange={(e) => setDraft((d) => ({ ...d, formula: e.target.value }))} placeholder="CEIL((COUNT(Brenntemperaturen)+1)/2)" />
              <div className="mt-2 flex flex-wrap gap-1">
                {FORMULA_FUNCTIONS.map((f) => (
                  <Badge key={f} variant="outline" className="cursor-pointer text-[10px]" onClick={() => setDraft((d) => ({ ...d, formula: `${d.formula}${f}()` }))}>{f}</Badge>
                ))}
              </div>
              {draft.inputs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {draft.inputs.filter((i) => i.variable).map((i) => (
                    <Badge key={i.variable} variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setDraft((d) => ({ ...d, formula: `${d.formula}${i.variable}` }))}>{i.variable}</Badge>
                  ))}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><Label>Einheit</Label><Input value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="Stk" /></div>
                <div><Label>Nachkommastellen</Label><Input type="number" value={draft.decimals} onChange={(e) => setDraft((d) => ({ ...d, decimals: Number(e.target.value) }))} /></div>
              </div>
            </div>

            {/* 3. Ausgabe */}
            <div className="rounded border p-3">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">3. Ausgabe</Label>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Ziel</Label>
                  <Select value={draft.output.target} onValueChange={(v) => setDraft((d) => ({ ...d, output: { ...d.output, target: v as CalcOutputTarget } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CALC_OUTPUT_TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Zielvariable</Label>
                  <Input className="font-mono text-xs" value={draft.output.ref} onChange={(e) => setDraft((d) => ({ ...d, output: { ...d.output, ref: e.target.value } }))} placeholder="Benoetigte_Bauteile" />
                </div>
              </div>
            </div>

            <div><Label>Beschreibung</Label><Textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></div>

            <div className="rounded border bg-muted/30 p-2">
              <Label className="text-xs">Testwerte (variable=wert, Mehrfachauswahl mit Semikolon)</Label>
              <Input className="mt-1 font-mono text-xs" value={testValues} onChange={(e) => setTestValues(e.target.value)} placeholder="Brenntemperaturen=550;600;650, Chargengewicht=12" />
              <p className="mt-2 text-xs">Ergebnis: <span className="font-mono">{testResult ?? "—"}</span> {draft.unit}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
