import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, FormInput, FileText, Zap } from "lucide-react";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";
import { renderTemplate } from "./DocumentsDesigner";

const ROLES: { value: FormRoleView; label: string }[] = [
  { value: "customer", label: "Auftraggeber" },
  { value: "employee", label: "Mitarbeiter" },
  { value: "public", label: "Öffentlich" },
];

function PreviewField({ field, value, onChange }: { field: any; value: any; onChange: (v: any) => void }) {
  const common = "w-full";
  switch (field.field_type) {
    case "longtext":
      return <Textarea className={common} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "decimal":
    case "percent":
      return <Input className={common} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input className={common} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "boolean":
      return <Switch checked={!!value} onCheckedChange={onChange} />;
    case "select": {
      const opts = (field.select_options || []).map((o: any) => typeof o === "string" ? { label: o, value: o } : o);
      return (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
          <SelectContent>
            {opts.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    default:
      return <Input className={common} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function ServicePreview({ serviceId }: { serviceId: string }) {
  const [role, setRole] = useState<FormRoleView>("customer");
  const [values, setValues] = useState<Record<string, any>>({});

  const { data: fields = [] } = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId),
  });
  const { data: layout } = useQuery({
    queryKey: ["service-form-layout", serviceId, role],
    queryFn: () => api.serviceFormLayouts.get(serviceId, role),
  });
  const { data: rulesRow } = useQuery({
    queryKey: ["service-rules", serviceId],
    queryFn: () => api.serviceRules.getForService(serviceId),
  });
  const { data: workflow } = useQuery({
    queryKey: ["service-workflow", serviceId],
    // workflow API may not be wired the same way — fall back gracefully
    queryFn: async () => {
      try {
        const w = await (api as any).from("service_workflows").select("*").eq("service_id", serviceId).maybeSingle();
        return w?.data ?? null;
      } catch { return null; }
    },
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["service-doc-templates", serviceId],
    queryFn: () => api.serviceDocumentTemplates.listForService(serviceId),
  });

  const fieldByKey = useMemo(() => {
    const m = new Map<string, any>();
    for (const f of fields) m.set(f.field_key, f);
    return m;
  }, [fields]);

  // Apply rules evaluation (subset: show/hide, require, set_value)
  const evaluatedRules = useMemo(() => {
    const hidden = new Set<string>();
    const required = new Set<string>();
    const definition = rulesRow?.definition;
    if (!definition?.rules) return { hidden, required };
    for (const rule of definition.rules) {
      if (!rule.enabled) continue;
      const checks = rule.conditions.map((c) => {
        const v = values[c.field_key];
        switch (c.operator) {
          case "equals": return String(v ?? "") === String(c.value ?? "");
          case "not_equals": return String(v ?? "") !== String(c.value ?? "");
          case "is_empty": return v == null || v === "";
          case "is_not_empty": return !(v == null || v === "");
          case "contains": return String(v ?? "").includes(String(c.value ?? ""));
          case "gte": return Number(v) >= Number(c.value);
          case "lte": return Number(v) <= Number(c.value);
          case "greater_than": return Number(v) > Number(c.value);
          case "less_than": return Number(v) < Number(c.value);
          default: return false;
        }
      });
      const ok = rule.logic === "or" ? checks.some(Boolean) : checks.every(Boolean);
      if (!ok) continue;
      for (const a of rule.actions) {
        if (a.type === "hide_field" && a.target_field_key) hidden.add(a.target_field_key);
        if (a.type === "show_field" && a.target_field_key) hidden.delete(a.target_field_key);
        if (a.type === "require_field" && a.target_field_key) required.add(a.target_field_key);
        if (a.type === "optional_field" && a.target_field_key) required.delete(a.target_field_key);
      }
    }
    return { hidden, required };
  }, [rulesRow, values]);

  const sections = layout?.layout?.sections ?? [];

  const enabledDoc = docs.find((d) => d.enabled);

  const previewValuesAsFields = useMemo(() => {
    // Provide both entered values AND auto-sample from missing
    return fields.map((f) => ({
      ...f,
      // override default sample via current value if set
    }));
  }, [fields]);

  function renderWithLiveValues(content: string): string {
    return content.replace(/\{\{?\s*([a-z0-9_]+)\s*\}?\}/gi, (_, key) => {
      const v = values[key];
      if (v != null && v !== "") return String(v);
      const f = fieldByKey.get(key);
      return f ? `‹${f.display_name}›` : `‹${key}›`;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" /> Live-Vorschau der gesamten Dienstleistung
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Wechsle die Rollenansicht, fülle Felder aus und sieh, wie Regeln, Workflow und Dokumente reagieren.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={role} onValueChange={(v) => setRole(v as FormRoleView)}>
            <TabsList>
              {ROLES.map((r) => <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>)}
            </TabsList>
            <TabsContent value={role} className="mt-4">
              <div className="grid grid-cols-12 gap-4">
                {/* Form */}
                <div className="col-span-12 lg:col-span-7 space-y-4">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <FormInput className="h-4 w-4" /> Formular
                  </div>
                  {sections.length === 0 ? (
                    <div className="text-sm text-muted-foreground border border-dashed rounded p-6 text-center">
                      Für diese Rolle ist noch kein Formular konfiguriert.
                    </div>
                  ) : (
                    sections.map((sec) => (
                      <div key={sec.id} className="border rounded-md p-3 space-y-3">
                        <div className="text-sm font-semibold">{sec.title}</div>
                        <div className="grid grid-cols-12 gap-3">
                          {sec.fields.map((ref) => {
                            const f = fields.find((x) => x.id === ref.field_id);
                            if (!f) return null;
                            if (ref.hidden) return null;
                            if (evaluatedRules.hidden.has(f.field_key)) return null;
                            const colCls =
                              ref.width === 6 ? "col-span-12 md:col-span-6"
                              : ref.width === 4 ? "col-span-12 md:col-span-4"
                              : ref.width === 3 ? "col-span-12 md:col-span-3"
                              : ref.width === 8 ? "col-span-12 md:col-span-8"
                              : ref.width === 9 ? "col-span-12 md:col-span-9"
                              : "col-span-12";
                            const isRequired = f.is_required || evaluatedRules.required.has(f.field_key);
                            return (
                              <div key={ref.id} className={colCls}>
                                <Label className="text-xs">
                                  {f.display_name}
                                  {isRequired && <span className="text-destructive">*</span>}
                                  {f.unit ? <span className="text-muted-foreground"> ({f.unit})</span> : null}
                                </Label>
                                <PreviewField
                                  field={f}
                                  value={values[f.field_key]}
                                  onChange={(v) => setValues((s) => ({ ...s, [f.field_key]: v }))}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Side: workflow + rule trace + document */}
                <div className="col-span-12 lg:col-span-5 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4" /> Aktive Regeln
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs space-y-1">
                      {evaluatedRules.hidden.size === 0 && evaluatedRules.required.size === 0 ? (
                        <div className="text-muted-foreground">Aktuell greifen keine Regeln.</div>
                      ) : (
                        <>
                          {[...evaluatedRules.hidden].map((k) => (
                            <div key={`h-${k}`}><Badge variant="outline">verborgen</Badge> {fieldByKey.get(k)?.display_name ?? k}</div>
                          ))}
                          {[...evaluatedRules.required].map((k) => (
                            <div key={`r-${k}`}><Badge variant="destructive">Pflicht</Badge> {fieldByKey.get(k)?.display_name ?? k}</div>
                          ))}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {workflow?.definition?.states?.length ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Workflow-Zustände</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {workflow.definition.states.map((s: any) => (
                          <Badge key={s.key} style={{ backgroundColor: s.color || undefined }} variant="secondary">
                            {s.label || s.key}
                          </Badge>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  {enabledDoc ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Dokument-Vorschau · {enabledDoc.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div
                          className="border rounded bg-white text-black p-4 text-sm max-h-[400px] overflow-auto"
                          dangerouslySetInnerHTML={{ __html: renderWithLiveValues(enabledDoc.content) }}
                        />
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
