import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SymbolInput } from "@/components/forms/SymbolInput";
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
import MasterDataSection from "./MasterDataSection";
import CalculationsSection from "./CalculationsSection";

const slug = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/* ------------------------------------------------------------ Berechnungen */
// Ausgelagert: Variablenzuordnung (Data Binding) + Formel + Ausgabe


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
              <div><Label>Bezeichnung</Label><SymbolInput value={draft.display_name} onChange={(v) => setDraft((d) => ({ ...d, display_name: v }))} placeholder="z.B. Pressdruck" /></div>
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
                <div><Label>Einheit</Label><SymbolInput value={draft.unit} onChange={(v) => setDraft((d) => ({ ...d, unit: v }))} placeholder="bar" /></div>
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
 * Zentrale Bibliothek: Stammdaten, Berechnungen und Validierungen.
 * Rein ergänzend – bestehende Formulare funktionieren unverändert weiter.
 */
export default function GlobalLibraryTab() {
  return (
    <Tabs defaultValue="lists" className="space-y-4">
      <TabsList>
        <TabsTrigger value="lists"><List className="mr-1 h-4 w-4" />Stammdaten</TabsTrigger>
        <TabsTrigger value="calcs"><Sigma className="mr-1 h-4 w-4" />Globale Berechnungen</TabsTrigger>
        <TabsTrigger value="validations"><ShieldCheck className="mr-1 h-4 w-4" />Globale Validierungen</TabsTrigger>
      </TabsList>
      <TabsContent value="lists"><MasterDataSection /></TabsContent>
      <TabsContent value="calcs"><CalculationsSection /></TabsContent>
      <TabsContent value="validations"><ValidationsSection /></TabsContent>
    </Tabs>
  );
}
