import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, useDraggable, useDroppable, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  GripVertical, Plus, Trash2, ChevronDown, ChevronRight, Eye, Settings2,
  Save, RotateCcw, LayoutGrid,
} from "lucide-react";
import type { ServiceDataField } from "@/lib/api/serviceDesigner";
import type {
  FormFieldRef, FormLayoutData, FormRoleView, FormSection,
} from "@/lib/api/serviceFormLayouts";

const ROLE_TABS: { value: FormRoleView; label: string; hint: string }[] = [
  { value: "customer", label: "Auftraggeber", hint: "Was der Kunde beim Anlegen sieht" },
  { value: "employee", label: "Mitarbeiter", hint: "Interne Bearbeitungsansicht" },
  { value: "public", label: "Öffentlich", hint: "Anonyme / Self-Service Ansicht" },
];

const WIDTHS: { value: FormFieldRef["width"]; label: string; cls: string }[] = [
  { value: 12, label: "100%", cls: "col-span-12" },
  { value: 9, label: "75%", cls: "col-span-12 md:col-span-9" },
  { value: 8, label: "66%", cls: "col-span-12 md:col-span-8" },
  { value: 6, label: "50%", cls: "col-span-12 md:col-span-6" },
  { value: 4, label: "33%", cls: "col-span-12 md:col-span-4" },
  { value: 3, label: "25%", cls: "col-span-12 md:col-span-3" },
];

const widthCls = (w: FormFieldRef["width"]) =>
  WIDTHS.find((x) => x.value === w)?.cls ?? "col-span-12";

const uid = () => Math.random().toString(36).slice(2, 10);

function makeDefaultLayout(): FormLayoutData {
  return { sections: [{ id: uid(), title: "Allgemein", fields: [] }] };
}

// ============================== Main ==============================

export default function FormDesignerTab({
  serviceId, canManage,
}: { serviceId: string; canManage: boolean }) {
  const [role, setRole] = useState<FormRoleView>("customer");

  const { data: fields = [] } = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId),
  });

  const usableFields = useMemo(() => fields.filter((f) => !f.archived), [fields]);

  return (
    <div className="space-y-4">
      <Tabs value={role} onValueChange={(v) => setRole(v as FormRoleView)}>
        <TabsList>
          {ROLE_TABS.map((r) => (
            <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-xs text-muted-foreground -mt-2">
        {ROLE_TABS.find((r) => r.value === role)?.hint}
      </p>

      <RoleDesigner
        key={role}
        serviceId={serviceId}
        roleView={role}
        canManage={canManage}
        allFields={usableFields}
      />
    </div>
  );
}

// ============================ Role Designer ============================

function RoleDesigner({
  serviceId, roleView, canManage, allFields,
}: {
  serviceId: string;
  roleView: FormRoleView;
  canManage: boolean;
  allFields: ServiceDataField[];
}) {
  const qc = useQueryClient();
  const { data: saved, isLoading } = useQuery({
    queryKey: ["service-form-layout", serviceId, roleView],
    queryFn: () => api.serviceFormLayouts.get(serviceId, roleView),
  });

  const [layout, setLayout] = useState<FormLayoutData>(makeDefaultLayout());
  const [dirty, setDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [activeDrag, setActiveDrag] = useState<{ type: "palette"; fieldId: string } | { type: "field"; refId: string } | null>(null);

  useEffect(() => {
    if (saved?.layout?.sections) {
      setLayout(saved.layout);
    } else {
      setLayout(makeDefaultLayout());
    }
    setDirty(false);
  }, [saved, roleView]);

  const usageCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of layout.sections) for (const f of s.fields) {
      m.set(f.field_id, (m.get(f.field_id) ?? 0) + 1);
    }
    return m;
  }, [layout]);
  // Palette always lists every field — references can be placed multiple times.
  const palette = allFields;

  const update = (next: FormLayoutData) => { setLayout(next); setDirty(true); };

  const save = useMutation({
    mutationFn: () => api.serviceFormLayouts.upsert(serviceId, roleView, layout),
    onSuccess: () => {
      toast.success("Layout gespeichert");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["service-form-layout", serviceId, roleView] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const reset = () => {
    if (saved?.layout?.sections) setLayout(saved.layout);
    else setLayout(makeDefaultLayout());
    setDirty(false);
  };

  // ---- DnD handlers ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as any;
    if (data?.kind === "palette") setActiveDrag({ type: "palette", fieldId: data.fieldId });
    else if (data?.kind === "field") setActiveDrag({ type: "field", refId: data.refId });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const aData = active.data.current as any;
    const oData = over.data.current as any;

    // Drop palette field into a section
    if (aData?.kind === "palette") {
      const targetSectionId =
        oData?.kind === "section" ? oData.sectionId :
        oData?.kind === "field" ? oData.sectionId : null;
      if (!targetSectionId) return;
      const newRef: FormFieldRef = { id: uid(), field_id: aData.fieldId, width: 6 };
      const next = {
        ...layout,
        sections: layout.sections.map((s) => {
          if (s.id !== targetSectionId) return s;
          // insert at position of over field if dropped on a field
          if (oData?.kind === "field") {
            const idx = s.fields.findIndex((f) => f.id === oData.refId);
            const copy = [...s.fields];
            copy.splice(idx >= 0 ? idx : copy.length, 0, newRef);
            return { ...s, fields: copy };
          }
          return { ...s, fields: [...s.fields, newRef] };
        }),
      };
      update(next);
      return;
    }

    // Reorder/move existing field
    if (aData?.kind === "field") {
      const fromSectionId = aData.sectionId as string;
      const refId = aData.refId as string;
      const targetSectionId =
        oData?.kind === "section" ? oData.sectionId :
        oData?.kind === "field" ? oData.sectionId : null;
      if (!targetSectionId) return;

      // same-section reorder
      if (fromSectionId === targetSectionId && oData?.kind === "field") {
        const sec = layout.sections.find((s) => s.id === fromSectionId)!;
        const oldIdx = sec.fields.findIndex((f) => f.id === refId);
        const newIdx = sec.fields.findIndex((f) => f.id === oData.refId);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
        const reordered = arrayMove(sec.fields, oldIdx, newIdx);
        update({
          ...layout,
          sections: layout.sections.map((s) => s.id === fromSectionId ? { ...s, fields: reordered } : s),
        });
        return;
      }

      // move between sections
      const fromSec = layout.sections.find((s) => s.id === fromSectionId);
      if (!fromSec) return;
      const moving = fromSec.fields.find((f) => f.id === refId);
      if (!moving) return;
      const next = {
        ...layout,
        sections: layout.sections.map((s) => {
          if (s.id === fromSectionId) return { ...s, fields: s.fields.filter((f) => f.id !== refId) };
          if (s.id === targetSectionId) {
            const copy = [...s.fields];
            if (oData?.kind === "field") {
              const idx = copy.findIndex((f) => f.id === oData.refId);
              copy.splice(idx >= 0 ? idx : copy.length, 0, moving);
            } else copy.push(moving);
            return { ...s, fields: copy };
          }
          return s;
        }),
      };
      update(next);
    }
  };

  // ---- Section ops ----
  const addSection = () => update({
    ...layout,
    sections: [...layout.sections, { id: uid(), title: `Abschnitt ${layout.sections.length + 1}`, fields: [] }],
  });
  const updateSection = (id: string, patch: Partial<FormSection>) => update({
    ...layout,
    sections: layout.sections.map((s) => s.id === id ? { ...s, ...patch } : s),
  });
  const removeSection = (id: string) => update({
    ...layout,
    sections: layout.sections.filter((s) => s.id !== id),
  });
  const updateField = (sectionId: string, refId: string, patch: Partial<FormFieldRef>) => update({
    ...layout,
    sections: layout.sections.map((s) => s.id === sectionId ? {
      ...s, fields: s.fields.map((f) => f.id === refId ? { ...f, ...patch } : f),
    } : s),
  });
  const removeField = (sectionId: string, refId: string) => update({
    ...layout,
    sections: layout.sections.map((s) => s.id === sectionId ? {
      ...s, fields: s.fields.filter((f) => f.id !== refId),
    } : s),
  });

  const fieldsById = useMemo(() => new Map(allFields.map((f) => [f.id, f])), [allFields]);

  if (isLoading) return <Card><CardContent className="p-6 text-muted-foreground">Lade …</CardContent></Card>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
          {layout.sections.length} Abschnitt(e) · {layout.sections.reduce((n, s) => n + s.fields.length, 0)} Feld(er)
          {dirty && <Badge variant="outline" className="text-amber-600 border-amber-400">Ungespeichert</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
            <Eye className="h-4 w-4 mr-1" /> {showPreview ? "Vorschau ausblenden" : "Vorschau"}
          </Button>
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={reset} disabled={!dirty}>
                <RotateCcw className="h-4 w-4 mr-1" /> Verwerfen
              </Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                <Save className="h-4 w-4 mr-1" /> Speichern
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={`grid gap-4 ${showPreview ? "lg:grid-cols-[260px_1fr_380px]" : "lg:grid-cols-[260px_1fr]"}`}>
        {/* Palette */}
        <Card className="h-fit sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Datenfelder</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Per Drag &amp; Drop einfügen. Felder können mehrfach platziert werden – alle Instanzen teilen denselben Wert.
            </p>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-[70vh] overflow-y-auto">
            {palette.length === 0 && (
              <p className="text-xs text-muted-foreground">Noch keine Datenfelder im Datenmodell.</p>
            )}
            {palette.map((f) => (
              <PaletteItem key={f.id} field={f} disabled={!canManage} usageCount={usageCount.get(f.id) ?? 0} />
            ))}
          </CardContent>
        </Card>

        {/* Canvas */}
        <div className="space-y-4">
          {layout.sections.map((sec) => (
            <SectionBlock
              key={sec.id}
              section={sec}
              fieldsById={fieldsById}
              canManage={canManage}
              onChangeSection={(p) => updateSection(sec.id, p)}
              onRemoveSection={() => removeSection(sec.id)}
              onChangeField={(refId, p) => updateField(sec.id, refId, p)}
              onRemoveField={(refId) => removeField(sec.id, refId)}
            />
          ))}
          {canManage && (
            <Button variant="outline" onClick={addSection} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Abschnitt hinzufügen
            </Button>
          )}
        </div>

        {/* Preview */}
        {showPreview && (
          <Card className="h-fit sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" /> Live-Vorschau
                <Badge variant="secondary" className="text-[10px]">
                  {ROLE_TABS.find((r) => r.value === roleView)?.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[80vh] overflow-y-auto">
              <LivePreview layout={layout} fieldsById={fieldsById} />
            </CardContent>
          </Card>
        )}
      </div>

      <DragOverlay>
        {activeDrag?.type === "palette" && (
          <div className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm shadow-lg">
            {fieldsById.get(activeDrag.fieldId)?.display_name ?? "Feld"}
          </div>
        )}
        {activeDrag?.type === "field" && (
          <div className="px-3 py-2 rounded-md bg-card border shadow-lg text-sm">Feld verschieben…</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ============================ Palette item ============================

function PaletteItem({ field, disabled, usageCount = 0 }: { field: ServiceDataField; disabled?: boolean; usageCount?: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${field.id}`,
    data: { kind: "palette", fieldId: field.id },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card text-xs ${disabled ? "opacity-60" : "cursor-grab hover:bg-accent"} ${isDragging ? "opacity-40" : ""}`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{field.display_name}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {field.field_type}{field.unit ? ` · ${field.unit}` : ""}
        </div>
      </div>
      {usageCount > 0 && (
        <Badge variant="secondary" className="text-[9px]" title="So oft im Formular verwendet">{usageCount}×</Badge>
      )}
      {field.is_required && <Badge variant="outline" className="text-[9px]">Pflicht</Badge>}
    </div>
  );
}

// ============================ Section block ============================

function SectionBlock({
  section, fieldsById, canManage,
  onChangeSection, onRemoveSection, onChangeField, onRemoveField,
}: {
  section: FormSection;
  fieldsById: Map<string, ServiceDataField>;
  canManage: boolean;
  onChangeSection: (p: Partial<FormSection>) => void;
  onRemoveSection: () => void;
  onChangeField: (refId: string, p: Partial<FormFieldRef>) => void;
  onRemoveField: (refId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { kind: "section", sectionId: section.id },
  });
  const collapsed = !!section.collapsed;
  return (
    <Card className={`transition-colors ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <Button size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => onChangeSection({ collapsed: !collapsed })}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <div className="flex-1 space-y-1">
            <Input
              value={section.title}
              disabled={!canManage}
              onChange={(e) => onChangeSection({ title: e.target.value })}
              className="h-8 font-medium"
            />
            <Input
              value={section.description ?? ""}
              disabled={!canManage}
              placeholder="Beschreibung (optional)"
              onChange={(e) => onChangeSection({ description: e.target.value })}
              className="h-7 text-xs text-muted-foreground"
            />
          </div>
        </div>
        {canManage && (
          <Button size="icon" variant="ghost" onClick={onRemoveSection} className="h-7 w-7">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </CardHeader>
      {!collapsed && (
        <CardContent ref={setNodeRef} className="min-h-[80px]">
          {section.fields.length === 0 ? (
            <div className="border border-dashed rounded-md py-6 text-center text-xs text-muted-foreground">
              Felder aus der linken Palette hierher ziehen
            </div>
          ) : (
            <SortableContext items={section.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-12 gap-3">
                {section.fields.map((ref) => (
                  <FieldBlock
                    key={ref.id}
                    sectionId={section.id}
                    refItem={ref}
                    field={fieldsById.get(ref.field_id)}
                    canManage={canManage}
                    onChange={(p) => onChangeField(ref.id, p)}
                    onRemove={() => onRemoveField(ref.id)}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ============================ Field block ============================

function FieldBlock({
  sectionId, refItem, field, canManage, onChange, onRemove,
}: {
  sectionId: string;
  refItem: FormFieldRef;
  field?: ServiceDataField;
  canManage: boolean;
  onChange: (p: Partial<FormFieldRef>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: refItem.id,
    data: { kind: "field", sectionId, refId: refItem.id },
    disabled: !canManage,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  if (!field) {
    return (
      <div className={`${widthCls(refItem.width)} border border-dashed rounded-md p-2 text-xs text-destructive`}>
        Feld nicht gefunden (archiviert oder gelöscht).
        {canManage && (
          <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={onRemove}>Entfernen</Button>
        )}
      </div>
    );
  }
  return (
    <div ref={setNodeRef} style={style} className={widthCls(refItem.width)}>
      <div className={`group border rounded-md p-2 bg-card ${refItem.hidden ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground"
            aria-label="Verschieben"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              {refItem.label_override?.trim() || field.display_name}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              <code>{field.field_key}</code> · {field.field_type}
            </div>
          </div>
          {field.is_required && <Badge variant="outline" className="text-[9px]">Pflicht</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <Input
            value={refItem.label_override ?? ""}
            disabled={!canManage}
            onChange={(e) => onChange({ label_override: e.target.value })}
            placeholder={`Label (Standard: ${field.display_name})`}
            className="h-7 text-xs"
          />
          <Input
            value={refItem.description_override ?? ""}
            disabled={!canManage}
            onChange={(e) => onChange({ description_override: e.target.value })}
            placeholder="Hilfetext (optional)"
            className="h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Select
            value={String(refItem.width)}
            disabled={!canManage}
            onValueChange={(v) => onChange({ width: Number(v) as FormFieldRef["width"] })}
          >
            <SelectTrigger className="h-7 text-xs w-[88px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WIDTHS.map((w) => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Checkbox
              checked={!!refItem.readonly}
              disabled={!canManage}
              onCheckedChange={(c) => onChange({ readonly: !!c })}
            />
            Schreibgeschützt
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Checkbox
              checked={!!refItem.hidden}
              disabled={!canManage}
              onCheckedChange={(c) => onChange({ hidden: !!c })}
            />
            Ausgeblendet
          </label>
          {canManage && (
            <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================ Live Preview ============================

function LivePreview({
  layout, fieldsById,
}: { layout: FormLayoutData; fieldsById: Map<string, ServiceDataField> }) {
  if (layout.sections.length === 0) {
    return <p className="text-xs text-muted-foreground">Noch nichts angelegt.</p>;
  }
  return (
    <div className="space-y-5">
      {layout.sections.map((sec) => {
        const visible = sec.fields.filter((f) => !f.hidden);
        if (visible.length === 0 && !sec.title) return null;
        return (
          <div key={sec.id}>
            <div className="mb-2">
              <h4 className="text-sm font-semibold">{sec.title}</h4>
              {sec.description && <p className="text-xs text-muted-foreground">{sec.description}</p>}
            </div>
            <div className="grid grid-cols-12 gap-3">
              {visible.map((ref) => {
                const f = fieldsById.get(ref.field_id);
                if (!f) return null;
                const displayField = (ref.label_override?.trim() || ref.description_override?.trim())
                  ? { ...f, display_name: ref.label_override?.trim() || f.display_name, description: ref.description_override?.trim() || f.description }
                  : f;
                return (
                  <div key={ref.id} className={widthCls(ref.width)}>
                    <PreviewField field={displayField} readonly={!!ref.readonly} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewField({ field, readonly }: { field: ServiceDataField; readonly: boolean }) {
  const lbl = (
    <Label className="text-xs">
      {field.display_name}
      {field.is_required && <span className="text-destructive ml-0.5">*</span>}
      {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
    </Label>
  );
  const t = field.field_type;
  const common = "h-9";
  const opts = (field.select_options ?? []).map((o) =>
    typeof o === "string" ? { label: o, value: o } : o
  );

  let control: React.ReactNode;
  if (t === "longtext") {
    control = <Textarea rows={3} disabled={readonly} placeholder={field.description ?? ""} />;
  } else if (t === "boolean") {
    control = (
      <div className="flex items-center gap-2 h-9">
        <Switch disabled={readonly} /> <span className="text-xs text-muted-foreground">Ja / Nein</span>
      </div>
    );
  } else if (t === "select") {
    control = (
      <Select disabled={readonly}>
        <SelectTrigger className={common}><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
        <SelectContent>
          {opts.length === 0
            ? <SelectItem value="__none__" disabled>Keine Optionen</SelectItem>
            : opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  } else if (t === "multiselect") {
    control = (
      <div className="border rounded-md p-2 flex flex-wrap gap-1 min-h-9">
        {opts.length === 0
          ? <span className="text-xs text-muted-foreground">Keine Optionen</span>
          : opts.map((o) => <Badge key={o.value} variant="secondary" className="text-[10px]">{o.label}</Badge>)}
      </div>
    );
  } else if (t === "date" || t === "time" || t === "datetime") {
    const it = t === "date" ? "date" : t === "time" ? "time" : "datetime-local";
    control = <Input type={it} disabled={readonly} className={common} />;
  } else if (t === "number" || t === "decimal" || t === "percent") {
    control = <Input type="number" step={t === "decimal" ? "0.01" : t === "percent" ? "0.1" : "1"} disabled={readonly} className={common} />;
  } else if (t === "file" || t === "image") {
    control = <Input type="file" disabled={readonly} className={common} />;
  } else if (t === "barcode" || t === "qrcode") {
    control = <Input disabled={readonly} className={common} placeholder={t === "barcode" ? "Barcode scannen…" : "QR-Code scannen…"} />;
  } else if (t === "repeater") {
    control = (
      <div className="border rounded-md p-2 text-xs text-muted-foreground">
        Unterliste (1:n) — wird im echten Formular dynamisch gerendert.
      </div>
    );
  } else if (t.startsWith("ref_")) {
    control = (
      <Select disabled={readonly}>
        <SelectTrigger className={common}><SelectValue placeholder={`${t.replace("ref_", "")} wählen…`} /></SelectTrigger>
        <SelectContent><SelectItem value="__none__" disabled>Verknüpfung</SelectItem></SelectContent>
      </Select>
    );
  } else {
    control = <Input disabled={readonly} className={common} placeholder={field.description ?? ""} />;
  }

  return (
    <div className="space-y-1">
      {lbl}
      {control}
    </div>
  );
}
