import { useMemo, useState, useEffect, createContext, useContext, useCallback } from "react";
import { columnsGridStyle } from "@/lib/api/formDefinitionLayout";
import type { LayoutNode, FieldNode, TabsNode, ColumnsNode, LayoutWidth, FormLayoutTree, CalculationNode } from "@/lib/api/formDefinitionLayout";
import { type FormField, readRepeaterMeta, repeaterChildren } from "@/lib/api/formFields";
import {
  normalizeRepeaterLayout, repeaterWidthClass, repeaterGapClass,
  type RepeaterLayoutItem,
} from "@/lib/repeaterLayout";
import type { EffectivePermission } from "@/lib/api/formFieldPermissions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, Plus, Trash2, ArrowUp, ArrowDown, Copy, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { evaluateValidations, validationIdsFromMetadata } from "@/lib/globalValidation";
import { useSystemTextRenderer } from "@/context/ProcessContextProvider";
import { containsSystemToken } from "@/lib/systemVariables";
import RawMaterialSelectField from "@/components/RawMaterialSelectField";
import { Calculator } from "lucide-react";
import { evaluateLocalCalculations, formatCalcResult } from "@/lib/localCalculations";
import type { FormCalculation } from "@/lib/api/formCalculations";
import { runCalculation } from "@/lib/calculationBindings";
import { walkNodes } from "@/lib/api/formDefinitionLayout";

/* ----------------------------------------------------------------
 * Context: permissions + interactive value binding
 * ---------------------------------------------------------------- */

const PermissionsCtx = createContext<Map<string, EffectivePermission> | null>(null);
const usePerm = (fieldId: string): EffectivePermission => {
  const m = useContext(PermissionsCtx);
  return m?.get(fieldId) ?? { visibility: "write", required: false, can_add: true, can_remove: true };
};

interface ValuesCtxShape {
  /** get value for a top-level field_key */
  get: (key: string) => any;
  /** set value for a top-level field_key */
  set: (key: string, v: any) => void;
  /** interactive (non-preview) rendering */
  interactive: boolean;
}
const ValuesCtx = createContext<ValuesCtxShape | null>(null);

/** Nested overlay context used inside repeater entries so field values bind to
 *  the entry object instead of the top-level form state. */
export interface CalcDisplayResult {
  value: number | null;
  error: string | null;
  label: string;
  unit: string | null;
  decimals: number;
  description?: string | null;
}

/** Ergebnisse aller im Formular eingebundenen Berechnungen (lokal + global). */
const CalcResultsCtx = createContext<Record<string, CalcDisplayResult>>({});

const EntryScopeCtx = createContext<{
  get: (key: string) => any;
  set: (key: string, v: any) => void;
} | null>(null);

const useBinding = (fieldKey: string) => {
  const entry = useContext(EntryScopeCtx);
  const root = useContext(ValuesCtx);
  if (entry) return { value: entry.get(fieldKey), setValue: (v: any) => entry.set(fieldKey, v), interactive: !!root?.interactive };
  return { value: root?.get(fieldKey), setValue: (v: any) => root?.set(fieldKey, v), interactive: !!root?.interactive };
};

/* ----------------------------------------------------------------
 * Layout helpers
 * ---------------------------------------------------------------- */

/**
 * Einheitliche Breitenklassen für ALLE Knotentypen (Felder, Berechnungen,
 * Container). Statische Tailwind-Klassen, damit jede Breite von 1/12 bis 12/12
 * zur Verfügung steht – dadurch können Eingaben und Berechnungen in derselben
 * Zeile liegen, ohne dass ein Element in eine eigene Zeile springt.
 */
const widthCls = (w?: LayoutWidth) => {
  switch (Math.max(1, Math.min(12, Math.round(Number(w ?? 12)))) as number) {
    case 1: return "col-span-6 md:col-span-1";
    case 2: return "col-span-6 md:col-span-2";
    case 3: return "col-span-6 md:col-span-3";
    case 4: return "col-span-6 md:col-span-4";
    case 5: return "col-span-12 md:col-span-5";
    case 6: return "col-span-12 md:col-span-6";
    case 7: return "col-span-12 md:col-span-7";
    case 8: return "col-span-12 md:col-span-8";
    case 9: return "col-span-12 md:col-span-9";
    case 10: return "col-span-12 md:col-span-10";
    case 11: return "col-span-12 md:col-span-11";
    default: return "col-span-12";
  }

};

/* ----------------------------------------------------------------
 * Einheitliche Hülle für ALLE Formularelemente (Feld, Berechnung, …)
 *
 * Ziel: gleiche Label-Zone, gleiche Kontrollhöhe, gleiche Abstände. Der
 * Außenabstand kommt ausschließlich vom Grid (gap), nie vom Element selbst.
 * ---------------------------------------------------------------- */

/** Reservierte Höhe der Label-Zeile (max. 2 Zeilen) – hält Controls auf einer Linie. */
const LABEL_ZONE = "text-xs leading-tight min-h-[1.75rem] flex items-start gap-1 [overflow-wrap:anywhere]";
/** Einheitliche Mindesthöhe von Eingaben/Anzeigen. */
export const CONTROL_H = "min-h-9";

function FormItemShell({
  label, required, unit, locked, icon, highlight, control, footer,
}: {
  label: React.ReactNode;
  required?: boolean;
  unit?: string | null;
  locked?: boolean;
  icon?: React.ReactNode;
  highlight?: boolean;
  control: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn("flex h-full flex-col gap-1", highlight && HIGHLIGHT_CLS)}>
      <Label className={LABEL_ZONE}>
        {icon}
        <span className="line-clamp-2">{label}</span>
        {required && <span className="text-destructive">*</span>}
        {unit && <span className="text-muted-foreground font-normal">[{unit}]</span>}
        {locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Gesperrt" />}
      </Label>
      <div className={cn("min-w-0", CONTROL_H)}>{control}</div>
      {footer}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Field renderer (works for both top-level and inside-repeater)
 * ---------------------------------------------------------------- */


function FieldControl({ field, readonly }: { field: FormField; readonly: boolean }) {
  const { value, setValue, interactive } = useBinding(field.field_key);
  const disabled = readonly || !interactive;
  const renderTokens = useSystemTextRenderer();

  // Systemvariablen sind read-only: enthält der Standardwert ein {{...}}-Token,
  // wird der aktuelle Kontextwert angezeigt statt eines Eingabefeldes.
  if (containsSystemToken(field.default_value)) {
    const resolved = renderTokens(field.default_value ?? "");
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40 text-sm">
        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="truncate">{resolved || "—"}</span>
      </div>
    );
  }

  switch (field.field_type) {
    case "longtext":
      return (
        <Textarea
          rows={3}
          disabled={disabled}
          value={value ?? ""}
          placeholder={field.default_value ?? ""}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    case "boolean":
      return (
        <div className="flex h-9 items-center">
          <Switch checked={!!value} disabled={disabled} onCheckedChange={(v) => setValue(v)} />
        </div>
      );

    case "select":
    case "multiselect":
      return (
        <Select value={value ?? ""} onValueChange={(v) => setValue(v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {(field.select_options ?? []).map((o, i) => {
              const v = typeof o === "string" ? o : o.value;
              const l = typeof o === "string" ? o : o.label;
              return <SelectItem key={i} value={v || String(i)}>{l}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      );
    case "date":
    case "time":
    case "datetime":
      return (
        <Input
          type={field.field_type === "datetime" ? "datetime-local" : field.field_type}
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    case "number":
    case "decimal":
    case "percent":
      return (
        <Input
          type="number"
          disabled={disabled}
          value={value ?? ""}
          placeholder={field.default_value ?? ""}
          onChange={(e) => setValue(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "ref_material":
      // Auswahl aus der bestehenden Rohstoffverwaltung (inkl. externer Rohstoffe).
      return (
        <RawMaterialSelectField
          value={value}
          disabled={disabled}
          onChange={(v) => setValue(v)}
        />
      );
    case "file":
    case "image":
      return <Input type="file" disabled={disabled} />;
    default:
      return (
        <Input
          type="text"
          disabled={disabled}
          value={value ?? ""}
          placeholder={field.default_value ?? ""}
          onChange={(e) => setValue(e.target.value)}
        />
      );
  }
}

function FieldWithLabel({ field, node, allFields, highlight }: { field: FormField; node: FieldNode; allFields: FormField[]; highlight?: boolean }) {
  const perm = usePerm(field.id);
  const renderTokens = useSystemTextRenderer();
  if (perm.visibility === "hidden") return null;

  // Repeater special-case
  if (field.field_type === "repeater") {
    return <RepeaterField field={field} node={node} allFields={allFields} />;
  }

  const label = renderTokens(node.label_override || field.display_name);
  const desc = renderTokens(node.description_override ?? field.description ?? "") || null;
  const readonly = node.readonly || field.readonly || perm.visibility === "read" ||
    containsSystemToken(field.default_value);
  const required = perm.required || field.is_required;

  return (
    <FormItemShell
      label={label}
      required={required}
      unit={field.unit}
      locked={perm.locked}
      highlight={highlight}
      control={<FieldControl field={field} readonly={readonly} />}
      footer={
        <>
          <GlobalValidationHint field={field} />
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </>
      }
    />
  );
}


/**
 * Zeigt Verstöße gegen zentral definierte globale Validierungen an.
 * Rein additiv: Felder ohne verknüpfte Regeln verhalten sich unverändert.
 */
function GlobalValidationHint({ field }: { field: FormField }) {
  const ids = validationIdsFromMetadata(field.metadata);
  const { value } = useBinding(field.field_key);
  const { data: rules = [] } = useQuery({
    queryKey: ["global-validations"],
    queryFn: () => api.globalValidations.list(),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  if (ids.length === 0) return null;
  const issues = evaluateValidations(value, rules.filter((r) => ids.includes(r.id)));
  if (issues.length === 0) return null;
  return (
    <div className="space-y-0.5">
      {issues.map((i) => (
        <p
          key={i.validationKey}
          className={cn(
            "flex items-center gap-1 text-xs",
            i.severity === "error" ? "text-destructive" : "text-amber-600"
          )}
        >
          <AlertTriangle className="h-3 w-3" /> {i.message}
        </p>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Repeater
 * ---------------------------------------------------------------- */

function RepeaterField({
  field, node, allFields,
}: { field: FormField; node: FieldNode; allFields: FormField[] }) {
  const perm = usePerm(field.id);
  const meta = readRepeaterMeta(field);
  const children = useMemo(() => repeaterChildren(allFields, field.id), [allFields, field.id]);

  const storageKey = meta.storage_key || field.field_key;
  const root = useContext(ValuesCtx);
  const rawList = root?.get(storageKey);
  const entries: Array<Record<string, any>> = Array.isArray(rawList) ? rawList : [];

  const interactive = !!root?.interactive;
  const readonly = node.readonly || field.readonly || perm.visibility === "read";
  const canAdd = interactive && !readonly && (perm.can_add ?? true) &&
    (meta.max_entries == null || entries.length < meta.max_entries);
  const canRemove = interactive && !readonly && (perm.can_remove ?? true);

  const label = node.label_override || field.display_name;
  const desc = node.description_override ?? field.description;

  const updateEntries = (next: Array<Record<string, any>>) => root?.set(storageKey, next);

  const add = () => {
    const next = [...entries, {} as Record<string, any>];
    updateEntries(next);
  };
  const removeAt = (i: number) => {
    if (meta.min_entries && entries.length <= meta.min_entries) return;
    const next = entries.filter((_, idx) => idx !== i);
    updateEntries(next);
  };
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = entries.slice();
    [next[i], next[j]] = [next[j], next[i]];
    updateEntries(next);
  };
  const duplicateAt = (i: number) => {
    if (meta.max_entries != null && entries.length >= meta.max_entries) return;
    const next = entries.slice();
    next.splice(i + 1, 0, JSON.parse(JSON.stringify(entries[i] ?? {})));
    updateEntries(next);
  };

  // Auto-seed min_entries in interactive mode
  if (interactive && !readonly && meta.min_entries && entries.length < meta.min_entries) {
    const seeded = entries.slice();
    while (seeded.length < meta.min_entries) seeded.push({});
    // Defer to avoid setState during render
    queueMicrotask(() => updateEntries(seeded));
  }

  return (
    <div className="border rounded-md bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline">{entries.length}{meta.max_entries ? ` / ${meta.max_entries}` : ""}</Badge>
          {perm.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </div>
        {canAdd && (
          <Button size="sm" variant="outline" onClick={add} type="button">
            <Plus className="h-3 w-3 mr-1" />{meta.add_label}
          </Button>
        )}
      </div>
      {desc && <p className="text-xs text-muted-foreground px-3 pt-2">{desc}</p>}
      <div className="p-3 space-y-3">
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Noch keine Einträge.
          </p>
        )}
        {entries.map((entry, i) => (
          <RepeaterEntry
            key={i}
            index={i}
            entry={entry}
            children={children}
            allFields={allFields}
            readonly={readonly}
            layout={meta.layout}
            canRemove={canRemove && (!meta.min_entries || entries.length > meta.min_entries)}
            canReorder={interactive && !readonly}
            itemLabel={meta.item_label ?? "Eintrag"}
            onChange={(next) => {
              const arr = entries.slice();
              arr[i] = next;
              updateEntries(arr);
            }}
            onRemove={() => removeAt(i)}
            onMoveUp={() => moveAt(i, -1)}
            onMoveDown={() => moveAt(i, 1)}
            onDuplicate={() => duplicateAt(i)}
          />
        ))}
      </div>
    </div>
  );
}

function RepeaterEntry({
  index, entry, children, allFields, readonly, layout,
  canRemove, canReorder, itemLabel,
  onChange, onRemove, onMoveUp, onMoveDown, onDuplicate,
}: {
  index: number;
  entry: Record<string, any>;
  children: FormField[];
  allFields: FormField[];
  readonly: boolean;
  layout?: unknown;
  canRemove: boolean;
  canReorder: boolean;
  itemLabel: string;
  onChange: (next: Record<string, any>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  const scope = useMemo<{ get: (k: string) => any; set: (k: string, v: any) => void }>(() => ({
    get: (k) => entry?.[k],
    set: (k, v) => onChange({ ...(entry ?? {}), [k]: v }),
  }), [entry, onChange]);

  const keys = useMemo(() => children.map((c) => c.field_key), [children]);
  const tree = useMemo(() => normalizeRepeaterLayout(layout, keys), [layout, keys]);
  const byKey = useMemo(
    () => Object.fromEntries(children.map((c) => [c.field_key, c])) as Record<string, FormField>,
    [children]
  );

  const renderItem = (item: RepeaterLayoutItem): JSX.Element | null => {
    if (item.type === "break") return <div key={item.id} className="col-span-12 h-0" />;
    if (item.type === "spacer") return <div key={item.id} className={repeaterWidthClass(item.width)} />;
    if (item.type === "heading") {
      return (
        <div key={item.id} className={cn(repeaterWidthClass(item.width), "text-xs font-semibold text-muted-foreground pt-1")}>
          {item.text}
        </div>
      );
    }
    if (item.type === "group") {
      return (
        <div key={item.id} className={cn(repeaterWidthClass(item.width), "rounded border p-2 bg-muted/20")}>
          {item.title && <p className="text-[11px] font-medium mb-2">{item.title}</p>}
          <div className={cn("grid grid-cols-12", repeaterGapClass(tree.gap))}>
            {item.children.map(renderItem)}
          </div>
        </div>
      );
    }
    const cf = byKey[item.key];
    if (!cf) return null;
    return (
      <div key={item.id} className={repeaterWidthClass(item.width)}>
        <FieldWithLabel
          field={cf}
          node={{ id: `inline-${cf.id}`, type: "field", field_id: cf.id, width: 12 }}
          allFields={allFields}
        />
      </div>
    );
  };

  return (
    <EntryScopeCtx.Provider value={scope}>
      <div className="border rounded p-3 bg-background">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{itemLabel} {index + 1}</span>
          <div className="flex items-center gap-1">
            {canReorder && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveUp} type="button" title="Nach oben"><ArrowUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveDown} type="button" title="Nach unten"><ArrowDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDuplicate} type="button" title="Duplizieren"><Copy className="h-3 w-3" /></Button>
              </>
            )}
            {canRemove && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} type="button" title="Entfernen">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className={cn("grid grid-cols-12", repeaterGapClass(tree.gap))}>
          {tree.items.map(renderItem)}
          {children.length === 0 && (
            <p className="col-span-12 text-xs text-muted-foreground">
              Für diesen Repeater sind noch keine Unterfelder definiert.
            </p>
          )}
        </div>
      </div>
    </EntryScopeCtx.Provider>
  );
}

/* ----------------------------------------------------------------
 * Node renderer
 * ---------------------------------------------------------------- */

function RenderNode({ node, fields }: { node: LayoutNode; fields: FormField[] }) {
  const tr = useSystemTextRenderer();
  if (node.visible === false) return null;

  switch (node.type) {
    case "section": {
      const n = node;
      return (
        <div className={cn("border rounded-lg p-4 bg-card", widthCls(n.width), n.highlight && HIGHLIGHT_CLS, n.className)}>
          {n.title && <div className="font-semibold text-sm mb-1">{tr(n.title)}</div>}
          {n.description && <p className="text-xs text-muted-foreground mb-3">{tr(n.description)}</p>}
          <div className="grid grid-cols-12 gap-3">
            {n.children.map(c => <RenderNode key={c.id} node={c} fields={fields} />)}
          </div>
        </div>
      );
    }
    case "group":
    case "container": {
      const n = node;
      return (
        <div className={cn("border rounded p-3", widthCls(n.width), (n as any).highlight && HIGHLIGHT_CLS, n.className)}>
          {(n as any).title && <div className="font-medium text-sm mb-2">{tr((n as any).title)}</div>}
          <div className="grid grid-cols-12 gap-3">
            {(n as any).children.map((c: LayoutNode) => <RenderNode key={c.id} node={c} fields={fields} />)}
          </div>
        </div>
      );
    }
    case "tabs": {
      const n = node as TabsNode;
      const first = n.children[0]?.id ?? "";
      return (
        <div className={cn(widthCls(n.width), n.className)}>
          <TabsInner defaultTab={first} tabs={n.children.map((t) => ({ id: t.id, title: (t as any).title ?? t.id }))}>
            {n.children.map(t => (
              <TabsContent key={t.id} value={t.id} className="mt-3">
                <div className="grid grid-cols-12 gap-3">
                  {t.children.map(c => <RenderNode key={c.id} node={c} fields={fields} />)}
                </div>
              </TabsContent>
            ))}
          </TabsInner>
        </div>
      );
    }
    case "columns": {
      const n = node as ColumnsNode;
      return (
        <div className={cn("rox-cols gap-3", widthCls(n.width), n.className)} style={columnsGridStyle(n) as any}>
          {n.children.map(col => (
            <div key={col.id} className="min-w-0">
              <div className="grid grid-cols-12 gap-3">
                {col.children.map(c => <RenderNode key={c.id} node={c} fields={fields} />)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "divider":
      return <div className={cn("col-span-12", node.className)}><hr className="my-2" /></div>;
    case "heading": {
      const n = node;
      const H = (`h${n.level ?? 3}` as any);
      return <H className={cn("col-span-12 font-semibold", n.highlight && "text-primary", n.level === 1 && "text-2xl", n.level === 2 && "text-xl", (!n.level || n.level >= 3) && "text-base", n.className)}>{tr(n.text)}</H>;
    }
    case "note": {
      const n = node;
      const vc = n.variant === "warning" ? "bg-amber-50 border-amber-200 text-amber-900" : n.variant === "muted" ? "bg-muted text-muted-foreground" : "bg-primary/5 border-primary/20";
      return <div className={cn("col-span-12 text-sm border rounded p-3", vc, n.highlight && HIGHLIGHT_CLS, n.className)}>{tr(n.text)}</div>;
    }
    case "field": {
      const f = fields.find(x => x.id === node.field_id);
      if (!f) {
        return (
          <div className={cn(widthCls(node.width), node.className)}>
            <div className="border border-dashed rounded p-2 text-xs text-muted-foreground bg-muted/40">
              Feld nicht gefunden (id: {node.field_id?.slice(0, 8)}…)
            </div>
          </div>
        );
      }
      return (
        <div className={cn(widthCls(node.width), node.className)}>
          <div className={cn(node.highlight && cn("rounded-md border p-2", HIGHLIGHT_CLS))}>
            <FieldWithLabel field={f} node={node} allFields={fields} />
          </div>
        </div>
      );
    }
    case "calculation": {
      const n = node as CalculationNode;
      return (
        <div className={cn(widthCls(n.width), n.className)}>
          <CalculationDisplay node={n} />
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * Einheitliche Hervorhebungs-Darstellung (ursprünglich nur für Berechnungen).
 * Reine Optik – ohne Einfluss auf Rollenrechte oder offizielle Ergebnisse.
 */
export const HIGHLIGHT_CLS = "border-primary/50 bg-primary/5 font-medium";

function CalculationDisplay({ node }: { node: CalculationNode }) {
  const results = useContext(CalcResultsCtx);
  const res = results[`${node.scope}:${node.calc_key}`];
  const label = node.label_override || res?.label || node.calc_key || "Berechnung";
  const desc = node.description_override ?? res?.description ?? null;

  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1">
        <Calculator className="h-3 w-3 text-muted-foreground" />
        {label}
        {node.show_unit !== false && res?.unit && (
          <span className="text-muted-foreground font-normal ml-1">[{res.unit}]</span>
        )}
      </Label>
      <div className={cn(
        "flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40 text-sm",
        node.highlight && HIGHLIGHT_CLS,
      )}>
        {res
          ? <span className="truncate">{formatCalcResult(res.value, res.decimals, node.show_unit === false ? null : res.unit)}</span>
          : <span className="text-muted-foreground text-xs">Berechnung nicht gefunden</span>}
        <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
      </div>
      {res?.error && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{res.error}</p>}
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
  );
}

function TabsInner({ defaultTab, tabs, children }: { defaultTab: string; tabs: { id: string; title: string }[]; children: React.ReactNode }) {
  const [val, setVal] = useState(defaultTab);
  return (
    <Tabs value={val} onValueChange={setVal}>
      <TabsList>
        {tabs.map(t => <TabsTrigger key={t.id} value={t.id}>{t.title}</TabsTrigger>)}
      </TabsList>
      {children}
    </Tabs>
  );
}

/* ----------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------------- */

export default function FormLayoutRenderer({
  layout,
  fields,
  permissions,
  values,
  onChange,
  formId,
  localCalculations,
}: {
  layout: FormLayoutTree;
  fields: FormField[];
  permissions?: Map<string, EffectivePermission>;
  /** When provided, the renderer is interactive and binds inputs to these values. */
  values?: Record<string, any>;
  onChange?: (key: string, v: any) => void;
  /** Formular-ID: lädt die lokalen Berechnungen dieses Formulars. */
  formId?: string;
  /** Optional bereits geladene lokale Berechnungen (z. B. Live-Vorschau im Designer). */
  localCalculations?: FormCalculation[];
}) {
  const interactive = !!(values && onChange);
  const bind = useMemo<ValuesCtxShape>(() => ({
    get: (k) => values?.[k],
    set: (k, v) => onChange?.(k, v),
    interactive,
  }), [values, onChange, interactive]);

  const calcNodes = useMemo(() => {
    const out: CalculationNode[] = [];
    walkNodes(layout.nodes, (n) => { if (n.type === "calculation") out.push(n as CalculationNode); });
    return out;
  }, [layout]);
  const hasGlobalNodes = calcNodes.some((n) => n.scope === "global");

  const { data: fetchedLocal = [] } = useQuery({
    queryKey: ["form-calculations", formId],
    queryFn: () => api.formCalculations.listForForm(formId!),
    enabled: !!formId && !localCalculations,
    staleTime: 60 * 1000,
  });
  const localCalcs = (localCalculations ?? fetchedLocal) as FormCalculation[];

  const { data: globalCalcs = [] } = useQuery({
    queryKey: ["global-calculations"],
    queryFn: () => api.globalCalculations.list(),
    enabled: hasGlobalNodes,
    staleTime: 5 * 60 * 1000,
  });

  const calcResults = useMemo(() => {
    const out: Record<string, CalcDisplayResult> = {};
    const vals = values ?? {};
    const local = evaluateLocalCalculations(localCalcs, vals, fields.map((f) => f.field_key));
    for (const c of localCalcs) {
      const r = local[c.calc_key];
      out[`local:${c.calc_key}`] = {
        value: r?.value ?? null,
        error: r?.error ?? null,
        label: c.display_name,
        unit: c.unit,
        decimals: c.decimals ?? 2,
        description: c.description,
      };
    }
    if (hasGlobalNodes) {
      const enriched = { ...vals } as Record<string, unknown>;
      for (const c of localCalcs) {
        const v = local[c.calc_key]?.value;
        if (v != null) enriched[c.calc_key] = v;
      }
      for (const g of globalCalcs as any[]) {
        const r = runCalculation(g, { formValues: enriched, calculations: globalCalcs as any });
        out[`global:${g.calc_key}`] = {
          value: r.value,
          error: r.error,
          label: g.display_name,
          unit: g.unit ?? null,
          decimals: g.decimals ?? 2,
          description: g.description,
        };
      }
    }
    return out;
  }, [localCalcs, globalCalcs, values, hasGlobalNodes, fields]);

  /** Ergebnisse in die Formularwerte zurückschreiben – für Speicherung & Folgeberechnungen. */
  useEffect(() => {
    if (!interactive) return;
    for (const [k, r] of Object.entries(calcResults)) {
      const key = k.split(":")[1];
      if (!key) continue;
      if ((values as any)?.[key] !== r.value) onChange?.(key, r.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcResults, interactive]);

  if (!layout.nodes.length) {
    return <div className="text-sm text-muted-foreground border rounded p-6 text-center">Noch keine Elemente im Layout.</div>;
  }
  return (
    <PermissionsCtx.Provider value={permissions ?? null}>
      <CalcResultsCtx.Provider value={calcResults}>
      <ValuesCtx.Provider value={bind}>
        <div className="grid grid-cols-12 gap-3">
          {layout.nodes.map(n => <RenderNode key={n.id} node={n} fields={fields} />)}
        </div>
      </ValuesCtx.Provider>
      </CalcResultsCtx.Provider>
    </PermissionsCtx.Provider>
  );
}
