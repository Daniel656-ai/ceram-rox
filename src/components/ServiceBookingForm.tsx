import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";

interface Props {
  serviceId: string;
  roleView: FormRoleView;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  compact?: boolean;
}

/**
 * Renders the booking form configured in the Service Designer for the
 * given service & role. Falls back to `null` if no layout exists, so the
 * caller can decide whether to render a legacy parameter form instead.
 */
export default function ServiceBookingForm({ serviceId, roleView, values, onChange, compact }: Props) {
  const { data: fields = [] } = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId),
  });
  const { data: layout } = useQuery({
    queryKey: ["service-form-layout", serviceId, roleView],
    queryFn: () => api.serviceFormLayouts.get(serviceId, roleView),
  });
  const { data: rulesRow } = useQuery({
    queryKey: ["service-rules", serviceId],
    queryFn: () => api.serviceRules.getForService(serviceId),
  });

  const fieldById = useMemo(() => {
    const m = new Map<string, any>();
    for (const f of fields) m.set(f.id, f);
    return m;
  }, [fields]);

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
  if (sections.length === 0) return null;

  const inputSize = compact ? "h-8 text-xs" : "";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {sections.map((sec) => (
        <div key={sec.id} className="border rounded-md p-3 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            {sec.title}
            <Badge variant="outline" className="text-[10px]">Designer</Badge>
          </div>
          {sec.description && <p className="text-xs text-muted-foreground">{sec.description}</p>}
          <div className="grid grid-cols-12 gap-3">
            {sec.fields.map((ref) => {
              const f = fieldById.get(ref.field_id);
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
              const val = values[f.field_key];
              const hasError = isRequired && (val == null || val === "");
              const readonly = ref.readonly || f.readonly;
              const label = ref.label_override?.trim() || f.display_name;
              const help = ref.description_override?.trim() || f.description;
              return (
                <div key={ref.id} className={colCls}>
                  <Label className="text-xs flex items-center gap-1">
                    {label}
                    {f.unit && <span className="text-muted-foreground font-normal">({f.unit})</span>}
                    {isRequired && <span className="text-destructive">*</span>}
                    {hasError && <AlertCircle className="h-3 w-3 text-destructive" />}
                  </Label>
                  {help && !compact && (
                    <p className="text-[10px] text-muted-foreground mb-1">{help}</p>
                  )}
                  {renderInput(f, val, (v) => onChange(f.field_key, v), readonly, inputSize, hasError)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderInput(field: any, value: any, onChange: (v: any) => void, readonly: boolean, sizeCls: string, hasError: boolean) {
  const errCls = hasError ? "border-destructive" : "";
  const cls = `${sizeCls} ${errCls}`.trim();
  switch (field.field_type) {
    case "longtext":
      return <Textarea rows={3} disabled={readonly} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={errCls} />;
    case "number":
    case "decimal":
    case "percent":
      return <Input type="number" step="any" disabled={readonly} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "date":
      return <Input type="date" disabled={readonly} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "datetime":
      return <Input type="datetime-local" disabled={readonly} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "time":
      return <Input type="time" disabled={readonly} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch disabled={readonly} checked={!!value} onCheckedChange={onChange} />
          <span className="text-xs">{value ? "Ja" : "Nein"}</span>
        </div>
      );
    case "select": {
      const opts = (field.select_options || []).map((o: any) => typeof o === "string" ? { label: o, value: o } : o);
      return (
        <Select value={value ?? ""} onValueChange={onChange} disabled={readonly}>
          <SelectTrigger className={cls}><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
          <SelectContent>
            {opts.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    default:
      return <Input disabled={readonly} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cls} />;
  }
}

/**
 * Hook to check whether a service has a published booking form for the
 * given role view. Useful to show admin warnings.
 */
export function useServiceHasFormLayout(serviceId: string | null, roleView: FormRoleView = "customer") {
  return useQuery({
    queryKey: ["service-form-layout-exists", serviceId, roleView],
    queryFn: async () => {
      if (!serviceId) return false;
      const l = await api.serviceFormLayouts.get(serviceId, roleView);
      return !!(l?.layout?.sections && l.layout.sections.length > 0);
    },
    enabled: !!serviceId,
  });
}
