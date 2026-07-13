import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Trash2, Copy, ArrowUp, ArrowDown, Repeat, Calculator } from "lucide-react";
import UploadField from "@/components/upload/UploadField";
import { evaluateFormula } from "@/lib/formulaEngine";
import type { FormRoleView, FormSection, RepeatableConfig } from "@/lib/api/serviceFormLayouts";

interface Props {
  serviceId: string;
  roleView: FormRoleView;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  compact?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const repeaterStorageKey = (sec: FormSection) =>
  sec.repeatable?.storage_key || `repeat:${sec.id}`;

/** Public helper: extract repeatable entries from a form value map for a section. */
export function getRepeaterEntries(values: Record<string, any>, sec: FormSection): Array<Record<string, any>> {
  const key = repeaterStorageKey(sec);
  const v = values[key];
  return Array.isArray(v) ? v : [];
}

/**
 * Renders the booking form configured in the Service Designer for the
 * given service & role.
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

  // Auto-compute: recompute all computed fields whenever inputs change.
  const computedFields = useMemo(
    () => (fields as any[]).filter((f) => f.field_type === "computed" && !f.archived),
    [fields]
  );
  useEffect(() => {
    if (computedFields.length === 0) return;
    for (const f of computedFields) {
      const formula = (f.validation as any)?.formula ?? "";
      if (!formula) continue;
      const { value } = evaluateFormula(formula, values);
      const decimals = f.decimal_places;
      const rounded =
        value != null && typeof decimals === "number" && decimals >= 0
          ? Number(value.toFixed(decimals))
          : value;
      const next = rounded == null ? "" : String(rounded);
      if (String(values[f.field_key] ?? "") !== next) {
        onChange(f.field_key, next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, computedFields]);

  if (sections.length === 0) return null;

  const inputSize = compact ? "h-8 text-xs" : "";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {sections.map((sec) =>
        sec.repeatable?.enabled ? (
          <RepeatableSection
            key={sec.id}
            sec={sec}
            fieldById={fieldById}
            values={values}
            onChange={onChange}
            evaluatedRules={evaluatedRules}
            inputSize={inputSize}
            compact={compact}
          />
        ) : (
          <StaticSection
            key={sec.id}
            sec={sec}
            fieldById={fieldById}
            values={values}
            onValueChange={(key, v) => onChange(key, v)}
            evaluatedRules={evaluatedRules}
            inputSize={inputSize}
            compact={compact}
          />
        )
      )}
    </div>
  );
}

// ---------------- Static (non-repeatable) section ----------------

function StaticSection({
  sec, fieldById, values, onValueChange, evaluatedRules, inputSize, compact,
}: {
  sec: FormSection;
  fieldById: Map<string, any>;
  values: Record<string, any>;
  onValueChange: (key: string, v: any) => void;
  evaluatedRules: { hidden: Set<string>; required: Set<string> };
  inputSize: string;
  compact?: boolean;
}) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="text-sm font-semibold flex items-center gap-2">
        {sec.title}
        <Badge variant="outline" className="text-[10px]">Designer</Badge>
      </div>
      {sec.description && <p className="text-xs text-muted-foreground">{sec.description}</p>}
      <SectionFieldGrid
        sec={sec}
        fieldById={fieldById}
        values={values}
        onValueChange={onValueChange}
        evaluatedRules={evaluatedRules}
        inputSize={inputSize}
        compact={compact}
      />
    </div>
  );
}

// ---------------- Repeatable section ----------------

function RepeatableSection({
  sec, fieldById, values, onChange, evaluatedRules, inputSize, compact,
}: {
  sec: FormSection;
  fieldById: Map<string, any>;
  values: Record<string, any>;
  onChange: (key: string, v: any) => void;
  evaluatedRules: { hidden: Set<string>; required: Set<string> };
  inputSize: string;
  compact?: boolean;
}) {
  const rep: RepeatableConfig = sec.repeatable!;
  const storageKey = repeaterStorageKey(sec);
  const rawEntries = Array.isArray(values[storageKey]) ? values[storageKey] : [];

  const ensureMin = (arr: Array<Record<string, any>>) => {
    const min = Math.max(rep.min ?? 1, 0);
    const out = [...arr];
    while (out.length < min) out.push({ __id: uid() });
    return out;
  };

  const entries = useMemo(() => {
    if (rawEntries.length === 0 && (rep.min ?? 1) > 0) return ensureMin([]);
    return rawEntries.map((e: any) => (e && typeof e === "object" ? e : { __id: uid() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawEntries, rep.min]);

  const commit = (next: Array<Record<string, any>>) => onChange(storageKey, next);

  const max = rep.max && rep.max > 0 ? rep.max : Infinity;
  const itemLabel = rep.item_label?.trim() || "Eintrag";
  const addLabel = rep.add_label?.trim() || `Weiteren ${itemLabel} hinzufügen`;

  const addEntry = () => {
    if (entries.length >= max) return;
    commit([...entries, { __id: uid() }]);
  };
  const duplicate = (idx: number) => {
    if (entries.length >= max) return;
    const copy = { ...entries[idx], __id: uid() };
    const next = [...entries];
    next.splice(idx + 1, 0, copy);
    commit(next);
  };
  const remove = (idx: number) => {
    const min = Math.max(rep.min ?? 1, 0);
    if (entries.length <= min) return;
    commit(entries.filter((_, i) => i !== idx));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };
  const updateEntry = (idx: number, key: string, value: any) => {
    const next = entries.map((e, i) => i === idx ? { ...e, [key]: value } : e);
    commit(next);
  };

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            {sec.title}
            <Badge variant="outline" className="text-[10px] gap-1">
              <Repeat className="h-3 w-3" /> Wiederholbar
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {entries.length}{rep.max ? ` / ${rep.max}` : ""} {itemLabel}
            </span>
          </div>
          {sec.description && <p className="text-xs text-muted-foreground">{sec.description}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={entry.__id ?? idx} className="border rounded-md p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {itemLabel} #{idx + 1}
              </p>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => move(idx, -1)} disabled={idx === 0} title="Nach oben">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => move(idx, 1)} disabled={idx === entries.length - 1} title="Nach unten">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => duplicate(idx)} disabled={entries.length >= max} title="Duplizieren">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                  onClick={() => remove(idx)} disabled={entries.length <= Math.max(rep.min ?? 1, 0)} title="Löschen">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <SectionFieldGrid
              sec={sec}
              fieldById={fieldById}
              values={entry}
              onValueChange={(key, v) => updateEntry(idx, key, v)}
              evaluatedRules={evaluatedRules}
              inputSize={inputSize}
              compact={compact}
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addEntry} disabled={entries.length >= max}>
        <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
      </Button>
    </div>
  );
}

// ---------------- Field grid (shared) ----------------

function SectionFieldGrid({
  sec, fieldById, values, onValueChange, evaluatedRules, inputSize, compact,
}: {
  sec: FormSection;
  fieldById: Map<string, any>;
  values: Record<string, any>;
  onValueChange: (key: string, v: any) => void;
  evaluatedRules: { hidden: Set<string>; required: Set<string> };
  inputSize: string;
  compact?: boolean;
}) {
  return (
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
            {f.field_type === "file" || f.field_type === "image" ? (
              <UploadField
                fieldId={f.id}
                fieldKey={f.field_key}
                label={label}
                helpText={help}
                required={isRequired}
                config={(f.validation as any)?.upload ?? {}}
                value={Array.isArray(val) ? val : []}
                onChange={(v) => onValueChange(f.field_key, v)}
                compact={compact}
              />
            ) : (
              <>
                <Label className="text-xs flex items-center gap-1">
                  {label}
                  {f.unit && <span className="text-muted-foreground font-normal">({f.unit})</span>}
                  {isRequired && <span className="text-destructive">*</span>}
                  {hasError && <AlertCircle className="h-3 w-3 text-destructive" />}
                </Label>
                {help && !compact && (
                  <p className="text-[10px] text-muted-foreground mb-1">{help}</p>
                )}
                {renderInput(f, val, (v) => onValueChange(f.field_key, v), readonly, inputSize, hasError)}
              </>
            )}
          </div>
        );
      })}
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
