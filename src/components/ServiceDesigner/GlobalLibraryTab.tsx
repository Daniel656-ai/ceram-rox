import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, List, Sigma, ShieldCheck } from "lucide-react";
import {
  VALIDATION_RULE_TYPES,
  type GlobalCalculation,
  type GlobalList,
  type GlobalListItem,
  type GlobalValidation,
  type ValidationRuleType,
} from "@/lib/api/globalLibrary";
import { evaluateFormula } from "@/lib/formulaEngine";

const slug = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/* ------------------------------------------------------------------ Listen */

function ListsSection() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listDraft, setListDraft] = useState<{ id?: string; list_key: string; display_name: string; description: string; category: string }>(
    { list_key: "", display_name: "", description: "", category: "" }
  );
  const [itemOpen, setItemOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<{ id?: string; item_value: string; label: string; description: string; sort_order: number }>(
    { item_value: "", label: "", description: "", sort_order: 0 }
  );

  const { data: lists = [] } = useQuery({ queryKey: ["global-lists"], queryFn: () => api.globalLists.list() });
  const selected = lists.find((l: GlobalList) => l.id === selectedId) ?? null;

  const { data: items = [] } = useQuery({
    queryKey: ["global-list-items", selectedId],
    queryFn: () => api.globalListItems.list(selectedId!),
    enabled: !!selectedId,
  });

  const saveList = useMutation({
    mutationFn: async () => {
      const payload = {
        list_key: listDraft.list_key || slug(listDraft.display_name),
        display_name: listDraft.display_name.trim(),
        description: listDraft.description.trim() || null,
        category: listDraft.category.trim() || null,
      };
      if (!payload.display_name) throw new Error("Bezeichnung erforderlich");
      if (listDraft.id) {
        const { list_key: _k, ...rest } = payload;
        await api.globalLists.update(listDraft.id, rest);
      } else {
        const created = await api.globalLists.create(payload);
        setSelectedId(created.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-lists"] });
      setListOpen(false);
      toast.success("Liste gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Keine Liste ausgewählt");
      const payload = {
        list_id: selectedId,
        item_value: itemDraft.item_value || slug(itemDraft.label),
        label: itemDraft.label.trim(),
        description: itemDraft.description.trim() || null,
        sort_order: itemDraft.sort_order,
      };
      if (!payload.label) throw new Error("Bezeichnung erforderlich");
      if (itemDraft.id) {
        const { list_id: _l, ...rest } = payload;
        await api.globalListItems.update(itemDraft.id, rest);
      } else {
        await api.globalListItems.create(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-list-items", selectedId] });
      setItemOpen(false);
      toast.success("Eintrag gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api.globalListItems.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-list-items", selectedId] }),
  });

  const archiveList = useMutation({
    mutationFn: (id: string) => api.globalLists.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-lists"] });
      setSelectedId(null);
      toast.success("Liste archiviert");
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-sm">Listen</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setListDraft({ list_key: "", display_name: "", description: "", category: "" }); setListOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 pb-3">
          {lists.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Listen angelegt.</p>}
          {lists.map((l: GlobalList) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm ${selectedId === l.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}
            >
              {l.display_name}
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">{l.list_key}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-sm">
            {selected ? `Einträge – ${selected.display_name}` : "Einträge"}
          </CardTitle>
          {selected && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setListDraft({ id: selected.id, list_key: selected.list_key, display_name: selected.display_name, description: selected.description ?? "", category: selected.category ?? "" }); setListOpen(true); }}>
                <Pencil className="mr-1 h-3.5 w-3.5" />Liste bearbeiten
              </Button>
              <Button size="sm" variant="outline" onClick={() => archiveList.mutate(selected.id)}>Archivieren</Button>
              <Button size="sm" onClick={() => { setItemDraft({ item_value: "", label: "", description: "", sort_order: items.length }); setItemOpen(true); }}>
                <Plus className="mr-1 h-3.5 w-3.5" />Eintrag
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!selected ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Liste auswählen oder neu anlegen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Wert</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Keine Einträge.</TableCell></TableRow>
                )}
                {items.map((it: GlobalListItem) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.label}</TableCell>
                    <TableCell className="font-mono text-xs">{it.item_value}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{it.description}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setItemDraft({ id: it.id, item_value: it.item_value, label: it.label, description: it.description ?? "", sort_order: it.sort_order }); setItemOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeItem.mutate(it.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{listDraft.id ? "Liste bearbeiten" : "Neue globale Liste"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bezeichnung</Label><Input value={listDraft.display_name} onChange={(e) => setListDraft((d) => ({ ...d, display_name: e.target.value }))} placeholder="z.B. Mundstücke" /></div>
            <div>
              <Label>Schlüssel</Label>
              <Input value={listDraft.list_key} disabled={!!listDraft.id} onChange={(e) => setListDraft((d) => ({ ...d, list_key: slug(e.target.value) }))} placeholder={slug(listDraft.display_name) || "mundstuecke"} />
            </div>
            <div><Label>Kategorie</Label><Input value={listDraft.category} onChange={(e) => setListDraft((d) => ({ ...d, category: e.target.value }))} /></div>
            <div><Label>Beschreibung</Label><Textarea rows={2} value={listDraft.description} onChange={(e) => setListDraft((d) => ({ ...d, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListOpen(false)}>Abbrechen</Button>
            <Button disabled={saveList.isPending} onClick={() => saveList.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{itemDraft.id ? "Eintrag bearbeiten" : "Neuer Eintrag"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bezeichnung</Label><Input value={itemDraft.label} onChange={(e) => setItemDraft((d) => ({ ...d, label: e.target.value }))} /></div>
            <div><Label>Wert</Label><Input value={itemDraft.item_value} onChange={(e) => setItemDraft((d) => ({ ...d, item_value: e.target.value }))} placeholder={slug(itemDraft.label)} /></div>
            <div><Label>Beschreibung</Label><Input value={itemDraft.description} onChange={(e) => setItemDraft((d) => ({ ...d, description: e.target.value }))} /></div>
            <div><Label>Reihenfolge</Label><Input type="number" value={itemDraft.sort_order} onChange={(e) => setItemDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>Abbrechen</Button>
            <Button disabled={saveItem.isPending} onClick={() => saveItem.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------ Berechnungen */

function CalculationsSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ id?: string; calc_key: string; display_name: string; description: string; formula: string; unit: string; decimals: number }>(
    { calc_key: "", display_name: "", description: "", formula: "", unit: "", decimals: 2 }
  );
  const [testValues, setTestValues] = useState("");

  const { data: calcs = [] } = useQuery({ queryKey: ["global-calculations"], queryFn: () => api.globalCalculations.list() });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        calc_key: draft.calc_key || slug(draft.display_name),
        display_name: draft.display_name.trim(),
        description: draft.description.trim() || null,
        formula: draft.formula.trim(),
        unit: draft.unit.trim() || null,
        decimals: draft.decimals,
      };
      if (!payload.display_name || !payload.formula) throw new Error("Bezeichnung und Formel erforderlich");
      if (draft.id) {
        const { calc_key: _k, ...rest } = payload;
        await api.globalCalculations.update(draft.id, rest);
      } else {
        await api.globalCalculations.create(payload);
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

  const testResult = useMemo(() => {
    if (!draft.formula.trim()) return null;
    const ctx: Record<string, number> = {};
    for (const pair of testValues.split(/[\n,;]+/)) {
      const [k, v] = pair.split("=");
      if (k && v && Number.isFinite(Number(v.trim()))) ctx[k.trim()] = Number(v.trim());
    }
    try {
      const r = evaluateFormula(draft.formula, ctx);
      if (r.error) return `Fehler: ${r.error}`;
      return typeof r.value === "number" && Number.isFinite(r.value)
        ? r.value.toFixed(draft.decimals)
        : String(r.value ?? "—");
    } catch (e: any) {
      return `Fehler: ${e.message}`;
    }
  }, [draft.formula, draft.decimals, testValues]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-sm">Globale Berechnungen</CardTitle>
        <Button size="sm" onClick={() => { setDraft({ calc_key: "", display_name: "", description: "", formula: "", unit: "", decimals: 2 }); setTestValues(""); setOpen(true); }}>
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
              <TableHead>Einheit</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {calcs.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Noch keine Berechnungen definiert.</TableCell></TableRow>
            )}
            {calcs.map((c: GlobalCalculation) => (
              <TableRow key={c.id}>
                <TableCell>{c.display_name}</TableCell>
                <TableCell className="font-mono text-xs">{c.calc_key}</TableCell>
                <TableCell className="font-mono text-xs">{c.formula}</TableCell>
                <TableCell>{c.unit}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setDraft({ id: c.id, calc_key: c.calc_key, display_name: c.display_name, description: c.description ?? "", formula: c.formula, unit: c.unit ?? "", decimals: c.decimals }); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => archive.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Berechnung bearbeiten" : "Neue globale Berechnung"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bezeichnung</Label><Input value={draft.display_name} onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))} placeholder="z.B. Dichte" /></div>
              <div><Label>Schlüssel</Label><Input value={draft.calc_key} disabled={!!draft.id} onChange={(e) => setDraft((d) => ({ ...d, calc_key: slug(e.target.value) }))} placeholder={slug(draft.display_name) || "dichte"} /></div>
            </div>
            <div><Label>Formel</Label><Textarea rows={2} className="font-mono text-sm" value={draft.formula} onChange={(e) => setDraft((d) => ({ ...d, formula: e.target.value }))} placeholder="masse / volumen" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Einheit</Label><Input value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="g/cm³" /></div>
              <div><Label>Nachkommastellen</Label><Input type="number" value={draft.decimals} onChange={(e) => setDraft((d) => ({ ...d, decimals: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>Beschreibung</Label><Textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></div>
            <div className="rounded border bg-muted/30 p-2">
              <Label className="text-xs">Testwerte (key=wert, kommagetrennt)</Label>
              <Input className="mt-1 font-mono text-xs" value={testValues} onChange={(e) => setTestValues(e.target.value)} placeholder="masse=250, volumen=100" />
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

/* ------------------------------------------------------------ Validierungen */

function ValidationsSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{
    id?: string; validation_key: string; display_name: string; description: string;
    rule_type: ValidationRuleType; min_value: string; max_value: string; unit: string;
    pattern: string; severity: "error" | "warning"; error_message: string;
  }>({
    validation_key: "", display_name: "", description: "", rule_type: "range",
    min_value: "", max_value: "", unit: "", pattern: "", severity: "error", error_message: "",
  });

  const { data: rules = [] } = useQuery({ queryKey: ["global-validations"], queryFn: () => api.globalValidations.list() });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        validation_key: draft.validation_key || slug(draft.display_name),
        display_name: draft.display_name.trim(),
        description: draft.description.trim() || null,
        rule_type: draft.rule_type,
        min_value: draft.min_value === "" ? null : Number(draft.min_value),
        max_value: draft.max_value === "" ? null : Number(draft.max_value),
        unit: draft.unit.trim() || null,
        pattern: draft.pattern.trim() || null,
        severity: draft.severity,
        error_message: draft.error_message.trim() || null,
      };
      if (!payload.display_name) throw new Error("Bezeichnung erforderlich");
      if (draft.id) {
        const { validation_key: _k, ...rest } = payload;
        await api.globalValidations.update(draft.id, rest);
      } else {
        await api.globalValidations.create(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-validations"] });
      setOpen(false);
      toast.success("Validierung gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.globalValidations.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-validations"] }),
  });

  const describe = (v: GlobalValidation) => {
    const u = v.unit ? ` ${v.unit}` : "";
    if (v.rule_type === "range") return `${v.min_value ?? "?"} – ${v.max_value ?? "?"}${u}`;
    if (v.rule_type === "min") return `≥ ${v.min_value ?? "?"}${u}`;
    if (v.rule_type === "max") return `≤ ${v.max_value ?? "?"}${u}`;
    if (v.rule_type === "pattern") return v.pattern ?? "—";
    return VALIDATION_RULE_TYPES.find((t) => t.value === v.rule_type)?.label ?? v.rule_type;
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-sm">Globale Validierungen</CardTitle>
        <Button size="sm" onClick={() => { setDraft({ validation_key: "", display_name: "", description: "", rule_type: "range", min_value: "", max_value: "", unit: "", pattern: "", severity: "error", error_message: "" }); setOpen(true); }}>
          <Plus className="mr-1 h-3.5 w-3.5" />Regel
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Schlüssel</TableHead>
              <TableHead>Regel</TableHead>
              <TableHead>Schweregrad</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Noch keine Regeln definiert.</TableCell></TableRow>
            )}
            {rules.map((v: GlobalValidation) => (
              <TableRow key={v.id}>
                <TableCell>{v.display_name}</TableCell>
                <TableCell className="font-mono text-xs">{v.validation_key}</TableCell>
                <TableCell className="text-xs">{describe(v)}</TableCell>
                <TableCell>
                  <Badge variant={v.severity === "error" ? "destructive" : "secondary"} className="text-[10px]">
                    {v.severity === "error" ? "Fehler" : "Warnung"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setDraft({
                    id: v.id, validation_key: v.validation_key, display_name: v.display_name,
                    description: v.description ?? "", rule_type: v.rule_type,
                    min_value: v.min_value?.toString() ?? "", max_value: v.max_value?.toString() ?? "",
                    unit: v.unit ?? "", pattern: v.pattern ?? "", severity: v.severity,
                    error_message: v.error_message ?? "",
                  }); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => archive.mutate(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Regel bearbeiten" : "Neue globale Validierung"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bezeichnung</Label><Input value={draft.display_name} onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))} placeholder="z.B. Pressdruck" /></div>
              <div><Label>Schlüssel</Label><Input value={draft.validation_key} disabled={!!draft.id} onChange={(e) => setDraft((d) => ({ ...d, validation_key: slug(e.target.value) }))} placeholder={slug(draft.display_name) || "pressdruck"} /></div>
            </div>
            <div>
              <Label>Regeltyp</Label>
              <Select value={draft.rule_type} onValueChange={(v) => setDraft((d) => ({ ...d, rule_type: v as ValidationRuleType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALIDATION_RULE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {["range", "min", "max"].includes(draft.rule_type) && (
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Min</Label><Input type="number" value={draft.min_value} onChange={(e) => setDraft((d) => ({ ...d, min_value: e.target.value }))} /></div>
                <div><Label>Max</Label><Input type="number" value={draft.max_value} onChange={(e) => setDraft((d) => ({ ...d, max_value: e.target.value }))} /></div>
                <div><Label>Einheit</Label><Input value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="bar" /></div>
              </div>
            )}
            {draft.rule_type === "pattern" && (
              <div><Label>Muster (RegEx)</Label><Input className="font-mono text-sm" value={draft.pattern} onChange={(e) => setDraft((d) => ({ ...d, pattern: e.target.value }))} /></div>
            )}
            <div>
              <Label>Schweregrad</Label>
              <Select value={draft.severity} onValueChange={(v) => setDraft((d) => ({ ...d, severity: v as "error" | "warning" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">Fehler (blockiert)</SelectItem>
                  <SelectItem value="warning">Warnung (Hinweis)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Meldung</Label><Input value={draft.error_message} onChange={(e) => setDraft((d) => ({ ...d, error_message: e.target.value }))} placeholder="Pressdruck muss zwischen 0 und 400 bar liegen." /></div>
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

/**
 * Phase 3: zentrale Bibliothek für Listen, Berechnungen und Validierungen.
 * Rein ergänzend – bestehende Formulare funktionieren unverändert weiter.
 */
export default function GlobalLibraryTab() {
  return (
    <Tabs defaultValue="lists" className="space-y-4">
      <TabsList>
        <TabsTrigger value="lists"><List className="mr-1 h-4 w-4" />Globale Listen</TabsTrigger>
        <TabsTrigger value="calcs"><Sigma className="mr-1 h-4 w-4" />Globale Berechnungen</TabsTrigger>
        <TabsTrigger value="validations"><ShieldCheck className="mr-1 h-4 w-4" />Globale Validierungen</TabsTrigger>
      </TabsList>
      <TabsContent value="lists"><ListsSection /></TabsContent>
      <TabsContent value="calcs"><CalculationsSection /></TabsContent>
      <TabsContent value="validations"><ValidationsSection /></TabsContent>
    </Tabs>
  );
}
