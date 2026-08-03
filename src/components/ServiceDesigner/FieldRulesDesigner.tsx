import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import {
  RULE_ACTIONS,
  RULE_OPERATORS,
  emptyRuleCondition,
  type FormFieldRule,
  type RuleAction,
  type RuleCondition,
  type RuleOperator,
} from "@/lib/api/formFieldRules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

const CONTEXT_KEYS = [
  { key: "order_status", label: "Auftragsstatus" },
  { key: "measurement_status", label: "Messungsstatus" },
  { key: "role", label: "Rolle des Benutzers" },
];

/**
 * Phase 4: Konfiguration von Feldregeln ("Wenn Mundstück = MS80 → Stegbreite anzeigen").
 * Additiv – Formulare ohne Regeln bleiben unverändert.
 */
export default function FieldRulesDesigner({
  form,
  canManage,
}: {
  form: FormDefinition;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["form-field-rules", form.id],
    queryFn: () => api.formFieldRules.listForForm(form.id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["form-field-rules", form.id] });

  const createRule = useMutation({
    mutationFn: () =>
      api.formFieldRules.create({
        form_definition_id: form.id,
        name: "Neue Regel",
        condition: emptyRuleCondition(),
        action: "show",
        target_field_ids: [],
        sort_order: (rules.at(-1)?.sort_order ?? 0) + 10,
      }),
    onSuccess: (r) => { invalidate(); setOpenId(r.id); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FormFieldRule> }) =>
      api.formFieldRules.update(id, updates),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const removeRule = useMutation({
    mutationFn: (id: string) => api.formFieldRules.remove(id),
    onSuccess: () => { invalidate(); toast.success("Regel gelöscht"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const patch = (rule: FormFieldRule, updates: Partial<FormFieldRule>) =>
    updateRule.mutate({ id: rule.id, updates });

  const setCondition = (rule: FormFieldRule, idx: number, c: Partial<RuleCondition>) => {
    const conds = [...(rule.condition?.conditions ?? [])];
    conds[idx] = { ...conds[idx], ...c } as RuleCondition;
    patch(rule, { condition: { logic: rule.condition?.logic ?? "and", conditions: conds } });
  };

  const addCondition = (rule: FormFieldRule) => {
    const conds = [
      ...(rule.condition?.conditions ?? []),
      { source: "field", field_key: fields[0]?.field_key ?? "", op: "eq", value: "" } as RuleCondition,
    ];
    patch(rule, { condition: { logic: rule.condition?.logic ?? "and", conditions: conds } });
  };

  const removeCondition = (rule: FormFieldRule, idx: number) => {
    const conds = (rule.condition?.conditions ?? []).filter((_, i) => i !== idx);
    patch(rule, { condition: { logic: rule.condition?.logic ?? "and", conditions: conds } });
  };

  const toggleTarget = (rule: FormFieldRule, fieldId: string) => {
    const cur = rule.target_field_ids ?? [];
    const next = cur.includes(fieldId) ? cur.filter((x) => x !== fieldId) : [...cur, fieldId];
    patch(rule, { target_field_ids: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Feldregeln
          </h3>
          <p className="text-xs text-muted-foreground">
            Bedingte Sichtbarkeit und Pflichtfelder. Ziel-Felder einer „Anzeigen"-Regel sind
            standardmäßig ausgeblendet, bis die Bedingung erfüllt ist.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => createRule.mutate()} disabled={createRule.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Neue Regel
          </Button>
        )}
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Lade…</p>}
      {!isLoading && rules.length === 0 && (
        <div className="border rounded p-6 text-center text-sm text-muted-foreground">
          Noch keine Regeln definiert.
        </div>
      )}

      {rules.map((rule) => {
        const expanded = openId === rule.id;
        return (
          <Card key={rule.id}>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 max-w-xs text-sm"
                  value={rule.name}
                  disabled={!canManage}
                  onChange={(e) => patch(rule, { name: e.target.value })}
                />
                <Badge variant="outline" className="text-[10px]">
                  {RULE_ACTIONS.find((a) => a.value === rule.action)?.label}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {(rule.target_field_ids ?? []).length} Zielfeld(er)
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Label className="text-xs">Aktiv</Label>
                  <Switch
                    checked={rule.is_active}
                    disabled={!canManage}
                    onCheckedChange={(v) => patch(rule, { is_active: v })}
                  />
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(expanded ? null : rule.id)}>
                    {expanded ? "Schließen" : "Bearbeiten"}
                  </Button>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => { if (confirm("Regel löschen?")) removeRule.mutate(rule.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs">Wenn</CardTitle>
                    <Select
                      value={rule.condition?.logic ?? "and"}
                      onValueChange={(v) =>
                        patch(rule, {
                          condition: { logic: v as "and" | "or", conditions: rule.condition?.conditions ?? [] },
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">alle Bedingungen</SelectItem>
                        <SelectItem value="or">mindestens eine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(rule.condition?.conditions ?? []).map((c, idx) => {
                    const opDef = RULE_OPERATORS.find((o) => o.value === c.op);
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-2 rounded border p-2">
                        <Select
                          value={c.source}
                          onValueChange={(v) => setCondition(rule, idx, { source: v as any, field_key: "" })}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="field">Formularfeld</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="role">Rolle</SelectItem>
                          </SelectContent>
                        </Select>

                        {c.source === "field" ? (
                          <Select value={c.field_key} onValueChange={(v) => setCondition(rule, idx, { field_key: v })}>
                            <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Feld wählen" /></SelectTrigger>
                            <SelectContent>
                              {fields.map((f) => (
                                <SelectItem key={f.id} value={f.field_key}>
                                  {f.display_name} <span className="text-muted-foreground">({f.field_key})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select value={c.field_key} onValueChange={(v) => setCondition(rule, idx, { field_key: v })}>
                            <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Kontext wählen" /></SelectTrigger>
                            <SelectContent>
                              {CONTEXT_KEYS.map((k) => (
                                <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        <Select value={c.op} onValueChange={(v) => setCondition(rule, idx, { op: v as RuleOperator })}>
                          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RULE_OPERATORS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {opDef?.needsValue && (
                          <Input
                            className="h-8 w-44 text-xs"
                            value={(c.value as string) ?? ""}
                            placeholder="Wert"
                            onChange={(e) => setCondition(rule, idx, { value: e.target.value })}
                          />
                        )}

                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeCondition(rule, idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}

                  <Button size="sm" variant="outline" onClick={() => addCondition(rule)}>
                    <Plus className="h-3 w-3 mr-1" /> Bedingung
                  </Button>
                </div>

                <div className="space-y-2">
                  <CardTitle className="text-xs">Dann</CardTitle>
                  <Select value={rule.action} onValueChange={(v) => patch(rule, { action: v as RuleAction })}>
                    <SelectTrigger className="h-8 w-72 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RULE_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((f) => {
                      const active = (rule.target_field_ids ?? []).includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleTarget(rule, f.id)}
                          className={`rounded border px-2 py-1 text-left text-xs transition-colors ${
                            active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                          }`}
                        >
                          {f.display_name}
                          <span className="block font-mono text-[10px] text-muted-foreground">{f.field_key}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
