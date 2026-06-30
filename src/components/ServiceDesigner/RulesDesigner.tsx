import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Plus, Pencil, Trash2, Zap, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import type {
  ServiceRule, RuleCondition, RuleAction, RuleConditionLogic,
  RuleOperator, RuleActionType,
} from "@/lib/api/serviceRules";
import type { ServiceDataField } from "@/lib/api/serviceDesigner";

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals: "ist gleich",
  not_equals: "ist nicht gleich",
  greater_than: "größer als",
  less_than: "kleiner als",
  gte: "größer/gleich",
  lte: "kleiner/gleich",
  contains: "enthält",
  not_contains: "enthält nicht",
  is_empty: "ist leer",
  is_not_empty: "ist nicht leer",
  in: "ist in Liste",
  not_in: "ist nicht in Liste",
};

const NUMERIC_OPS: RuleOperator[] = ["greater_than", "less_than", "gte", "lte"];
const TEXT_OPS: RuleOperator[] = ["contains", "not_contains"];
const NO_VALUE_OPS: RuleOperator[] = ["is_empty", "is_not_empty"];
const LIST_OPS: RuleOperator[] = ["in", "not_in"];

const ACTION_LABELS: Record<RuleActionType, string> = {
  show_field: "Feld einblenden",
  hide_field: "Feld ausblenden",
  require_field: "Feld als Pflicht setzen",
  optional_field: "Feld als optional setzen",
  set_value: "Wert setzen",
  calculate_value: "Wert berechnen (Formel)",
  create_task: "Aufgabe erzeugen",
  send_notification: "Benachrichtigung senden",
};

const ACTION_GROUPS: { label: string; types: RuleActionType[] }[] = [
  { label: "Sichtbarkeit", types: ["show_field", "hide_field"] },
  { label: "Pflicht", types: ["require_field", "optional_field"] },
  { label: "Werte", types: ["set_value", "calculate_value"] },
  { label: "Automatisierung", types: ["create_task", "send_notification"] },
];

const ROLE_OPTIONS = [
  { value: "auftraggeber", label: "Auftraggeber" },
  { value: "durchfuehrer", label: "Durchführer (Messdienstleister)" },
  { value: "master", label: "Master" },
  { value: "project_owner", label: "Projekteigner" },
  { value: "project_leader", label: "Projektleiter" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface Props {
  serviceId: string;
  canManage: boolean;
}

export default function RulesDesigner({ serviceId, canManage }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: fields = [] } = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId),
  });

  const { data: row, isLoading } = useQuery({
    queryKey: ["service-rules", serviceId],
    queryFn: () => api.serviceRules.getForService(serviceId),
  });

  const [rules, setRules] = useState<ServiceRule[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<ServiceRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ServiceRule | null>(null);

  useEffect(() => {
    setRules(row?.definition?.rules ?? []);
    setDirty(false);
  }, [row?.id, row?.updated_at]);

  const save = useMutation({
    mutationFn: () =>
      api.serviceRules.upsert(serviceId, { rules }, user?.id ?? null),
    onSuccess: () => {
      toast.success("Regeln gespeichert");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["service-rules", serviceId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const activeFields = useMemo(
    () => fields.filter((f) => !f.archived),
    [fields]
  );

  const fieldKeys = useMemo(
    () => new Set(activeFields.map((f) => f.field_key)),
    [activeFields]
  );

  const issues = useMemo(() => {
    const list: { rule: ServiceRule; messages: string[] }[] = [];
    for (const r of rules) {
      const msgs: string[] = [];
      if (!r.name?.trim()) msgs.push("Name fehlt");
      if (r.conditions.length === 0) msgs.push("Keine Bedingung definiert");
      if (r.actions.length === 0) msgs.push("Keine Aktion definiert");
      for (const c of r.conditions) {
        if (!c.field_key) msgs.push("Bedingung ohne Feld");
        else if (!fieldKeys.has(c.field_key)) msgs.push(`Unbekanntes Feld: ${c.field_key}`);
      }
      for (const a of r.actions) {
        if (
          ["show_field", "hide_field", "require_field", "optional_field", "set_value", "calculate_value"].includes(a.type)
          && (!a.target_field_key || !fieldKeys.has(a.target_field_key))
        ) msgs.push(`Aktion verweist auf unbekanntes Feld`);
      }
      if (msgs.length) list.push({ rule: r, messages: msgs });
    }
    return list;
  }, [rules, fieldKeys]);

  const upsertRule = (rule: ServiceRule) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === rule.id);
      const next = exists ? prev.map((r) => (r.id === rule.id ? rule : r)) : [...prev, rule];
      return next;
    });
    setDirty(true);
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const toggleEnabled = (id: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    setDirty(true);
  };

  const move = (id: string, dir: -1 | 1) => {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" /> Regeln & Automatisierungen
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              WENN bestimmte Bedingungen erfüllt sind, DANN führe Aktionen aus –
              Felder ein-/ausblenden, Pflichten setzen, Werte berechnen,
              Aufgaben oder Benachrichtigungen erzeugen.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setEditing(emptyRule())}>
                  <Plus className="h-4 w-4 mr-1" /> Neue Regel
                </Button>
                <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                  Speichern
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Lade …</div>
          ) : rules.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
              Noch keine Regeln definiert.
              {canManage && " Lege oben die erste Regel an."}
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((r, idx) => {
                const ruleIssues = issues.find((i) => i.rule.id === r.id)?.messages ?? [];
                return (
                  <div key={r.id} className="border rounded-md p-3 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{r.name || <em className="text-muted-foreground">Ohne Namen</em>}</span>
                          {r.enabled
                            ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />aktiv</Badge>
                            : <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />inaktiv</Badge>}
                          {ruleIssues.length > 0 && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> {ruleIssues.length} Hinweis(e)
                            </Badge>
                          )}
                        </div>
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                        )}
                        <p className="text-xs mt-2">
                          <span className="text-muted-foreground">WENN </span>
                          {r.conditions.length === 0
                            ? <em>keine Bedingung</em>
                            : r.conditions.map((c, ci) => (
                                <span key={c.id}>
                                  {ci > 0 && <span className="text-muted-foreground"> {r.logic === "or" ? "ODER" : "UND"} </span>}
                                  <code className="bg-muted px-1 rounded">{c.field_key || "?"}</code>{" "}
                                  {OPERATOR_LABELS[c.operator]}
                                  {!NO_VALUE_OPS.includes(c.operator) && c.value !== undefined && c.value !== null && c.value !== "" && (
                                    <> <code className="bg-muted px-1 rounded">{String(c.value)}</code></>
                                  )}
                                </span>
                              ))}
                        </p>
                        <p className="text-xs mt-1">
                          <span className="text-muted-foreground">DANN </span>
                          {r.actions.length === 0
                            ? <em>keine Aktion</em>
                            : r.actions.map((a, ai) => (
                                <span key={a.id}>
                                  {ai > 0 && <span className="text-muted-foreground"> · </span>}
                                  {ACTION_LABELS[a.type]}
                                  {a.target_field_key && <> <code className="bg-muted px-1 rounded">{a.target_field_key}</code></>}
                                </span>
                              ))}
                        </p>
                        {ruleIssues.length > 0 && (
                          <ul className="mt-2 text-xs text-destructive list-disc pl-5">
                            {ruleIssues.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={r.enabled}
                          disabled={!canManage}
                          onCheckedChange={(c) => toggleEnabled(r.id, c)}
                        />
                        <Button size="icon" variant="ghost" disabled={!canManage || idx === 0} onClick={() => move(r.id, -1)}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={!canManage || idx === rules.length - 1} onClick={() => move(r.id, 1)}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <RuleDialog
          rule={editing}
          fields={activeFields}
          onClose={() => setEditing(null)}
          onSave={(r) => { upsertRule(r); setEditing(null); }}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{confirmDelete?.name}" wird entfernt. Speichern nicht vergessen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) removeRule(confirmDelete.id); setConfirmDelete(null); }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function emptyRule(): ServiceRule {
  return {
    id: uid(),
    name: "",
    description: "",
    enabled: true,
    logic: "and",
    conditions: [],
    actions: [],
  };
}

// ----------------------------------------------------------------------

function RuleDialog({
  rule, fields, onClose, onSave,
}: {
  rule: ServiceRule;
  fields: ServiceDataField[];
  onClose: () => void;
  onSave: (r: ServiceRule) => void;
}) {
  const [draft, setDraft] = useState<ServiceRule>(rule);

  const addCondition = () => setDraft((d) => ({
    ...d,
    conditions: [...d.conditions, { id: uid(), field_key: "", operator: "equals", value: "" }],
  }));
  const updateCondition = (id: string, patch: Partial<RuleCondition>) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  const removeCondition = (id: string) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((c) => c.id !== id) }));

  const addAction = (type: RuleActionType) => setDraft((d) => ({
    ...d,
    actions: [...d.actions, { id: uid(), type }],
  }));
  const updateAction = (id: string, patch: Partial<RuleAction>) =>
    setDraft((d) => ({ ...d, actions: d.actions.map((a) => a.id === id ? { ...a, ...patch } : a) }));
  const removeAction = (id: string) =>
    setDraft((d) => ({ ...d, actions: d.actions.filter((a) => a.id !== id) }));

  const fieldByKey = (k: string) => fields.find((f) => f.field_key === k);

  const operatorsFor = (k: string): RuleOperator[] => {
    const f = fieldByKey(k);
    const base: RuleOperator[] = ["equals", "not_equals", "is_empty", "is_not_empty"];
    if (!f) return base;
    const numeric = ["number", "decimal", "percent"].includes(f.field_type);
    const textual = ["text", "longtext"].includes(f.field_type);
    const multi = ["multiselect"].includes(f.field_type);
    return [
      ...base,
      ...(numeric ? NUMERIC_OPS : []),
      ...(textual ? TEXT_OPS : []),
      ...(multi ? LIST_OPS : []),
    ];
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{rule.name ? `Regel: ${rule.name}` : "Neue Regel"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Verknüpfung der Bedingungen</Label>
              <Select value={draft.logic} onValueChange={(v) => setDraft((d) => ({ ...d, logic: v as RuleConditionLogic }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">UND – alle müssen zutreffen</SelectItem>
                  <SelectItem value="or">ODER – mindestens eine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Beschreibung (optional)</Label>
            <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">WENN (Bedingungen)</h4>
              <Button size="sm" variant="outline" onClick={addCondition}>
                <Plus className="h-4 w-4 mr-1" /> Bedingung
              </Button>
            </div>
            {draft.conditions.length === 0 && (
              <div className="text-xs text-muted-foreground border border-dashed rounded p-3 text-center">
                Keine Bedingung – Regel würde immer greifen.
              </div>
            )}
            {draft.conditions.map((c) => {
              const ops = operatorsFor(c.field_key);
              const showValue = !NO_VALUE_OPS.includes(c.operator);
              return (
                <div key={c.id} className="grid grid-cols-12 gap-2 items-end border rounded p-2 bg-muted/30">
                  <div className="col-span-4 space-y-1">
                    <Label className="text-[10px]">Feld</Label>
                    <Select value={c.field_key} onValueChange={(v) => updateCondition(c.id, { field_key: v })}>
                      <SelectTrigger><SelectValue placeholder="Feld wählen" /></SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.id} value={f.field_key}>{f.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-[10px]">Operator</Label>
                    <Select value={c.operator} onValueChange={(v) => updateCondition(c.id, { operator: v as RuleOperator })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ops.map((o) => <SelectItem key={o} value={o}>{OPERATOR_LABELS[o]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-[10px]">Wert</Label>
                    <Input
                      disabled={!showValue}
                      value={(c.value as any) ?? ""}
                      onChange={(e) => updateCondition(c.id, { value: e.target.value })}
                      placeholder={showValue ? "Vergleichswert" : "—"}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button size="icon" variant="ghost" onClick={() => removeCondition(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-medium">DANN (Aktionen)</h4>
              <Select onValueChange={(v) => addAction(v as RuleActionType)}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="+ Aktion hinzufügen" /></SelectTrigger>
                <SelectContent>
                  {ACTION_GROUPS.map((g) => (
                    <div key={g.label}>
                      <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">{g.label}</div>
                      {g.types.map((t) => <SelectItem key={t} value={t}>{ACTION_LABELS[t]}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {draft.actions.length === 0 && (
              <div className="text-xs text-muted-foreground border border-dashed rounded p-3 text-center">
                Noch keine Aktion ausgewählt.
              </div>
            )}
            {draft.actions.map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                fields={fields}
                onChange={(patch) => updateAction(a.id, patch)}
                onRemove={() => removeAction(a.id)}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave(draft)}>Übernehmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionRow({
  action, fields, onChange, onRemove,
}: {
  action: RuleAction;
  fields: ServiceDataField[];
  onChange: (patch: Partial<RuleAction>) => void;
  onRemove: () => void;
}) {
  const needsField = ["show_field", "hide_field", "require_field", "optional_field", "set_value", "calculate_value"].includes(action.type);
  const needsValue = action.type === "set_value";
  const needsFormula = action.type === "calculate_value";
  const isTask = action.type === "create_task";
  const isNotify = action.type === "send_notification";

  return (
    <div className="border rounded p-2 bg-muted/30 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{ACTION_LABELS[action.type]}</Badge>
        <Button size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="grid grid-cols-12 gap-2">
        {needsField && (
          <div className="col-span-6 space-y-1">
            <Label className="text-[10px]">Zielfeld</Label>
            <Select value={action.target_field_key ?? ""} onValueChange={(v) => onChange({ target_field_key: v })}>
              <SelectTrigger><SelectValue placeholder="Feld wählen" /></SelectTrigger>
              <SelectContent>
                {fields.map((f) => <SelectItem key={f.id} value={f.field_key}>{f.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {needsValue && (
          <div className="col-span-6 space-y-1">
            <Label className="text-[10px]">Wert</Label>
            <Input value={(action.value as any) ?? ""} onChange={(e) => onChange({ value: e.target.value })} />
          </div>
        )}
        {needsFormula && (
          <div className="col-span-12 space-y-1">
            <Label className="text-[10px]">Formel</Label>
            <Input
              value={action.formula ?? ""}
              onChange={(e) => onChange({ formula: e.target.value })}
              placeholder="z.B. {laenge} * {breite}"
            />
            <p className="text-[10px] text-muted-foreground">Feldreferenzen in geschweiften Klammern.</p>
          </div>
        )}
        {isTask && (
          <>
            <div className="col-span-7 space-y-1">
              <Label className="text-[10px]">Aufgaben-Titel</Label>
              <Input value={action.task_title ?? ""} onChange={(e) => onChange({ task_title: e.target.value })} />
            </div>
            <div className="col-span-5 space-y-1">
              <Label className="text-[10px]">Zuständige Rolle</Label>
              <Select value={action.task_role ?? ""} onValueChange={(v) => onChange({ task_role: v })}>
                <SelectTrigger><SelectValue placeholder="Rolle" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {isNotify && (
          <>
            <div className="col-span-5 space-y-1">
              <Label className="text-[10px]">Empfänger-Rolle</Label>
              <Select value={action.notify_role ?? ""} onValueChange={(v) => onChange({ notify_role: v })}>
                <SelectTrigger><SelectValue placeholder="Rolle" /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-7 space-y-1">
              <Label className="text-[10px]">Nachricht</Label>
              <Input value={action.notify_message ?? ""} onChange={(e) => onChange({ notify_message: e.target.value })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
