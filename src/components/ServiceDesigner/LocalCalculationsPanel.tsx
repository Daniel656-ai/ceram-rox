import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SymbolPickerButton, SymbolInput } from "@/components/forms/SymbolInput";
import RichText from "@/components/forms/RichText";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Copy, Calculator, AlertTriangle, HelpCircle } from "lucide-react";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { FormField } from "@/lib/api/formFields";
import type {
  CalcToken, CalcOperator, CalcRounding, FormCalculation,
} from "@/lib/api/formCalculations";
import {
  buildFormulaFromTokens, isCalcInputFieldDef, wouldCreateCycle,
  evaluateLocalCalculations, formatCalcResult,
} from "@/lib/localCalculations";
import { extractReferences, FORMULA_FUNCTIONS, formulaFunctionLabel } from "@/lib/formulaEngine";
import { readValueSource, isLinkedField, linkOriginLabel } from "@/lib/fieldLinks";

const OPERATORS: { v: CalcOperator; l: string }[] = [
  { v: "+", l: "+" }, { v: "-", l: "−" }, { v: "*", l: "×" }, { v: "/", l: "÷" },
];

const ROUNDINGS: { v: CalcRounding; l: string }[] = [
  { v: "round", l: "Kaufmännisch runden" },
  { v: "floor", l: "Abrunden" },
  { v: "ceil", l: "Aufrunden" },
  { v: "none", l: "Nicht runden" },
];

/**
 * Fügt eine Referenz an die Formel an und ergänzt dabei das nötige Trennzeichen:
 * innerhalb einer offenen Funktionsklammer ein Komma, sonst ein Leerzeichen.
 */
function appendRef(formula: string, ref: string): string {
  const src = formula ?? "";
  const trimmed = src.replace(/\s+$/, "");
  if (!trimmed) return `${ref} `;
  const last = trimmed[trimmed.length - 1];
  const endsWithValue = /[A-Za-z0-9_ÄÖÜäöüß)\]]/.test(last);
  if (!endsWithValue) return `${trimmed}${last === "(" || last === "," ? "" : " "}${ref} `;
  // Offene Funktionsklammer? -> Parameter mit Komma trennen.
  const opened = (trimmed.match(/\(/g) ?? []).length - (trimmed.match(/\)/g) ?? []).length;
  return opened > 0 ? `${trimmed}, ${ref} ` : `${trimmed} ${ref} `;
}

/** Kompakte Syntaxhilfe für den erweiterten Formel-Editor. */
function FormulaSyntaxHelp() {
  const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{children}</code>
  );
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">Grundsyntax</p>
        <Code>FUNKTION(Parameter1, Parameter2, Parameter3)</Code>
        <p className="text-muted-foreground mt-1">
          Parameter werden immer mit Komma getrennt, jede Funktion braucht eine öffnende und
          eine schließende Klammer.
        </p>
      </div>
      <div>
        <p className="font-medium">Funktionen</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          <li><Code>SUM(Feld1, Feld2, Feld3)</Code> – Summe</li>
          <li><Code>AVERAGE(Feld1, Feld2, Feld3)</Code> – Mittelwert</li>
          <li><Code>MIN(Feld1, Feld2)</Code> / <Code>MAX(Feld1, Feld2)</Code></li>
          <li><Code>COUNT(Feld1, Feld2)</Code> – Anzahl Werte</li>
          <li><Code>MEDIAN(Feld1, Feld2, Feld3)</Code></li>
          <li><Code>ROUND(Wert, Nachkommastellen)</Code>, <Code>CEIL(x)</Code>, <Code>FLOOR(x)</Code></li>
          <li><Code>ABS(x)</Code>, <Code>SQRT(x)</Code>, <Code>POW(x, n)</Code>, <Code>IF(Bedingung, Dann, Sonst)</Code></li>
        </ul>
      </div>
      <div>
        <p className="font-medium">Operatoren</p>
        <p className="text-muted-foreground">
          <Code>+</Code> <Code>-</Code> <Code>*</Code> <Code>/</Code> <Code>%</Code> sowie Klammern
          zur Gruppierung: <Code>(a - b) / b</Code>
        </p>
      </div>
      <div>
        <p className="font-medium">Feldreferenzen</p>
        <p className="text-muted-foreground">
          Verwendet wird der technische Feldschlüssel (z. B. <Code>porenvolumen_1</Code>), nicht
          die Bezeichnung. Am einfachsten über „Feld einfügen“ – das Trennzeichen wird automatisch
          gesetzt. Andere Berechnungen dieses Formulars sind über ihren Schlüssel nutzbar.
        </p>
      </div>
      <div>
        <p className="font-medium">Verschachtelung</p>
        <Code>ROUND(AVERAGE(feld1, feld2, feld3), 2)</Code>
      </div>
    </div>
  );
}

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

  /**
   * Rechenbare Größen des Formulars: numerische Felder UND verknüpfte Felder
   * (bestehende Feldverknüpfung `data_source`). Verknüpfte Felder liefern zur
   * Laufzeit den aktuellen Wert der Quelle – es wird kein Wert kopiert.
   */
  const numericFields = useMemo(
    () => fields.filter((f) => isCalcInputFieldDef(f as any)),
    [fields]
  );
  const localFields = useMemo(() => numericFields.filter((f) => !isLinkedField(f as any)), [numericFields]);
  const linkedFields = useMemo(() => numericFields.filter((f) => isLinkedField(f as any)), [numericFields]);
  const originOf = (f: FormField) => linkOriginLabel(readValueSource(f as any));
  const fieldLabel = (key: string) =>
    fields.find((f) => f.field_key === key)?.display_name
    ?? calcs.find((c) => c.calc_key === key)?.display_name
    ?? key;

  /** Alle im aktuellen Formular gültigen Referenzen (Felder + Berechnungen). */
  const knownRefs = useMemo(
    () => new Set<string>([
      ...fields.map((f) => f.field_key),
      ...(calcs as FormCalculation[]).map((c) => c.calc_key),
    ]),
    [fields, calcs]
  );
  const isKnownRef = (key: string) => knownRefs.has(key);

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
    const res = evaluateLocalCalculations(merged, testValues, fields.map((f) => f.field_key));
    return res[key];
  }, [calcs, draft, formula, testValues, form.id, fields]);

  const referenced = useMemo(
    () => extractReferences(formula).filter((r) => !FORMULA_FUNCTIONS.includes(r)),
    [formula]
  );
  /** Referenzen, die es im Formular tatsächlich nicht (mehr) gibt. */
  const unknownRefs = useMemo(
    () => referenced.filter((r) => !isKnownRef(r)),
    [referenced, knownRefs]
  );


  const openNew = () => { setDraft(emptyDraft()); setTestValues({}); setOpen(true); };

  /**
   * Referenzen anhand der stabilen ID auflösen: wurde der technische
   * Feldschlüssel nachträglich geändert, wird der Token automatisch korrigiert
   * statt als „unbekanntes Feld" zu gelten.
   */
  const healTokens = (tokens: CalcToken[]): CalcToken[] =>
    tokens.map((t) => {
      if (t.type !== "operand" || t.source === "const" || !t.ref_id) return t;
      const key = t.source === "calc"
        ? (calcs as FormCalculation[]).find((c) => c.id === t.ref_id)?.calc_key
        : fields.find((f) => f.id === t.ref_id)?.field_key;
      return key && key !== t.ref ? { ...t, ref: key } : t;
    });

  const openEdit = (c: FormCalculation) => {
    const raw = Array.isArray(c.expression) && c.expression.length ? (c.expression as CalcToken[]) : [];
    const tokens = healTokens(raw);
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
      formula: tokens.length ? buildFormulaFromTokens(tokens) : (c.formula ?? ""),
      is_result: !!(c as any).is_result,
      result_label: (c as any).result_label ?? "",
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
        is_result: draft.is_result,
        result_label: draft.is_result ? (draft.result_label.trim() || null) : null,
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
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline">Vorlage</Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 p-2">
                  <p className="text-xs text-muted-foreground px-1 pb-2">
                    Zentrale Berechnungen (Geometrie/Auslegung). Die Formel bleibt zentral
                    definiert – hier wird sie nur für dieses Formular übernommen.
                  </p>
                  <div className="max-h-72 overflow-auto space-y-1">
                    {GEOMETRY_CALCULATIONS.map((g) => (
                      <button
                        key={g.calc_key}
                        type="button"
                        className="w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => openFromTemplate(g)}
                      >
                        <span className="text-xs font-medium">{g.display_name}</span>
                        <span className="ml-2 text-[11px] text-muted-foreground">{g.unit}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">{g.formula}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Neue Berechnung</Button>
            </div>
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
                      <div className="font-medium text-sm"><RichText value={c.display_name} /></div>
                      {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {extractReferences(c.formula).length
                        ? c.formula.split(/\s+/).map((p, i) =>
                            /^[A-Za-z_\u0370-\u03FF]/.test(p)
                              ? <Badge key={i} variant={isKnownRef(p) || FORMULA_FUNCTIONS.includes(p.toUpperCase()) ? "secondary" : "destructive"} className="mr-1 mb-1">{fieldLabel(p)}</Badge>
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
                <SymbolInput value={draft.display_name} placeholder="z. B. Volumen"
                  onChange={(v) => setDraft((d) => ({ ...d, display_name: v }))} />
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
                              if (v === "__const__") { setToken(i, { source: "const", ref: null, ref_id: null, value: 0 } as any); return; }
                              if (v === "__none__") { setToken(i, { source: "field", ref: "", ref_id: null } as any); return; }
                              const calc = (calcs as FormCalculation[]).find((c) => c.calc_key === v);
                              const field = fields.find((f) => f.field_key === v);
                              setToken(i, {
                                source: calc ? "calc" : "field",
                                ref: v,
                                ref_id: calc ? calc.id : field?.id ?? null,
                              } as any);
                            }}

                          >
                            <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Feld wählen" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Feld wählen —</SelectItem>
                              <SelectGroup>
                                <SelectLabel>Formularfelder</SelectLabel>
                                {localFields.map((f: FormField) => (
                                  <SelectItem key={f.id} value={f.field_key}>
                                    {f.display_name}{f.unit ? ` [${f.unit}]` : ""}
                                  </SelectItem>
                                ))}
                                {numericFields.length === 0 && <SelectItem value="__empty__" disabled>Keine rechenbaren Felder</SelectItem>}
                              </SelectGroup>
                              {linkedFields.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Verknüpfte Felder</SelectLabel>
                                  {linkedFields.map((f: FormField) => (
                                    <SelectItem key={f.id} value={f.field_key}>
                                      🔗 {f.display_name}{f.unit ? ` [${f.unit}]` : ""}
                                      {originOf(f) ? ` · aus ${originOf(f)}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
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
                    Angeboten werden rechenbare Felder dieses Formulars sowie 🔗 verknüpfte Felder
                    (Werte aus vorangegangenen Dienstleistungen). Technische Schlüssel sind nicht nötig.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Formel</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <HelpCircle className="h-3.5 w-3.5 mr-1" />Syntaxhilfe
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-96 max-h-[420px] overflow-y-auto text-xs space-y-3">
                        <FormulaSyntaxHelp />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-start gap-2">
                    <Textarea rows={3} className="font-mono text-xs" value={draft.formula}
                      placeholder="z. B. AVERAGE(messung_1, messung_2, messung_3) · Winkel im Bogenmaß: SIN(α), DEGREES(ATAN(y/x))"
                      onChange={(e) => setDraft((d) => ({ ...d, formula: e.target.value }))} />
                    <SymbolPickerButton
                      onPick={(s) => setDraft((d) => ({ ...d, formula: `${d.formula}${s}` }))}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Feld einfügen</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2 max-h-72 overflow-y-auto">
                        <p className="text-[11px] text-muted-foreground px-1 pb-1">Formularfelder</p>
                        {localFields.map((f) => (
                          <button key={f.id} type="button"
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                            onClick={() => setDraft((d) => ({ ...d, formula: appendRef(d.formula, f.field_key) }))}>
                            {f.display_name}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{f.field_key}</span>
                          </button>
                        ))}
                        {linkedFields.length > 0 && (
                          <>
                            <p className="text-[11px] text-muted-foreground px-1 py-1">Verknüpfte Felder</p>
                            {linkedFields.map((f) => (
                              <button key={f.id} type="button"
                                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                                onClick={() => setDraft((d) => ({ ...d, formula: appendRef(d.formula, f.field_key) }))}>
                                🔗 {f.display_name}
                                {originOf(f) ? <span className="ml-1 text-[10px] text-muted-foreground">aus {originOf(f)}</span> : null}
                                <span className="ml-2 font-mono text-[10px] text-muted-foreground">{f.field_key}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {(calcs as FormCalculation[]).length > 0 && (
                          <>
                            <p className="text-[11px] text-muted-foreground px-1 py-1">Berechnungen</p>
                            {(calcs as FormCalculation[]).filter((c) => c.id !== draft.id).map((c) => (
                              <button key={c.id} type="button"
                                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                                onClick={() => setDraft((d) => ({ ...d, formula: appendRef(d.formula, c.calc_key) }))}>
                                {c.display_name}
                              </button>
                            ))}
                          </>
                        )}
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline">Funktion</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2 max-h-72 overflow-y-auto">
                        {FORMULA_FUNCTIONS.map((f) => (
                          <button key={f} type="button"
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted font-mono"
                            onClick={() => setDraft((d) => ({ ...d, formula: `${d.formula}${d.formula && !/[\s(]$/.test(d.formula) ? " " : ""}${f}(` }))}>
                            {formulaFunctionLabel(f)}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <span className="text-[11px] text-muted-foreground">
                      Parameter mit Komma trennen: AVERAGE(a, b, c)
                    </span>
                  </div>
                </div>
              )}


              <div className="text-xs text-muted-foreground">
                Ergebnis ={" "}
                {referenced.length
                  ? formula.split(/\s+/).map((p, i) => /^[A-Za-z_\u0370-\u03FF]/.test(p)
                      ? <Badge key={i} variant={isKnownRef(p) || FORMULA_FUNCTIONS.includes(p.toUpperCase()) ? "secondary" : "destructive"} className="mr-1">{fieldLabel(p)}</Badge>
                      : <span key={i} className="mr-1">{p}</span>)
                  : <span>{formula || "—"}</span>}
              </div>

              {unknownRefs.length > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Nicht auflösbar: {unknownRefs.join(", ")} — Feld existiert nicht (mehr) in diesem Formular.
                </p>
              )}


              {cycle && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Zyklische Abhängigkeit erkannt – diese Berechnung verweist (indirekt) auf sich selbst.
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Einheit (optional)</Label>
                <SymbolInput value={draft.unit} placeholder="kg" onChange={(v) => setDraft((d) => ({ ...d, unit: v }))} />
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

            <div className="rounded border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Switch checked={draft.is_result}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, is_result: v }))} />
                <Label className="text-xs">Offizielles Ergebnis</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Nur markierte Werte werden beim Abschluss der Aufgabe in die Ergebnisdatenbank übernommen.
              </p>
              {draft.is_result && (
                <SymbolInput className="h-8" placeholder={draft.display_name || "Ergebnis-Bezeichnung"}
                  value={draft.result_label}
                  onChange={(v) => setDraft((d) => ({ ...d, result_label: v }))} />
              )}
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
