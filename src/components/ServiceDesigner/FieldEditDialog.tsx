import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormField, FormFieldType } from "@/lib/api/formFields";
import { readRepeaterMeta, writeRepeaterMeta, repeaterChildren } from "@/lib/api/formFields";
import {
  readMeasurementBlockMeta, writeMeasurementBlockMeta,
  readBlockChildRole, writeBlockChildRole,
  readMeasurementCaseConfig,
  type MeasurementContextFieldDef, type BlockChildRole,
} from "@/lib/measurementBlocks";
import { FIELD_TYPE_GROUPS, SUBFIELD_TYPE_GROUPS, fieldTypeLabel, slugify } from "@/lib/formFieldTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Pencil } from "lucide-react";
import ImportProfileEditorDialog from "@/components/measurementImport/ImportProfileEditorDialog";
import RepeaterLayoutDesigner from "./RepeaterLayoutDesigner";

/* ==============================================================
 * Feld bearbeiten – zentraler Feldeditor des Formulardesigners.
 * Wird für Top-Level-Felder UND für Unterfelder (Repeater, Messblock)
 * verwendet. Es existiert bewusst kein zweites Konfigurationssystem.
 * ============================================================== */

export default function FieldEditDialog({
  field, allFields, onClose, onSaved,
}: {
  field: FormField;
  allFields: FormField[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(field.display_name);
  const [key, setKey] = useState(field.field_key);
  const [desc, setDesc] = useState(field.description ?? "");
  const [unit, setUnit] = useState(field.unit ?? "");
  const [required, setRequired] = useState(field.is_required);
  const [readonly, setReadonly] = useState(field.readonly);
  const [defaultValue, setDefaultValue] = useState(field.default_value ?? "");
  const [formula, setFormula] = useState(field.formula ?? "");
  const [selectOptions, setSelectOptions] = useState((field.select_options ?? []).map(o => typeof o === "string" ? o : o.label).join("\n"));
  const [decimalPlaces, setDecimalPlaces] = useState(field.decimal_places?.toString() ?? "");
  const [minV, setMinV] = useState(field.min_value?.toString() ?? "");
  const [maxV, setMaxV] = useState(field.max_value?.toString() ?? "");
  const [fieldType, setFieldType] = useState<FormFieldType>(field.field_type);
  const [isResult, setIsResult] = useState(!!(field as any).is_result);
  const [importProfileId, setImportProfileId] = useState<string>(
    (((field.metadata ?? {}) as any)?.measurement_import?.profile_id as string) ?? ""
  );
  const [resultLabel, setResultLabel] = useState((field as any).result_label ?? "");
  const [blockRole, setBlockRole] = useState<BlockChildRole>(readBlockChildRole(field));

  const parent = field.parent_field_id ? allFields.find(f => f.id === field.parent_field_id) ?? null : null;
  const isBlockChild = parent?.field_type === "measurement_block";
  const isNumeric = ["number", "decimal", "percent"].includes(fieldType);
  const isGlobalRef = !!field.global_field_id;
  const isSelect = ["select", "multiselect"].includes(fieldType);
  const isComputed = fieldType === "computed";
  const isRepeater = fieldType === "repeater";
  const isBlock = fieldType === "measurement_block";
  const isImport = fieldType === "measurement_import";
  const typeChanged = fieldType !== field.field_type;
  const typeGroups = field.parent_field_id ? SUBFIELD_TYPE_GROUPS : FIELD_TYPE_GROUPS;

  const changeType = (next: FormFieldType) => {
    if (next === fieldType) return;
    const isContainer = (t: string) => ["repeater", "measurement_block"].includes(t);
    const hadSpecifics =
      (["select", "multiselect"].includes(fieldType) && selectOptions.trim() !== "") ||
      (fieldType === "computed" && formula.trim() !== "") ||
      (["number", "decimal", "percent"].includes(fieldType) && (minV || maxV || decimalPlaces)) ||
      (isContainer(fieldType) && allFields.some(f => f.parent_field_id === field.id));
    const nextKeepsSpecifics =
      (["select", "multiselect"].includes(fieldType) && ["select", "multiselect"].includes(next)) ||
      (["number", "decimal", "percent"].includes(fieldType) && ["number", "decimal", "percent"].includes(next)) ||
      (isContainer(fieldType) && isContainer(next));
    if (hadSpecifics && !nextKeepsSpecifics) {
      const ok = confirm(
        "Beim Wechsel des Feldtyps werden die typspezifischen Einstellungen (Optionen, Formel, Grenzwerte bzw. Unterfelder) zurückgesetzt.\n\nAllgemeine Eigenschaften bleiben erhalten. Fortfahren?"
      );
      if (!ok) return;
      if (!["select", "multiselect"].includes(next)) setSelectOptions("");
      if (next !== "computed") setFormula("");
      if (!["number", "decimal", "percent"].includes(next)) { setMinV(""); setMaxV(""); setDecimalPlaces(""); }
    }
    setFieldType(next);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const wasContainer = ["repeater", "measurement_block"].includes(field.field_type);
      const isStillContainer = ["repeater", "measurement_block"].includes(fieldType);
      if (typeChanged && wasContainer && !isStillContainer) {
        for (const c of allFields.filter(f => f.parent_field_id === field.id)) {
          await api.formFields.remove(c.id);
        }
      }
      const metadata: Record<string, unknown> = {
        ...((field.metadata ?? {}) as Record<string, unknown>),
        measurement_import: isImport ? { profile_id: importProfileId || null } : undefined,
      };
      if (isBlockChild) metadata.block_role = blockRole;

      return api.formFields.update(field.id, {
        display_name: label.trim(),
        field_key: key.trim() || slugify(label),
        field_type: fieldType,
        description: desc.trim() || null,
        unit: unit.trim() || null,
        is_required: required,
        readonly,
        default_value: defaultValue.trim() || null,
        formula: isComputed ? (formula.trim() || null) : null,
        select_options: isSelect ? selectOptions.split("\n").map(l => l.trim()).filter(Boolean) : [],
        decimal_places: isNumeric && decimalPlaces ? parseInt(decimalPlaces, 10) : null,
        min_value: isNumeric && minV ? parseFloat(minV) : null,
        max_value: isNumeric && maxV ? parseFloat(maxV) : null,
        is_result: isResult,
        result_label: isResult ? (resultLabel.trim() || null) : null,
        metadata: metadata as any,
      } as any);
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      onSaved();
      // Beim Wechsel auf einen Container geöffnet lassen, damit Unterfelder
      // direkt konfiguriert werden können.
      if (!(typeChanged && ["repeater", "measurement_block"].includes(fieldType))) onClose();
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isGlobalRef ? "Feld-Ansicht (globales Feld)" : field.parent_field_id ? "Unterfeld bearbeiten" : "Feld bearbeiten"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
          {isGlobalRef && (
            <div className="rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
              Dieses Feld referenziert das globale Feld{" "}
              <span className="font-mono text-foreground">{field.binding_path ?? field.field_key}</span>.
              Die Definition wird zentral in der Feldbibliothek gepflegt — hier werden nur Ansicht und
              Verhalten im Formular (Pflicht, Read-only, Standardwert) festgelegt.
            </div>
          )}
          {parent && (
            <div className="rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
              Unterfeld von <span className="font-medium text-foreground">{parent.display_name}</span>
              {isBlockChild ? " (Messblock)" : " (Repeater)"}.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bezeichnung</Label><Input value={label} disabled={isGlobalRef} onChange={e => setLabel(e.target.value)} /></div>
            <div><Label>Schlüssel</Label><Input value={key} disabled={isGlobalRef} onChange={e => setKey(e.target.value)} /></div>
          </div>
          <div>
            <Label>Feldtyp</Label>
            <Select value={fieldType} onValueChange={(v: FormFieldType) => changeType(v)} disabled={isGlobalRef}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-96">
                {typeGroups.map(g => (
                  <div key={g.label}>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{g.label}</div>
                    {g.types.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {typeChanged && (
              <p className="text-xs text-amber-600 mt-1">
                Typänderung wird beim Speichern übernommen. Allgemeine Eigenschaften bleiben erhalten.
              </p>
            )}
          </div>
          {isBlockChild && (
            <div>
              <Label>Rolle im Messblock</Label>
              <Select value={blockRole} onValueChange={(v) => setBlockRole(v as BlockChildRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="value">Normales Feld / Messwert</SelectItem>
                  <SelectItem value="label">Bezeichnung der Messung</SelectItem>
                  <SelectItem value="context">Messkontext</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                „Bezeichnung“ und „Messkontext“ beschreiben die Messung und werden zur eindeutigen
                Kennzeichnung der Messergebnisse verwendet.
              </p>
            </div>
          )}
          <div><Label>Beschreibung</Label><Textarea value={desc} disabled={isGlobalRef} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Einheit</Label><Input value={unit} disabled={isGlobalRef} onChange={e => setUnit(e.target.value)} placeholder="z.B. mm, °C" /></div>
            <div className="flex items-end gap-2"><Switch checked={required} onCheckedChange={setRequired} /><Label>Pflicht</Label></div>
            <div className="flex items-end gap-2"><Switch checked={readonly} onCheckedChange={setReadonly} /><Label>Read-only</Label></div>
          </div>
          {!isBlock && !isRepeater && (
            <div className="rounded border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Switch checked={isResult} onCheckedChange={setIsResult} />
                <Label>Offizielles Ergebnis</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Nur so markierte Felder werden beim Abschluss der Aufgabe in die Ergebnisdatenbank übernommen.
              </p>
              {isResult && (
                <div>
                  <Label className="text-xs">Ergebnis-Bezeichnung (optional)</Label>
                  <Input value={resultLabel} onChange={e => setResultLabel(e.target.value)} placeholder={label} />
                </div>
              )}
            </div>
          )}
          {!isComputed && !isRepeater && !isBlock && <div><Label>Standardwert</Label><Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} /></div>}
          {isNumeric && (
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Min</Label><Input value={minV} onChange={e => setMinV(e.target.value)} type="number" /></div>
              <div><Label>Max</Label><Input value={maxV} onChange={e => setMaxV(e.target.value)} type="number" /></div>
              <div><Label>Nachkommast.</Label><Input value={decimalPlaces} onChange={e => setDecimalPlaces(e.target.value)} type="number" /></div>
            </div>
          )}
          {isSelect && (
            <div>
              <Label>Optionen (eine je Zeile)</Label>
              <Textarea value={selectOptions} disabled={isGlobalRef} onChange={e => setSelectOptions(e.target.value)} rows={5} />
            </div>
          )}
          {isComputed && (
            <div>
              <Label>Formel</Label>
              <Textarea value={formula} disabled={isGlobalRef} onChange={e => setFormula(e.target.value)} rows={3} placeholder="z.B. ROUND((laenge * breite) / 100, 2)" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Verfügbare Funktionen: SUM, AVERAGE, MIN, MAX, ROUND, ABS, IF. Referenzen: `feld_key`.</p>
            </div>
          )}
          {isImport && <ImportFieldConfig profileId={importProfileId} onChange={setImportProfileId} allFields={allFields} field={field} />}
          {(isRepeater || isBlock) && (
            ["repeater", "measurement_block"].includes(field.field_type) ? (
              <RepeaterConfigPanel
                field={field}
                fields={allFields}
                disabled={isGlobalRef}
                mode={field.field_type === "measurement_block" ? "measurement_block" : "repeater"}
              />
            ) : (
              <p className="text-xs text-muted-foreground border-t pt-3">
                Nach dem Speichern erscheinen hier die Einstellungen (Min./Max., Eintrag-Label,
                Button-Text, Storage-Key und Unterfelder).
              </p>
            )
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => saveMut.mutate()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==============================================================
 * Container-Konfiguration (Repeater & Messblock)
 * ============================================================== */

export function RepeaterConfigPanel({
  field, fields, disabled, mode = "repeater",
}: { field: FormField; fields: FormField[]; disabled: boolean; mode?: "repeater" | "measurement_block" }) {
  const qc = useQueryClient();
  const isBlock = mode === "measurement_block";
  const meta: any = isBlock ? readMeasurementBlockMeta(field) : readRepeaterMeta(field);
  const children = repeaterChildren(fields, field.id);
  const legacyContext: MeasurementContextFieldDef[] = meta.context_fields ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["form-fields", field.form_id] });

  const saveMeta = async (patch: any) => {
    const metadata = isBlock
      ? writeMeasurementBlockMeta(field, patch)
      : writeRepeaterMeta(field, patch);
    await api.formFields.update(field.id, { metadata: metadata as any });
    invalidate();
  };

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isBlock ? "Messblock-Einstellungen" : "Repeater-Einstellungen"}
      </p>
      {isBlock && (
        <p className="text-[10px] text-muted-foreground">
          Der Messblock ist ein Container. Struktur und Messkontext ergeben sich ausschließlich aus den
          selbst angelegten Unterfeldern. Jede Messung erhält eine eigene Kennung, damit Ergebnisse
          eindeutig zugeordnet werden.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Min. Anzahl</Label>
          <Input type="number" className="h-8 text-xs" value={meta.min_entries ?? 0}
            onChange={(e) => saveMeta({ min_entries: e.target.value === "" ? 0 : Number(e.target.value) })}
            disabled={disabled} />
        </div>
        <div>
          <Label className="text-xs">Max. Anzahl</Label>
          <Input type="number" className="h-8 text-xs" value={meta.max_entries ?? ""}
            onChange={(e) => saveMeta({ max_entries: e.target.value === "" ? undefined : Number(e.target.value) })}
            disabled={disabled} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Eintrag-Label</Label>
        <Input className="h-8 text-xs" value={meta.item_label ?? ""} onChange={(e) => saveMeta({ item_label: e.target.value })} disabled={disabled} />
      </div>
      <div>
        <Label className="text-xs">Button-Text „Hinzufügen“</Label>
        <Input className="h-8 text-xs" value={meta.add_label ?? ""} onChange={(e) => saveMeta({ add_label: e.target.value })} disabled={disabled} />
      </div>
      <div>
        <Label className="text-xs">Storage-Key (optional)</Label>
        <Input className="h-8 text-xs" value={meta.storage_key ?? ""} placeholder={field.field_key}
          onChange={(e) => saveMeta({ storage_key: e.target.value || undefined })} disabled={disabled} />
        <p className="text-[10px] text-muted-foreground mt-1">
          Gleicher Storage-Key in mehreren Formularen → Daten werden zwischen Schritten übernommen.
        </p>
      </div>

      {isBlock && (
        <MeasurementCaseConfigEditor field={field} disabled={disabled} onSave={saveMeta} />
      )}

      {isBlock && legacyContext.length > 0 && (
        <LegacyContextFieldsEditor
          value={legacyContext}
          disabled={disabled}
          onChange={(context_fields) => saveMeta({ context_fields })}
        />
      )}


      <SubfieldManager field={field} fields={fields} disabled={disabled} isBlock={isBlock} />

      {children.length > 0 && (
        <div className="pt-2 border-t">
          <RepeaterLayoutDesigner
            subfields={children.map((c) => ({ key: c.field_key, label: c.display_name, type: c.field_type, unit: c.unit }))}
            value={meta.layout}
            disabled={disabled}
            onChange={(layout) => saveMeta({ layout })}
          />
        </div>
      )}
    </div>
  );
}

/* ==============================================================
 * Unterfeld-Verwaltung: anlegen, bearbeiten, sortieren,
 * duplizieren, löschen – über den bestehenden Feldeditor.
 * ============================================================== */

const BLOCK_ROLE_LABEL: Record<BlockChildRole, string> = {
  label: "Bezeichnung",
  context: "Kontext",
  value: "Wert",
};

function SubfieldManager({
  field, fields, disabled, isBlock,
}: { field: FormField; fields: FormField[]; disabled: boolean; isBlock: boolean }) {
  const qc = useQueryClient();
  const children = repeaterChildren(fields, field.id);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormFieldType>("text");
  const [newRole, setNewRole] = useState<BlockChildRole>("value");
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["form-fields", field.form_id] });

  const uniqueKey = (base: string) => {
    const used = new Set(fields.map((f) => f.field_key));
    let k = base || "feld";
    let i = 2;
    while (used.has(k)) { k = `${base}_${i}`; i += 1; }
    return k;
  };

  const addChild = async () => {
    if (!newLabel.trim()) return;
    await api.formFields.create({
      form_id: field.form_id,
      field_key: uniqueKey(slugify(newLabel)),
      display_name: newLabel.trim(),
      field_type: newType,
      parent_field_id: field.id,
      sort_order: children.length,
      metadata: (isBlock ? { block_role: newRole } : {}) as any,
    } as any);
    setNewLabel(""); setNewType("text"); setNewRole("value"); setAddOpen(false);
    invalidate();
    toast.success("Unterfeld hinzugefügt");
  };

  const duplicateChild = async (c: FormField) => {
    await api.formFields.create({
      form_id: field.form_id,
      field_key: uniqueKey(`${c.field_key}_2`),
      display_name: `${c.display_name} 2`,
      field_type: c.field_type,
      description: c.description,
      unit: c.unit,
      is_required: c.is_required,
      readonly: c.readonly,
      default_value: c.default_value,
      formula: c.formula,
      select_options: c.select_options as any,
      min_value: c.min_value,
      max_value: c.max_value,
      decimal_places: c.decimal_places,
      metadata: c.metadata as any,
      parent_field_id: field.id,
      sort_order: children.length,
    } as any);
    invalidate();
    toast.success("Unterfeld dupliziert");
  };

  const removeChild = async (c: FormField) => {
    const ok = confirm(
      `Unterfeld „${c.display_name}“ wirklich löschen?\n\n` +
      "Bereits erfasste Werte dieses Feldes bleiben in den gespeicherten Formulardaten " +
      "erhalten, werden aber nicht mehr angezeigt."
    );
    if (!ok) return;
    await api.formFields.remove(c.id);
    invalidate();
    toast.success("Unterfeld gelöscht");
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= children.length) return;
    const next = children.slice();
    [next[index], next[j]] = [next[j], next[index]];
    await api.formFields.reorder(next.map((c, i) => ({ id: c.id, sort_order: i })));
    invalidate();
  };

  return (
    <div className="pt-2 border-t">
      <p className="text-xs font-semibold mb-2">Unterfelder ({children.length})</p>
      <div className="space-y-1 mb-2">
        {children.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1 border rounded px-2 py-1">
            <span className="flex-1 text-xs truncate">
              {c.display_name} <span className="text-muted-foreground">({c.field_key})</span>
            </span>
            <Badge variant="outline" className="text-[10px]">{fieldTypeLabel(c.field_type)}</Badge>
            {isBlock && readBlockChildRole(c) !== "value" && (
              <Badge variant="secondary" className="text-[10px]">{BLOCK_ROLE_LABEL[readBlockChildRole(c)]}</Badge>
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Bearbeiten" disabled={disabled} onClick={() => setEditingId(c.id)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Nach oben" disabled={disabled || i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Nach unten" disabled={disabled || i === children.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplizieren" disabled={disabled} onClick={() => duplicateChild(c)}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Löschen" disabled={disabled} onClick={() => removeChild(c)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {children.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Unterfelder.</p>}
      </div>
      {!disabled && (
        <Button size="sm" variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />Unterfeld hinzufügen
        </Button>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neues Unterfeld</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Bezeichnung</Label>
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} autoFocus placeholder="z.B. Präparation" />
            </div>
            <div>
              <Label>Feldtyp</Label>
              <Select value={newType} onValueChange={(v: FormFieldType) => setNewType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-96">
                  {SUBFIELD_TYPE_GROUPS.map(g => (
                    <div key={g.label}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{g.label}</div>
                      {g.types.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isBlock && (
              <div>
                <Label>Rolle im Messblock</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as BlockChildRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">Normales Feld / Messwert</SelectItem>
                    <SelectItem value="label">Bezeichnung der Messung</SelectItem>
                    <SelectItem value="context">Messkontext</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
            <Button onClick={addChild} disabled={!newLabel.trim()}>Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingId && fields.some(f => f.id === editingId) && (
        <FieldEditDialog
          field={fields.find(f => f.id === editingId)!}
          allFields={fields}
          onClose={() => setEditingId(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

/* ==============================================================
 * Legacy: fest im Block gepflegte Kontextfelder (Altbestände)
 * ============================================================== */

function LegacyContextFieldsEditor({
  value, disabled, onChange,
}: {
  value: MeasurementContextFieldDef[];
  disabled: boolean;
  onChange: (next: MeasurementContextFieldDef[]) => void;
}) {
  const patch = (i: number, p: Partial<MeasurementContextFieldDef>) => {
    const next = value.slice();
    next[i] = { ...next[i], ...p };
    onChange(next);
  };
  return (
    <div className="pt-2 border-t space-y-2">
      <p className="text-xs font-semibold">Alter Messkontext ({value.length})</p>
      <p className="text-[10px] text-muted-foreground">
        Aus einer früheren Version. Neue Kontextfelder bitte als Unterfeld mit der Rolle „Messkontext“ anlegen.
      </p>
      {value.map((c, i) => (
        <div key={i} className="border rounded p-2 space-y-1">
          <div className="flex gap-1">
            <Input className="h-8 text-xs" placeholder="key" value={c.key}
              onChange={(e) => patch(i, { key: e.target.value })} disabled={disabled} />
            <Input className="h-8 text-xs" placeholder="Bezeichnung" value={c.label}
              onChange={(e) => patch(i, { label: e.target.value })} disabled={disabled} />
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={disabled}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Select value={c.type} onValueChange={(v) => patch(i, { type: v as any })} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="select">Auswahl</SelectItem>
              </SelectContent>
            </Select>
            {c.type === "select" && (
              <Input className="h-8 text-xs flex-1" placeholder="Optionen, kommagetrennt"
                value={(c.options ?? []).join(", ")}
                onChange={(e) => patch(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                disabled={disabled} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ==============================================================
 * Messdaten-Import: Feldkonfiguration
 * ============================================================== */

export function ImportFieldConfig({
  profileId, onChange, allFields, field,
}: { profileId: string; onChange: (v: string) => void; allFields: FormField[]; field: FormField }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [createNew, setCreateNew] = useState(false);
  const { data: profiles = [] } = useQuery({
    queryKey: ["measurement-import-profiles"],
    queryFn: () => api.measurementImportProfiles.list(),
  });
  const selected = profiles.find(p => p.id === profileId) ?? null;
  const targets = allFields
    // Kontext-/Bezeichnungsfelder eines Messblocks sind keine Importziele.
    .filter(f => f.id !== field.id && f.parent_field_id === field.parent_field_id
      && !["repeater", "measurement_block", "measurement_import"].includes(f.field_type)
      && readBlockChildRole(f) === "value")
    .map(f => ({ field_key: f.field_key, display_name: f.display_name, unit: f.unit, field_type: f.field_type }));

  return (
    <div className="rounded border p-3 space-y-2 bg-muted/30">
      <Label>Importprofil</Label>
      <Select value={profileId || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Profil wählen…" /></SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="__none__">— beim Import wählen —</SelectItem>
          {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Das Profil bestimmt Datenformat und die Zuordnung der Messparameter auf die Felder dieses
        Formularabschnitts. Ohne Profil erfolgt ein reiner Namensabgleich; die Zuordnung kann beim Import
        immer manuell korrigiert werden.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!selected} onClick={() => { setCreateNew(false); setEditorOpen(true); }}>
          Profil bearbeiten
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setCreateNew(true); setEditorOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Neues Profil
        </Button>
      </div>
      <ImportProfileEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={createNew ? null : selected}
        targets={targets}
        onSaved={(p) => onChange(p.id)}
      />
    </div>
  );
}

/* ==============================================================
 * Messfall / Analyseschema – Konfiguration je Messblock
 * ============================================================== */
function MeasurementCaseConfigEditor({
  field, disabled, onSave,
}: { field: FormField; disabled: boolean; onSave: (patch: any) => void | Promise<void> }) {
  const cfg = readMeasurementCaseConfig(field);
  const { data: cases = [] } = useQuery({
    queryKey: ["measurement-cases"],
    queryFn: () => api.measurementCases.list(),
  });
  const patch = (p: Partial<typeof cfg>) => onSave({ case_config: { ...cfg, ...p } });
  const [caseEditorOpen, setCaseEditorOpen] = useState(false);
  const [caseEditorTarget, setCaseEditorTarget] = useState<any | null>(null);
  const selectedCase = (cases as any[]).find((c) => c.id === cfg.default_case_id) ?? null;

  return (
    <div className="rounded border p-2 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs">Messfall-Steuerung</Label>
          <p className="text-[10px] text-muted-foreground">
            ROX erzeugt die erforderlichen Messungen automatisch aus dem gewählten Messfall.
          </p>
        </div>
        <Switch checked={cfg.enabled} disabled={disabled} onCheckedChange={(v) => patch({ enabled: v })} />
      </div>
      {cfg.enabled && (
        <>
          <div>
            <Label className="text-[11px]">Vorgegebener Messfall</Label>
            <div className="flex items-center gap-1">
              <Select
                value={cfg.default_case_id ?? "__none__"}
                disabled={disabled}
                onValueChange={(v) => patch({ default_case_id: v === "__none__" ? null : v })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Messfall wählen…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">— Auswahl durch Benutzer —</SelectItem>
                  {(cases as any[])
                    .filter((c) => c.is_active !== false || c.id === cfg.default_case_id)
                    .map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.is_active === false ? " (inaktiv)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedCase && (
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={disabled}
                  title="Messfall bearbeiten"
                  onClick={() => { setCaseEditorTarget(selectedCase); setCaseEditorOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={disabled}
                title="Neuen Messfall erstellen"
                onClick={() => { setCaseEditorTarget(null); setCaseEditorOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <MeasurementCaseEditorDialog
            open={caseEditorOpen}
            onOpenChange={setCaseEditorOpen}
            caseDef={caseEditorTarget}
            onSaved={(saved) => { if (!caseEditorTarget) patch({ default_case_id: saved.id }); }}
          />

          <div className="space-y-1">
            <Label className="text-[11px]">Auswählbare Messfälle (keiner markiert = alle)</Label>
            <div className="flex flex-wrap gap-1">
              {cases.map((c: any) => {
                const on = cfg.allowed_case_ids.includes(c.id);
                return (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    disabled={disabled}
                    className="h-7 text-[11px]"
                    onClick={() =>
                      patch({
                        allowed_case_ids: on
                          ? cfg.allowed_case_ids.filter((x) => x !== c.id)
                          : [...cfg.allowed_case_ids, c.id],
                      })
                    }
                  >
                    {c.name}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Messungen gegen Änderung sperren</Label>
            <Switch checked={cfg.lock_instances} disabled={disabled}
              onCheckedChange={(v) => patch({ lock_instances: v })} />
          </div>
        </>
      )}
    </div>
  );
}
