import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrderKind } from "@/lib/api/orderKindFormTemplates";
import type { FormField } from "@/lib/api/formFields";
import { readRepeaterMeta, repeaterChildren, topLevelFields } from "@/lib/api/formFields";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  orderKind: OrderKind;
  values: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  /** Called with the resolved form_definition_id once (or null if none). Optional. */
  onTemplateResolved?: (formId: string | null) => void;
}

/**
 * Renders a form dynamically based on the template configured for the given
 * order kind. Nothing about the fields is hardcoded — everything comes from
 * the form_definitions / form_fields tables via the Prozess-Designer.
 *
 * If no template is mapped for this order kind, the component renders nothing.
 */
export default function OrderKindDynamicForm({ orderKind, values, onChange, onTemplateResolved }: Props) {
  const { data: mapping, isLoading: mapLoading } = useQuery({
    queryKey: ["order-kind-form-template", orderKind],
    queryFn: () => api.orderKindFormTemplates.get(orderKind),
  });

  const formId = mapping?.form_definition_id ?? null;

  useEffect(() => {
    onTemplateResolved?.(formId);
  }, [formId, onTemplateResolved]);

  const { data: form } = useQuery({
    queryKey: ["form-definition", formId],
    queryFn: () => (formId ? api.formDefinitions.get(formId) : Promise.resolve(null)),
    enabled: !!formId,
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: () => (formId ? api.formFields.listForForm(formId) : Promise.resolve([])),
    enabled: !!formId,
  });

  if (mapLoading) return null;
  if (!formId) return null;

  const top = topLevelFields(fields as FormField[]);
  const grouped = top.reduce<Record<string, FormField[]>>((acc, f) => {
    const cat = f.category?.trim() || "Allgemein";
    (acc[cat] ||= []).push(f);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {form?.name || "Auftragsformular"}
          <Badge variant="outline" className="text-[10px]">Template</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {fieldsLoading && <p className="text-sm text-muted-foreground">Lade Formular…</p>}
        {Object.entries(grouped).map(([category, catFields]) => (
          <section key={category} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {catFields.map((f) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  allFields={fields as FormField[]}
                  value={values[f.field_key]}
                  onChange={(v) => onChange({ [f.field_key]: v })}
                />
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function FieldRow({
  field, allFields, value, onChange,
}: {
  field: FormField;
  allFields: FormField[];
  value: any;
  onChange: (v: any) => void;
}) {
  const wide = field.field_type === "longtext" || field.field_type === "repeater" || field.field_type === "multiselect";
  return (
    <div className={wide ? "md:col-span-2 space-y-1" : "space-y-1"}>
      <Label className="flex items-center gap-1">
        {field.display_name}
        {field.is_required && <span className="text-destructive">*</span>}
        {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      <FieldInput field={field} allFields={allFields} value={value} onChange={onChange} />
    </div>
  );
}

function FieldInput({
  field, allFields, value, onChange,
}: {
  field: FormField;
  allFields: FormField[];
  value: any;
  onChange: (v: any) => void;
}) {
  const disabled = field.readonly;

  switch (field.field_type) {
    case "longtext":
      return <Textarea rows={3} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "decimal":
    case "percent":
      return <Input type="number" step={field.field_type === "number" ? "1" : "0.01"} disabled={disabled}
                    value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input type="date" disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <Input type="time" disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <Input type="datetime-local" disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "boolean":
      return (
        <div className="flex items-center gap-2 h-10">
          <Checkbox checked={!!value} disabled={disabled} onCheckedChange={(v) => onChange(!!v)} />
          <span className="text-sm text-muted-foreground">Ja</span>
        </div>
      );
    case "select": {
      const opts = normalizeOptions(field.select_options);
      return (
        <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">–</SelectItem>
            {opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    case "multiselect": {
      const opts = normalizeOptions(field.select_options);
      const arr: string[] = Array.isArray(value) ? value : [];
      const toggle = (v: string) => {
        onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
      };
      return (
        <div className="flex flex-wrap gap-2 border rounded-md p-2">
          {opts.length === 0 && <span className="text-xs text-muted-foreground">Keine Optionen konfiguriert.</span>}
          {opts.map(o => (
            <label key={o.value} className="flex items-center gap-1 text-sm cursor-pointer">
              <Checkbox checked={arr.includes(o.value)} disabled={disabled} onCheckedChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    case "ref_material":
      return <RefMaterialInput value={value ?? ""} onChange={onChange} disabled={disabled} />;
    case "repeater":
      return <RepeaterInput field={field} allFields={allFields} value={value} onChange={onChange} />;
    case "text":
    default:
      return <Input disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function normalizeOptions(raw: any): { value: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: any) => {
    if (typeof o === "string") return { value: o, label: o };
    if (o && typeof o === "object") return { value: String(o.value ?? o.label), label: String(o.label ?? o.value) };
    return { value: String(o), label: String(o) };
  });
}

function RefMaterialInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { data: rawMats = [] } = useQuery({
    queryKey: ["raw-materials-lookup"],
    queryFn: () => api.rawMaterials.list(),
  });
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)} disabled={disabled}>
      <SelectTrigger><SelectValue placeholder="Rohstoff wählen" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">–</SelectItem>
        {(rawMats as any[]).map(m => (
          <SelectItem key={m.id} value={m.id}>
            {m.code ? `${m.code} — ` : ""}{m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RepeaterInput({
  field, allFields, value, onChange,
}: {
  field: FormField;
  allFields: FormField[];
  value: any;
  onChange: (v: any) => void;
}) {
  const meta = readRepeaterMeta(field);
  const children = repeaterChildren(allFields, field.id);
  const entries: Record<string, any>[] = Array.isArray(value) ? value : [];

  const addEntry = () => {
    if (typeof meta.max_entries === "number" && entries.length >= meta.max_entries) return;
    onChange([...entries, {}]);
  };
  const removeEntry = (i: number) => {
    if (typeof meta.min_entries === "number" && entries.length <= meta.min_entries) return;
    onChange(entries.filter((_, idx) => idx !== i));
  };
  const updateEntry = (i: number, patch: Record<string, any>) => {
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/20">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">Noch keine Einträge.</p>
      )}
      {entries.map((entry, i) => (
        <div key={i} className="flex items-start gap-2 p-2 border rounded bg-background">
          <span className="text-xs text-muted-foreground pt-2 w-20">{meta.item_label} {i + 1}</span>
          <div className="flex-1 grid gap-2 md:grid-cols-3">
            {children.map(c => (
              <div key={c.id} className="space-y-1">
                <Label className="text-xs">{c.display_name}</Label>
                <FieldInput
                  field={c}
                  allFields={allFields}
                  value={entry[c.field_key]}
                  onChange={(v) => updateEntry(i, { [c.field_key]: v })}
                />
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(i)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        <Plus className="h-4 w-4 mr-1" />
        {meta.add_label || "Eintrag hinzufügen"}
      </Button>
    </div>
  );
}

/**
 * Utility: derive a "Laufzettel"-style text summary from dynamic form values.
 * Kept generic so any template can produce a rendered summary without code changes.
 */
export function buildLaufzettelText(values: Record<string, any>, fields: FormField[]): string {
  const lines: string[] = [];
  const top = topLevelFields(fields);

  const findVal = (key: string) => values[key];

  // Prefer well-known keys if present, otherwise fall back to iterating all fields.
  const number = findVal("experiment_number");
  const variant = findVal("variante");
  if (number || variant) lines.push([number, variant].filter(Boolean).join(" "));

  const material = findVal("hauptrohstoff");
  if (material) {
    lines.push("");
    lines.push("Hauptrohstoff:");
    lines.push(String(material));
  }
  const lot = findVal("lotnummer");
  if (lot) {
    lines.push("");
    lines.push("Lotnummer:");
    lines.push(String(lot));
  }
  const goals = findVal("versuchsziel");
  if (Array.isArray(goals) && goals.length) {
    lines.push("");
    lines.push("Bewertung");
    goals.forEach((g: string) => lines.push(`• ${g}`));
  }
  const adds = findVal("zusatzstoffe");
  if (Array.isArray(adds) && adds.length) {
    lines.push("");
    adds.forEach((a: any) => {
      const parts = [a.zusatzstoff, a.menge, a.einheit].filter(Boolean).join(" ");
      if (parts) lines.push(parts);
    });
  }
  const remark = findVal("bemerkung_versuch") ?? findVal("remarks");
  if (remark) {
    lines.push("");
    lines.push(String(remark));
  }

  // If nothing well-known produced content, dump everything readable.
  if (lines.length === 0) {
    top.forEach((f) => {
      const v = values[f.field_key];
      if (v == null || v === "") return;
      lines.push(`${f.display_name}: ${Array.isArray(v) ? v.join(", ") : v}`);
    });
  }

  return lines.join("\n");
}
