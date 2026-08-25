import { useMemo, useState, useEffect, createContext, useContext, useCallback, type ReactNode } from "react";
import { columnsGridStyle } from "@/lib/api/formDefinitionLayout";
import type { LayoutNode, FieldNode, TabsNode, ColumnsNode, LayoutWidth, FormLayoutTree, CalculationNode } from "@/lib/api/formDefinitionLayout";
import { type FormField, readRepeaterMeta, repeaterChildren } from "@/lib/api/formFields";
import {
  readMeasurementBlockMeta, instanceLabel, newInstanceId, toBlockChildDefs, readBlockChildRole,
  INSTANCE_ID_KEY, INSTANCE_LABEL_KEY, INSTANCE_CONTEXT_KEY,
  readMeasurementCaseConfig, buildEntriesFromCase, entriesMatchCase, instanceImportDone,
  CASE_ID_KEY, IMPORT_PROFILE_KEY, type CaseTemplate,
} from "@/lib/measurementBlocks";


import {
  normalizeRepeaterLayout, repeaterWidthClass, repeaterGapClass,
  type RepeaterLayoutItem,
} from "@/lib/repeaterLayout";
import type { EffectivePermission } from "@/lib/api/formFieldPermissions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, Plus, Trash2, ArrowUp, ArrowDown, Copy, AlertTriangle, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { evaluateValidations, validationIdsFromMetadata } from "@/lib/globalValidation";
import { useSystemTextRenderer } from "@/context/ProcessContextProvider";
import { containsSystemToken } from "@/lib/systemVariables";
import RawMaterialSelectField from "@/components/RawMaterialSelectField";
import MeasurementImportDialog from "@/components/measurementImport/MeasurementImportDialog";
import MeasurementCaseEditorDialog from "@/components/measurementImport/MeasurementCaseEditorDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Pencil } from "lucide-react";
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

/**
 * Schreibzugriff auf beliebige Felder im aktuellen Scope (Formular-Root oder
 * aktueller Repeater-Eintrag). Wird vom Messdaten-Import benötigt, der Werte
 * in Geschwisterfelder schreibt.
 */
const useScopeWriter = () => {
  const entry = useContext(EntryScopeCtx);
  const root = useContext(ValuesCtx);
  return useCallback(
    (key: string, v: any) => (entry ? entry.set(key, v) : root?.set(key, v)),
    [entry, root]
  );
};

/** Liest Werte im selben Scope – für Konflikterkennung beim Messdatenimport. */
const useScopeReader = () => {
  const entry = useContext(EntryScopeCtx);
  const root = useContext(ValuesCtx);
  return useCallback(
    (key: string) => (entry ? entry.get(key) : root?.get(key)),
    [entry, root]
  );
};





/**
 * Normalisiert gespeicherte Mehrfachauswahl-Werte auf ein String-Array.
 * Rückwärtskompatibel: Array, JSON-Array-String, Komma-Liste oder Einzelwert.
 */
export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter((s) => s !== "");
  if (v == null || v === "") return [];
  const s = String(v).trim();
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch { /* fällt auf Komma-Trennung zurück */ }
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

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
    case "multiselect": {
      const selected = toStringArray(value);
      const toggle = (v: string, on: boolean) => {
        const next = on ? [...selected.filter((s) => s !== v), v] : selected.filter((s) => s !== v);
        setValue(next);
      };
      const options = field.select_options ?? [];
      return (
        <div className="rounded-md border px-3 py-2 space-y-1.5 min-h-9">
          {options.length === 0 ? (
            <span className="text-xs text-muted-foreground">Keine Optionen konfiguriert</span>
          ) : (
            options.map((o, i) => {
              const v = (typeof o === "string" ? o : o.value) || String(i);
              const l = typeof o === "string" ? o : o.label;
              const id = `${field.id}-ms-${i}`;
              return (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={selected.includes(v)}
                    disabled={disabled}
                    onCheckedChange={(c) => toggle(v, c === true)}
                  />
                  <Label htmlFor={id} className="text-sm font-normal cursor-pointer">{l}</Label>
                </div>
              );
            })
          )}
        </div>
      );
    }

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

/* ----------------------------------------------------------------
 * Messdaten-Import (Copy & Paste aus externer Messsoftware)
 * ---------------------------------------------------------------- */

/** Lesbare Konfiguration des Import-Feldes aus metadata.measurement_import. */
export const readImportMeta = (
  field: FormField
): { profile_id: string | null; allow_manual_mapping: boolean; importers: string[] | null } => {
  const m = ((field.metadata ?? {}) as any).measurement_import ?? {};
  return {
    profile_id: typeof m.profile_id === "string" ? m.profile_id : null,
    allow_manual_mapping: m.allow_manual_mapping !== false,
    importers: Array.isArray(m.importers) ? (m.importers as string[]) : null,
  };
};

function MeasurementImportControl({ field, allFields, readonly }: { field: FormField; allFields: FormField[]; readonly: boolean }) {
  const { value, setValue, interactive } = useBinding(field.field_key);
  const write = useScopeWriter();
  const read = useScopeReader();
  const [open, setOpen] = useState(false);
  const cfg = readImportMeta(field);

  /**
   * Messfall-Steuerung: Wurde die Messung aus einem Messfall erzeugt, gilt das
   * dort hinterlegte Importprofil dieser Messung – jede Messung importiert
   * eigenständig und überschreibt niemals eine andere Messung.
   */
  const instanceProfile = read(IMPORT_PROFILE_KEY);
  const effectiveProfileId =
    (typeof instanceProfile === "string" && instanceProfile) || cfg.profile_id;


  /**
   * Zielfelder sind ausschließlich die Messwertfelder desselben Scopes
   * (Formularabschnitt oder aktuelle Messblock-Instanz). Kontext-/
   * Bezeichnungsfelder eines Messblocks beschreiben die Messung und dürfen
   * durch den Import niemals überschrieben werden.
   */
  const targets = useMemo(
    () =>
      allFields
        .filter(
          (f) =>
            f.id !== field.id &&
            f.parent_field_id === field.parent_field_id &&
            !["repeater", "measurement_block", "measurement_import"].includes(f.field_type) &&
            readBlockChildRole(f) === "value"
        )
        .map((f) => ({ field_key: f.field_key, display_name: f.display_name, unit: f.unit, field_type: f.field_type })),
    [allFields, field.id, field.parent_field_id]
  );

  const currentValues = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const t of targets) out[t.field_key] = read(t.field_key);
    return out;
  }, [targets, read, open]);

  let last: any = null;
  try { last = typeof value === "string" && value.startsWith("{") ? JSON.parse(value) : value; } catch { last = null; }

  /** Übersicht der zuletzt in DIESEN Scope übernommenen Messwerte. */
  const importedKeys: string[] = Array.isArray(last?.keys) ? last.keys : [];
  const importedRows = importedKeys
    .map((k) => {
      const t = targets.find((x) => x.field_key === k);
      const v = read(k);
      return t && v != null && v !== "" ? { label: t.display_name, unit: t.unit, value: v } : null;
    })
    .filter(Boolean) as Array<{ label: string; unit?: string | null; value: unknown }>;

  /** Echte Messwerte ohne Zielfeld – bleiben dieser Messung erhalten. */
  const unassigned: any[] = Array.isArray(last?.unassigned) ? last.unassigned : [];
  /** Technische Metadaten – niemals Ergebniswerte. */
  const metadata: any[] = Array.isArray(last?.metadata) ? last.metadata : [];

  const persist = (next: any) => setValue(JSON.stringify(next));

  /** Nachträgliche Zuordnung eines gespeicherten Messwerts zu einem Ergebnisfeld. */
  const assignLater = (idx: number, fieldKey: string) => {
    const row = unassigned[idx];
    if (!row) return;
    write(fieldKey, row.value ?? row.raw ?? null);
    const rest = unassigned.filter((_, i) => i !== idx);
    persist({
      ...last,
      unassigned: rest,
      keys: [...new Set([...(importedKeys ?? []), fieldKey])],
      count: (last?.count ?? 0) + 1,
    });
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={readonly || !interactive}
        onClick={() => setOpen(true)}
      >
        <ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Messdaten übernehmen
      </Button>
      {last?.imported_at && (
        <p className="text-[11px] text-muted-foreground">
          ✓ Importiert: {new Date(last.imported_at).toLocaleString("de-AT")} · {last.profile ?? "ohne Profil"}
          {last.sample ? ` · ${last.sample}` : ""} · {last.count} Wert(e)
          {last.source ? ` · ${last.source}` : ""}
        </p>
      )}
      {importedRows.length > 0 && (
        <div className="rounded border bg-muted/20 p-2">
          <p className="text-[11px] font-medium mb-1">Zugeordnete Ergebnisse</p>
          <table className="w-full text-[11px]">
            <tbody>
              {importedRows.map((r, i) => (
                <tr key={i}>
                  <td className="pr-2 text-muted-foreground">{r.label}{r.unit ? ` [${r.unit}]` : ""}</td>
                  <td className="text-right font-mono">{String(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50/50 p-2 space-y-1">
          <p className="text-[11px] font-medium text-amber-700">
            Zusätzliche / nicht zugeordnete Messwerte ({unassigned.length})
          </p>
          {unassigned.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="flex-1">⚠ {r.parameter}</span>
              <span className="font-mono">{String(r.value ?? r.raw ?? "")}{r.unit ? ` ${r.unit}` : ""}</span>
              <Select
                value="__none__"
                disabled={readonly || !interactive}
                onValueChange={(v) => { if (v !== "__none__") assignLater(i, v); }}
              >
                <SelectTrigger className="h-7 w-48 text-[11px]"><SelectValue placeholder="Zuordnen…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">Zuordnen…</SelectItem>
                  {targets.map((t) => (
                    <SelectItem key={t.field_key} value={t.field_key}>
                      {t.display_name}{t.unit ? ` [${t.unit}]` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {metadata.length > 0 && (
        <div className="rounded border bg-muted/10 p-2">
          <p className="text-[11px] font-medium mb-1">Importinformationen</p>
          <table className="w-full text-[11px]">
            <tbody>
              {metadata.map((m, i) => (
                <tr key={i}>
                  <td className="pr-2 text-muted-foreground">{m.label}</td>
                  <td className="text-right">{String(m.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <MeasurementImportDialog
          open={open}
          onOpenChange={setOpen}
          defaultProfileId={effectiveProfileId}
          targets={targets}
          currentValues={currentValues}
          allowedImporters={cfg.importers}
          onApply={(values, meta) => {
            for (const [k, v] of Object.entries(values)) write(k, v);
            setValue(JSON.stringify({
              imported_at: new Date().toISOString(),
              profile: meta.profileName,
              sample: meta.sampleLabel,
              count: meta.count,
              source: meta.source ?? null,
              keys: Object.keys(values),
              unassigned: meta.unassigned ?? [],
              metadata: meta.metadata ?? [],
            }));
          }}
        />
      )}
    </div>
  );
}

function FieldWithLabel({ field, node, allFields, highlight }: { field: FormField; node: FieldNode; allFields: FormField[]; highlight?: boolean }) {
  const perm = usePerm(field.id);
  const renderTokens = useSystemTextRenderer();
  if (perm.visibility === "hidden") return null;

  // Repeater special-case
  if (field.field_type === "repeater") {
    return <RepeaterField field={field} node={node} allFields={allFields} />;
  }

  if (field.field_type === "measurement_block") {
    return <MeasurementBlockField field={field} node={node} allFields={allFields} />;
  }

  if (field.field_type === "measurement_import") {
    const roDisabled = node.readonly || field.readonly || perm.visibility === "read";
    return (
      <FormItemShell
        label={renderTokens(node.label_override || field.display_name)}
        highlight={highlight}
        icon={<ClipboardPaste className="h-3 w-3 text-primary" />}
        control={<MeasurementImportControl field={field} allFields={allFields} readonly={roDisabled} />}
        footer={
          (node.description_override ?? field.description) ? (
            <p className="text-xs text-muted-foreground">
              {renderTokens(node.description_override ?? field.description ?? "")}
            </p>
          ) : null
        }
      />
    );
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
  canRemove, canReorder, itemLabel, header,
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
  /** Zusätzlicher Kopfbereich (z. B. Messkontext eines Messdatenblocks). */
  header?: ReactNode;
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
        {header}
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
 * Messdatenblock: wiederholbare Messung inkl. Messkontext
 * ---------------------------------------------------------------- */

function MeasurementBlockField({
  field, node, allFields,
}: { field: FormField; node: FieldNode; allFields: FormField[] }) {
  const perm = usePerm(field.id);
  const meta = readMeasurementBlockMeta(field);
  const children = useMemo(() => repeaterChildren(allFields, field.id), [allFields, field.id]);
  const childDefs = useMemo(() => toBlockChildDefs(children), [children]);
  const hasLabelChild = childDefs.some((c) => c.role === "label");

  /* ---- Messfall / Analyseschema ---------------------------------- */
  const caseCfg = readMeasurementCaseConfig(field);
  const { data: allCases = [] } = useQuery({
    queryKey: ["measurement-cases"],
    queryFn: () => api.measurementCases.list(),
    enabled: caseCfg.enabled,
  });
  const cases: CaseTemplate[] = useMemo(
    () =>
      (allCases as any[])
        .filter((c) => c.is_active !== false)
        .filter(
          (c) => caseCfg.allowed_case_ids.length === 0 || caseCfg.allowed_case_ids.includes(c.id)
        )
        .map((c) => ({ id: c.id, name: c.name, instances: c.instances ?? [] })),
    [allCases, caseCfg.allowed_case_ids]
  );

  const storageKey = meta.storage_key || field.field_key;
  const root = useContext(ValuesCtx);
  const rawList = root?.get(storageKey);
  const entries: Array<Record<string, any>> = Array.isArray(rawList) ? rawList : [];

  const interactive = !!root?.interactive;
  const readonly = node.readonly || field.readonly || perm.visibility === "read";
  const caseLocked = caseCfg.enabled && caseCfg.lock_instances;
  const canAdd = interactive && !readonly && !caseLocked && (perm.can_add ?? true) &&
    (meta.max_entries == null || entries.length < meta.max_entries);
  const canRemove = interactive && !readonly && !caseLocked && (perm.can_remove ?? true);


  const label = node.label_override || field.display_name;
  const desc = node.description_override ?? field.description;

  const updateEntries = (next: Array<Record<string, any>>) => root?.set(storageKey, next);

  const makeEntry = (): Record<string, any> => ({
    [INSTANCE_ID_KEY]: newInstanceId(),
    [INSTANCE_LABEL_KEY]: "",
    [INSTANCE_CONTEXT_KEY]: {},
  });

  const add = () => updateEntries([...entries, makeEntry()]);
  const removeAt = (i: number) => {
    if (meta.min_entries && entries.length <= meta.min_entries) return;
    updateEntries(entries.filter((_, idx) => idx !== i));
  };
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = entries.slice();
    [next[i], next[j]] = [next[j], next[i]];
    updateEntries(next);
  };
  // Duplizieren erzeugt IMMER eine neue Messkennung – Ergebnisse dürfen sich
  // niemals zwei Messungen teilen.
  const duplicateAt = (i: number) => {
    if (meta.max_entries != null && entries.length >= meta.max_entries) return;
    const copy = JSON.parse(JSON.stringify(entries[i] ?? {}));
    copy[INSTANCE_ID_KEY] = newInstanceId();
    const next = entries.slice();
    next.splice(i + 1, 0, copy);
    updateEntries(next);
  };

  /* ---- Messungen aus dem Messfall erzeugen ------------------------ */
  const activeCaseId =
    (entries.find((e) => typeof e?.[CASE_ID_KEY] === "string")?.[CASE_ID_KEY] as string | undefined) ??
    caseCfg.default_case_id ??
    (cases.length === 1 ? cases[0].id : null);
  const activeCase = cases.find((c) => c.id === activeCaseId) ?? null;
  /** Im Messfall-Modus sind Bezeichnung/Kontext vorgegeben – nur Messwerte und Import anzeigen. */
  const caseChildren = useMemo(
    () => children.filter((c) => readBlockChildRole(c) === "value"),
    [children]
  );
  const importFieldKeys = useMemo(
    () => children.filter((c) => c.field_type === "measurement_import").map((c) => c.field_key),
    [children]
  );
  const applyCase = useCallback(
    (c: CaseTemplate | null) => {
      if (!c) return;
      updateEntries(buildEntriesFromCase(c, childDefs));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childDefs, root, storageKey]
  );
  const caseNeedsSetup = !!activeCase && !entriesMatchCase(entries, activeCase);

  // Vorgegebener Messfall: Messungen automatisch anlegen, solange nichts erfasst ist.
  useEffect(() => {
    if (!caseCfg.enabled || !interactive || readonly) return;
    if (!activeCase || entries.length > 0) return;
    applyCase(activeCase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseCfg.enabled, interactive, readonly, activeCase?.id, entries.length]);

  // Fehlende Kennungen (Altdaten) und Mindestanzahl ergänzen.
  if (interactive && !readonly && !caseCfg.enabled) {
    const needsId = entries.some((e) => typeof e?.[INSTANCE_ID_KEY] !== "string");
    const needsSeed = !!meta.min_entries && entries.length < meta.min_entries;
    if (needsId || needsSeed) {
      const seeded = entries.map((e) =>
        typeof e?.[INSTANCE_ID_KEY] === "string" ? e : { ...(e ?? {}), [INSTANCE_ID_KEY]: newInstanceId() }
      );
      while (seeded.length < (meta.min_entries ?? 0)) seeded.push(makeEntry());
      queueMicrotask(() => updateEntries(seeded));
    }
  }


  return (
    <div className="border rounded-md bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <ClipboardPaste className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline">
            {entries.length}{meta.max_entries ? ` / ${meta.max_entries}` : ""} {entries.length === 1 ? "Messung" : "Messungen"}
          </Badge>
          {perm.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </div>
        {canAdd && (
          <Button size="sm" variant="outline" onClick={add} type="button">
            <Plus className="h-3 w-3 mr-1" />{meta.add_label}
          </Button>
        )}
      </div>
      {desc && <p className="text-xs text-muted-foreground px-3 pt-2">{desc}</p>}

      {caseCfg.enabled && (
        <div className="px-3 pt-3 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56">
              <Label className="text-xs">Messfall</Label>
              <Select
                value={activeCaseId ?? "__none__"}
                disabled={!interactive || readonly || cases.length <= 1}
                onValueChange={(v) => applyCase(cases.find((c) => c.id === v) ?? null)}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Messfall wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">– Messfall wählen –</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeCase && caseNeedsSetup && interactive && !readonly && (
              <Button size="sm" variant="outline" type="button" onClick={() => applyCase(activeCase)}>
                Messungen erzeugen
              </Button>
            )}
          </div>
          {activeCase && (
            <p className="text-xs text-muted-foreground">
              Für diese Probe sind {activeCase.instances.length} Messung(en) erforderlich – bitte jeweils
              die Messdatei importieren.
            </p>
          )}
        </div>
      )}

      <div className="p-3 space-y-3">
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {caseCfg.enabled ? "Bitte einen Messfall wählen." : "Noch keine Messung angelegt."}
          </p>
        )}

        {entries.map((entry, i) => {
          const legacyContext = (entry?.[INSTANCE_CONTEXT_KEY] ?? {}) as Record<string, string>;
          // Bezeichnung und Kontext ergeben sich aus den frei konfigurierten
          // Unterfeldern – es gibt keine fest codierten Felder.
          const context: Record<string, string> = { ...legacyContext };
          for (const c of childDefs) {
            if (c.role !== "context") continue;
            const v = entry?.[c.field_key];
            if (v != null && String(v).trim() !== "") context[c.field_key] = String(v);
          }
          const explicit =
            (entry?.[INSTANCE_LABEL_KEY] as string) ||
            childDefs
              .filter((c) => c.role === "label")
              .map((c) => entry?.[c.field_key])
              .find((v) => v != null && String(v).trim() !== "")?.toString() ||
            "";
          const title = instanceLabel(explicit, context, meta, i);
          const patch = (next: Record<string, any>) => {
            const arr = entries.slice();
            arr[i] = next;
            updateEntries(arr);
          };
          // Aus einem Messfall erzeugte Messungen: Kontext ist vorgegeben und
          // wird nur noch angezeigt – die technische Konfiguration bleibt
          // für den Messdienstleister unsichtbar.
          const fromCase = caseCfg.enabled && typeof entry?.[CASE_ID_KEY] === "string";
          const done = instanceImportDone(entry, importFieldKeys);
          const caseHeader = (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded border bg-muted/20 px-2 py-1.5">
              <span className="text-sm font-medium">{i + 1}. {title}</span>
              {Object.entries(context).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="text-[10px]">{v}</Badge>
              ))}
              <Badge variant={done ? "default" : "outline"} className="ml-auto text-[10px]">
                {done ? "✓ Import abgeschlossen" : "Noch nicht importiert"}
              </Badge>
            </div>
          );
          const header = fromCase ? caseHeader : (hasLabelChild && meta.context_fields.length === 0) ? null : (

            <div className="mb-3 grid grid-cols-12 gap-3 rounded border bg-muted/20 p-2">
              {!hasLabelChild && (
                <div className="col-span-12 md:col-span-4">
                  <Label className="text-xs">Bezeichnung der Messung</Label>
                  <Input
                    className="h-9"
                    value={entry?.[INSTANCE_LABEL_KEY] ?? ""}
                    placeholder={`${meta.item_label} ${i + 1}`}
                    disabled={readonly || !interactive}
                    onChange={(e) => patch({ ...(entry ?? {}), [INSTANCE_LABEL_KEY]: e.target.value })}
                  />
                </div>
              )}
              {meta.context_fields.map((cf) => (
                <div key={cf.key} className="col-span-12 md:col-span-4">
                  <Label className="text-xs">{cf.label}</Label>
                  {cf.type === "select" && (cf.options?.length ?? 0) > 0 ? (
                    <Select
                      value={legacyContext[cf.key] || "__none__"}
                      disabled={readonly || !interactive}
                      onValueChange={(v) =>
                        patch({
                          ...(entry ?? {}),
                          [INSTANCE_CONTEXT_KEY]: { ...legacyContext, [cf.key]: v === "__none__" ? "" : v },
                        })
                      }
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="–" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">–</SelectItem>
                        {(cf.options ?? []).map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-9"
                      value={legacyContext[cf.key] ?? ""}
                      disabled={readonly || !interactive}
                      onChange={(e) =>
                        patch({
                          ...(entry ?? {}),
                          [INSTANCE_CONTEXT_KEY]: { ...legacyContext, [cf.key]: e.target.value },
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          );


          return (
            <RepeaterEntry
              key={entry?.[INSTANCE_ID_KEY] ?? i}
              index={i}
              entry={entry}
              children={fromCase ? caseChildren : children}
              allFields={allFields}
              readonly={readonly}
              layout={meta.layout}
              header={header}
              canRemove={canRemove && (!meta.min_entries || entries.length > meta.min_entries)}
              canReorder={interactive && !readonly}
              itemLabel={title}
              onChange={patch}
              onRemove={() => removeAt(i)}
              onMoveUp={() => moveAt(i, -1)}
              onMoveDown={() => moveAt(i, 1)}
              onDuplicate={() => duplicateAt(i)}
            />
          );
        })}
      </div>
    </div>
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
        <div className={cn(widthCls(node.width), "min-w-0", node.className)}>
          <FieldWithLabel field={f} node={node} allFields={fields} highlight={node.highlight} />
        </div>
      );
    }
    case "calculation": {
      const n = node as CalculationNode;
      return (
        <div className={cn(widthCls(n.width), "min-w-0", n.className)}>
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
 * Bewusst ohne zusätzliches Padding/Border-Box, damit hervorgehobene Elemente
 * exakt dieselbe Höhe und Ausrichtung behalten wie normale Elemente.
 */
export const HIGHLIGHT_CLS = "rounded-md ring-1 ring-inset ring-primary/50 bg-primary/5";

function CalculationDisplay({ node }: { node: CalculationNode }) {
  const results = useContext(CalcResultsCtx);
  const res = results[`${node.scope}:${node.calc_key}`];
  const label = node.label_override || res?.label || node.calc_key || "Berechnung";
  const desc = node.description_override ?? res?.description ?? null;

  return (
    <FormItemShell
      label={label}
      unit={node.show_unit !== false ? res?.unit ?? null : null}
      icon={<Calculator className="h-3 w-3 text-muted-foreground shrink-0 mt-[1px]" />}
      highlight={node.highlight}
      control={
        <div className="flex h-9 items-center gap-2 px-3 rounded-md border bg-muted/40 text-sm">
          {res
            ? <span className="truncate">{formatCalcResult(res.value, res.decimals, node.show_unit === false ? null : res.unit)}</span>
            : <span className="text-muted-foreground text-xs">Berechnung nicht gefunden</span>}
          <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
        </div>
      }
      footer={
        <>
          {res?.error && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{res.error}</p>}
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </>
      }
    />
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
