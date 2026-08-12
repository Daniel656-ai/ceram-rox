import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Copy, Calculator, AlertTriangle } from "lucide-react";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { FormField } from "@/lib/api/formFields";
import type {
  CalcToken, CalcOperator, CalcRounding, FormCalculation,
} from "@/lib/api/formCalculations";
import {
  buildFormulaFromTokens, isCalcInputField, wouldCreateCycle,
  evaluateLocalCalculations, formatCalcResult,
} from "@/lib/localCalculations";
import { extractReferences, FORMULA_FUNCTIONS } from "@/lib/formulaEngine";

const OPERATORS: { v: CalcOperator; l: string }[] = [
  { v: "+", l: "+" }, { v: "-", l: "−" }, { v: "*", l: "×" }, { v: "/", l: "÷" },
];

const ROUNDINGS: { v: CalcRounding; l: string }[] = [
  { v: "round", l: "Kaufmännisch runden" },
  { v: "floor", l: "Abrunden" },
  { v: "ceil", l: "Aufrunden" },
  { v: "none", l: "Nicht runden" },
];

const slug = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

interface Draft {
  id?: string;
  calc_key: string;
  display_name: string;
  description: string;
  unit: string;
  decimals: number;
  rounding: CalcRounding;
  tokens: CalcToken[];
  advanced: boolean;
  formula: string;
  is_result: boolean;
  result_label: string;
}

const emptyDraft = (): Draft => ({
  calc_key: "", display_name: "", description: "", unit: "", decimals: 2,
  rounding: "round",
  tokens: [{ type: "operand", source: "field", ref: "" }],
  advanced: false,
  formula: "",
  is_result: false,
  result_label: "",
});

export default function LocalCalculationsPanel({
  form, canManage,
}: { form: FormDefinition; canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [testValues, setTestValues] = useState<Record<string, number>>({});

  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });
  const { data: calcs = [] } = useQuery({
    queryKey: ["form-calculations", form.id],
    queryFn: () => api.formCalculations.listForForm(form.id),
  });

  /** Nur rechenbare Felder des aktuellen Formulars (keine Textfelder/Überschriften). */
  const numericFields = useMemo(
    () => fields.filter((f) => isCalcInputField(f.field_type)),
    [fields]
  );
  const fieldLabel = (key: string) =>
    fields.find((f) => f.field_key === key)?.display_name
    ?? calcs.find((c) => c.calc_key === key)?.display_name
    ?? key;

  const formula = draft.advanced ? draft.formula : buildFormulaFromTokens(draft.tokens);

  const cycle = useMemo(() => {
    const key = draft.calc_key || slug(draft.display_name);
    if (!key || !formula.trim()) return false;
    return wouldCreateCycle(calcs as FormCalculation[], { calc_key: key, formula });
  }, [calcs, draft.calc_key, draft.display_name, formula]);

  const previewValue = useMemo(() => {
    const key = draft.calc_key || slug(draft.display_name) || "__draft";
    const merged = [
      ...(calcs as FormCalculation[]).filter((c) => c.calc_key !== key),
      { ...(emptyStub()), id: "draft", form_id: form.id, calc_key: key, display_name: draft.display_name, formula, decimals: draft.decimals, rounding: draft.rounding } as FormCalculation,
    ];
    const res = evaluateLocalCalculations(merged, testValues);
    return res[key];
  }, [calcs, draft, formula, testValues, form.id]);

  const referenced = useMemo(
    () => extractReferences(formula).filter((r) => !FORMULA_FUNCTIONS.includes(r)),
    [formula]
  );

  const openNew = () => { setDraft(emptyDraft()); setTestValues({}); setOpen(true); };
  const openEdit = (c: FormCalculation) => {
    const tokens = Array.isArray(c.expression) && c.expression.length ? (c.expression as CalcToken[]) : [];
    setDraft({
      id: c.id,
      calc_key: c.calc_key,
      display_name: c.display_name,
      description: c.description ?? "",
      unit: c.unit ?? "",
      decimals: c.decimals ?? 2,
      rounding: (c.rounding as CalcRounding) ?? "round",
      tokens: tokens.length ? tokens : [{ type: "operand", source: "field", ref: "" }],
      advanced: tokens.length === 0,
      formula: c.formula ?? "",
    });
    setTestValues({});
    setOpen(true);
  };
  const openCopy = (c: FormCalculation) => {
    openEdit(c);
    setDraft((d) => ({ ...d, id: undefined, calc_key: `${c.calc_key}_kopie`, display_name: `${c.display_name} (Kopie)` }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const name = draft.display_name.trim();
      if (!name) throw new Error("Bitte einen Namen angeben");
      const f = formula.trim();
      if (!f) throw new Error("Die Berechnung enthält noch keine Formel");
      const key = draft.calc_key || slug(name);
      if (cycle) throw new Error("Zyklische Abhängigkeit – bitte Formel anpassen");
      const payload = {
        form_id: form.id,
        calc_key: key,
        display_name: name,
        description: draft.description.trim() || null,
        formula: f,
        expression: draft.advanced ? [] : draft.tokens,
        inputs: referenced,
        unit: draft.unit.trim() || null,
        decimals: draft.decimals,
        rounding: draft.rounding,
      };
      if (draft.id) {
        const { form_id: _f, ...rest } = payload;
        await api.formCalculations.update(draft.id, rest as any);
      } else {
        await api.formCalculations.create(payload as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form-calculations", form.id] });
      setOpen(false);
      toast.success("Berechnung gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.formCalculations.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form-calculations", form.id] });
      toast.success("Berechnung gelöscht");
    },
  });

  // ---- Token-Operationen ----
  const setToken = (i: number, patch: Partial<CalcToken>) =>
    setDraft((d) => ({ ...d, tokens: d.tokens.map((t, idx) => idx === i ? ({ ...t, ...patch } as CalcToken) : t) }));
  const addOperand = () =>
    setDraft((d) => ({
      ...d,
      tokens: [...d.tokens, { type: "op", op: "+" } as CalcToken, { type: "operand", source: "field", ref: "" } as CalcToken],
    }));
  const removeOperand = (i: number) =>
    setDraft((d) => {
      const t = d.tokens.slice();
      t.splice(i, 1);
      if (t[i - 1]?.type === "op") t.splice(i - 1, 1);
      else if (t[0]?.type === "op") t.splice(0, 1);
      return { ...d, tokens: t.length ? t : [{ type: "operand", source: "field", ref: "" }] };
    });

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Lokale Berechnungen
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Gehören nur zu diesem Formular und greifen direkt auf dessen Felder zu.
              Globale Berechnungen bleiben davon unberührt.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Neue Berechnung</Button>
          )}
        </CardHeader>
        <CardContent>
          {calcs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center border rounded">
              Noch keine lokalen Berechnungen. Lege z.&nbsp;B. „Volumen = Länge × Breite × Höhe“ an.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Berechnung</TableHead>
                  <TableHead className="w-24">Einheit</TableHead>
                  <TableHead className="w-24">Nachkomma</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(calcs as FormCalculation[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{c.display_name}</div>
                      {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {extractReferences(c.formula).length
                        ? c.formula.split(/\s+/).map((p, i) =>
                            /^[a-zA-Z_]/.test(p)
                              ? <Badge key={i} variant="secondary" className="mr-1 mb-1">{fieldLabel(p)}</Badge>
                              : <span key={i} className="mr-1">{p}</span>)
                        : <span className="text-muted-foreground">{c.formula}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{c.unit ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.decimals}</TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCopy(c)} title="Kopieren"><Copy className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)} title="Bearbeiten"><Pencil className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Löschen"
                            onClick={() => { if (confirm(`Berechnung „${c.display_name}" löschen?`)) remove.mutate(c.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Berechnung bearbeiten" : "Neue lokale Berechnung"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name der Berechnung *</Label>
                <Input value={draft.display_name} placeholder="z. B. Volumen"
                  onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Beschreibung (optional)</Label>
                <Input value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
              </div>
            </div>

            {/* Visueller Builder */}
            <div className="border rounded p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide">Berechnung</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Erweiterter Formel-Editor</span>
                  <Switch checked={draft.advanced}
                    onCheckedChange={(v) => setDraft((d) => ({
                      ...d, advanced: v,
                      formula: v && !d.formula ? buildFormulaFromTokens(d.tokens) : d.formula,
                    }))} />
                </div>
              </div>

              {!draft.advanced ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    {draft.tokens.map((t, i) => t.type === "op" ? (
                      <Select key={i} value={t.op} onValueChange={(v) => setToken(i, { op: v as CalcOperator } as any)}>
                        <SelectTrigger className="w-16 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div key={i} className="flex items-center gap-1">
                        {t.source === "const" ? (
                          <Input type="number" className="w-28 h-9" value={t.value ?? ""}
                            onChange={(e) => setToken(i, { value: e.target.value === "" ? null : Number(e.target.value) } as any)} />
                        ) : (
                          <Select
                            value={t.ref || "__none__"}
                            onValueChange={(v) => {
                              if (v === "__const__") { setToken(i, { source: "const", ref: null, value: 0 } as any); return; }
                              const isCalc = (calcs as FormCalculation[]).some((c) => c.calc_key === v);
                              setToken(i, { source: isCalc ? "calc" : "field", ref: v === "__none__" ? "" : v } as any);
                            }}
                          >
                            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Feld wählen" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Feld wählen —</SelectItem>
                              <SelectGroup>
                                <SelectLabel>Formularfelder</SelectLabel>
                                {numericFields.map((f: FormField) => (
                                  <SelectItem key={f.id} value={f.field_key}>
                                    {f.display_name}{f.unit ? ` [${f.unit}]` : ""}
                                  </SelectItem>
                                ))}
                                {numericFields.length === 0 && <SelectItem value="__empty__" disabled>Keine rechenbaren Felder</SelectItem>}
                              </SelectGroup>
                              {(calcs as FormCalculation[]).filter((c) => c.id !== draft.id).length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Andere Berechnungen</SelectLabel>
                                  {(calcs as FormCalculation[]).filter((c) => c.id !== draft.id).map((c) => (
                                    <SelectItem key={c.id} value={c.calc_key}>{c.display_name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              <SelectGroup>
                                <SelectLabel>Sonstiges</SelectLabel>
                                <SelectItem value="__const__">Fester Wert …</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                        {draft.tokens.filter((x) => x.type === "operand").length > 1 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeOperand(i)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={addOperand}>
                      <Plus className="h-3 w-3 mr-1" />Größe
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Es werden ausschließlich rechenbare Felder dieses Formulars angeboten – technische Schlüssel sind nicht nötig.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea rows={3} className="font-mono text-xs" value={draft.formula}
                    placeholder="z. B. (m_nass - m_trocken) / m_trocken"
                    onChange={(e) => setDraft((d) => ({ ...d, formula: e.target.value }))} />
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Feld einfügen</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2 max-h-72 overflow-y-auto">
                        <p className="text-[11px] text-muted-foreground px-1 pb-1">Formularfelder</p>
                        {numericFields.map((f) => (
                          <button key={f.id} type="button"
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                            onClick={() => setDraft((d) => ({ ...d, formula: `${d.formula}${d.formula && !d.formula.endsWith(" ") ? " " : ""}${f.field_key} ` }))}>
                            {f.display_name}
                          </button>
                        ))}
                        {(calcs as FormCalculation[]).length > 0 && (
                          <>
                            <p className="text-[11px] text-muted-foreground px-1 py-1">Berechnungen</p>
                            {(calcs as FormCalculation[]).filter((c) => c.id !== draft.id).map((c) => (
                              <button key={c.id} type="button"
                                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                                onClick={() => setDraft((d) => ({ ...d, formula: `${d.formula}${d.formula && !d.formula.endsWith(" ") ? " " : ""}${c.calc_key} ` }))}>
                                {c.display_name}
                              </button>
                            ))}
                          </>
                        )}
                      </PopoverContent>
                    </Popover>
                    <span className="text-[11px] text-muted-foreground">
                      Funktionen: {FORMULA_FUNCTIONS.slice(0, 8).join(", ")} …
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Ergebnis ={" "}
                {referenced.length
                  ? formula.split(/\s+/).map((p, i) => /^[a-zA-Z_]/.test(p)
                      ? <Badge key={i} variant="secondary" className="mr-1">{fieldLabel(p)}</Badge>
                      : <span key={i} className="mr-1">{p}</span>)
                  : <span>{formula || "—"}</span>}
              </div>

              {cycle && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Zyklische Abhängigkeit erkannt – diese Berechnung verweist (indirekt) auf sich selbst.
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Einheit (optional)</Label>
                <Input value={draft.unit} placeholder="kg" onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nachkommastellen</Label>
                <Input type="number" min={0} max={6} value={draft.decimals}
                  onChange={(e) => setDraft((d) => ({ ...d, decimals: Math.max(0, Number(e.target.value) || 0) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rundungsregel</Label>
                <Select value={draft.rounding} onValueChange={(v) => setDraft((d) => ({ ...d, rounding: v as CalcRounding }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUNDINGS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live-Test */}
            {referenced.length > 0 && (
              <div className="border rounded p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wide">Test</Label>
                <div className="grid grid-cols-3 gap-2">
                  {referenced.map((r) => (
                    <div key={r} className="space-y-1">
                      <Label className="text-[11px]">{fieldLabel(r)}</Label>
                      <Input type="number" className="h-8" value={testValues[r] ?? ""}
                        onChange={(e) => setTestValues((v) => ({ ...v, [r]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
                <p className="text-sm">
                  Ergebnis:{" "}
                  <strong>{formatCalcResult(previewValue?.value ?? null, draft.decimals, draft.unit || null)}</strong>
                  {previewValue?.error && <span className="text-destructive ml-2 text-xs">{previewValue.error}</span>}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || cycle}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyStub(): Partial<FormCalculation> {
  return {
    description: null, expression: [], inputs: [], unit: null,
    result_type: "decimal", sort_order: 0,
    created_at: "", updated_at: "",
  };
}
