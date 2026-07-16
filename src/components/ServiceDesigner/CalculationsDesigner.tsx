import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Plus, Trash2, PlayCircle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  evaluateFormula,
  extractReferences,
  FORMULA_FUNCTION_HELP,
} from "@/lib/formulaEngine";
import type { ProcessTemplate } from "@/lib/api/processTemplates";

export type Calculation = {
  key: string;
  label: string;
  formula: string;
  unit?: string | null;
  decimals?: number | null;
  description?: string | null;
  target?: "customer" | "employee" | "report";
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export default function CalculationsDesigner({ template }: { template: ProcessTemplate }) {
  const qc = useQueryClient();
  const meta = (template.metadata ?? {}) as Record<string, any>;
  const calculations: Calculation[] = Array.isArray(meta.calculations) ? meta.calculations : [];

  const [selectedKey, setSelectedKey] = useState<string | null>(calculations[0]?.key ?? null);
  const [testValues, setTestValues] = useState<Record<string, string>>({});

  const selected = calculations.find((c) => c.key === selectedKey) ?? null;

  // Available field keys from linked forms — for reference chip suggestions
  const { data: customerFields = [] } = useQuery({
    queryKey: ["calc-form-fields", meta.customer_form_id],
    queryFn: () =>
      meta.customer_form_id
        ? api.formFields.listForForm(meta.customer_form_id)
        : Promise.resolve([]),
    enabled: !!meta.customer_form_id,
  });
  const { data: employeeFields = [] } = useQuery({
    queryKey: ["calc-form-fields", meta.employee_form_id],
    queryFn: () =>
      meta.employee_form_id
        ? api.formFields.listForForm(meta.employee_form_id)
        : Promise.resolve([]),
    enabled: !!meta.employee_form_id,
  });

  const allFieldKeys = useMemo(() => {
    const keys: { key: string; label: string; source: string }[] = [];
    for (const f of customerFields as any[]) {
      if (f.field_key) keys.push({ key: f.field_key, label: f.display_name, source: "Auftraggeber" });
    }
    for (const f of employeeFields as any[]) {
      if (f.field_key) keys.push({ key: f.field_key, label: f.display_name, source: "MDL" });
    }
    // Ergebnisse anderer Berechnungen sind ebenfalls referenzierbar
    for (const c of calculations) {
      if (c.key !== selectedKey) keys.push({ key: c.key, label: c.label, source: "Berechnung" });
    }
    return keys;
  }, [customerFields, employeeFields, calculations, selectedKey]);

  const saveMut = useMutation({
    mutationFn: async (next: Calculation[]) => {
      const nextMeta = { ...meta, calculations: next };
      return api.processTemplates.update(template.id, { metadata: nextMeta } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["process-template", template.id] });
      toast.success("Berechnungen gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Speichern fehlgeschlagen"),
  });

  function updateCalcs(next: Calculation[]) {
    saveMut.mutate(next);
  }

  function addCalc() {
    const idx = calculations.length + 1;
    const c: Calculation = {
      key: `calc_${idx}`,
      label: `Berechnung ${idx}`,
      formula: "",
      unit: "",
      decimals: 2,
      description: "",
      target: "report",
    };
    updateCalcs([...calculations, c]);
    setSelectedKey(c.key);
  }

  function removeCalc(key: string) {
    if (!confirm("Berechnung löschen?")) return;
    updateCalcs(calculations.filter((c) => c.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  }

  function patchSelected(patch: Partial<Calculation>) {
    if (!selected) return;
    const nextKey = patch.key !== undefined ? slugify(patch.key || selected.key) : selected.key;
    const nextCalc: Calculation = { ...selected, ...patch, key: nextKey };
    const next = calculations.map((c) => (c.key === selected.key ? nextCalc : c));
    setSelectedKey(nextKey);
    updateCalcs(next);
  }

  // Live-Test-Kontext: Testwerte + Ergebnisse vorheriger Berechnungen
  const testCtx = useMemo(() => {
    const ctx: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(testValues)) {
      const n = Number(v.replace(",", "."));
      ctx[k] = isFinite(n) ? n : v;
    }
    // Chain: berechnete Werte davor stehen zur Verfügung
    for (const c of calculations) {
      if (c.key === selected?.key) break;
      const r = evaluateFormula(c.formula, ctx);
      if (r.value != null) ctx[c.key] = r.value;
    }
    return ctx;
  }, [testValues, calculations, selected?.key]);

  const refs = selected ? extractReferences(selected.formula) : [];
  const preview = selected ? evaluateFormula(selected.formula, testCtx) : null;

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Liste */}
      <Card className="col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Formeln
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={addCalc}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-2 space-y-1">
          {calculations.length === 0 && (
            <div className="text-xs text-muted-foreground p-3">
              Noch keine Berechnungen. Legen Sie z. B. Dichte, Mittelwert oder Standardabweichung an.
            </div>
          )}
          {calculations.map((c) => (
            <div
              key={c.key}
              className={`flex items-center gap-2 rounded px-2 py-2 cursor-pointer ${
                selectedKey === c.key ? "bg-primary/10" : "hover:bg-muted"
              }`}
              onClick={() => setSelectedKey(c.key)}
            >
              <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{c.label}</div>
                <div className="text-[10px] text-muted-foreground truncate font-mono">
                  {c.key} {c.formula ? `= ${c.formula}` : ""}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCalc(c.key);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Editor */}
      <div className="col-span-8 space-y-4">
        {!selected ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground text-center">
              Bitte eine Berechnung links auswählen oder anlegen.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Definition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Bezeichnung</Label>
                    <Input
                      value={selected.label}
                      onChange={(e) => patchSelected({ label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Schlüssel (referenzierbar)</Label>
                    <Input
                      value={selected.key}
                      onChange={(e) => patchSelected({ key: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label>Einheit</Label>
                    <Input
                      value={selected.unit ?? ""}
                      onChange={(e) => patchSelected({ unit: e.target.value })}
                      placeholder="z. B. g/cm³, %, MPa"
                    />
                  </div>
                  <div>
                    <Label>Nachkommastellen</Label>
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      value={selected.decimals ?? 2}
                      onChange={(e) => patchSelected({ decimals: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Formel</Label>
                  <Textarea
                    rows={3}
                    className="font-mono"
                    value={selected.formula}
                    onChange={(e) => patchSelected({ formula: e.target.value })}
                    placeholder="z. B. ROUND(masse / volumen; 3) oder IF(druck > 100; 1; 0)"
                  />
                  {preview?.error ? (
                    <p className="text-xs text-destructive mt-1">{preview.error}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ergebnis:{" "}
                      <span className="font-mono">
                        {preview?.value != null
                          ? Number(preview.value).toFixed(selected.decimals ?? 2)
                          : "—"}
                      </span>
                      {selected.unit ? ` ${selected.unit}` : ""}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Beschreibung (optional)</Label>
                  <Textarea
                    rows={2}
                    value={selected.description ?? ""}
                    onChange={(e) => patchSelected({ description: e.target.value })}
                  />
                </div>
                {refs.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Referenzierte Felder:{" "}
                    {refs.map((r) => (
                      <Badge key={r} variant="outline" className="mr-1 font-mono">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" /> Live-Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {refs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Formel referenziert keine Felder — Ergebnis wird direkt oben angezeigt.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {refs.map((r) => (
                      <div key={r}>
                        <Label className="text-xs font-mono">{r}</Label>
                        <Input
                          value={testValues[r] ?? ""}
                          onChange={(e) => setTestValues({ ...testValues, [r]: e.target.value })}
                          placeholder="Testwert"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Feld-Palette & Funktions-Hilfe */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4" /> Verfügbare Felder & Funktionen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs font-medium mb-1">Felder</div>
              {allFieldKeys.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Verknüpfen Sie Auftraggeber-/MDL-Formulare, um Feldschlüssel verfügbar zu machen.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {allFieldKeys.map((f) => (
                    <button
                      key={`${f.source}-${f.key}`}
                      type="button"
                      className="text-[11px] px-1.5 py-0.5 rounded border hover:bg-muted font-mono"
                      title={`${f.label} (${f.source})`}
                      onClick={() => {
                        if (!selected) return;
                        patchSelected({
                          formula: (selected.formula || "") + (selected.formula ? " " : "") + f.key,
                        });
                      }}
                    >
                      {f.key}
                      <span className="ml-1 text-muted-foreground">· {f.source}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            <div>
              <div className="text-xs font-medium mb-1">Funktionen</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Name</TableHead>
                    <TableHead>Verwendung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(FORMULA_FUNCTION_HELP).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="font-mono text-xs">{k}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-[11px] text-muted-foreground mt-2">
                Operatoren: <code>+ - * / %</code> · Vergleich: <code>= &lt;&gt; &lt; &lt;= &gt; &gt;=</code> ·
                Klammern erlaubt · Argumente mit <code>;</code> trennen.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
