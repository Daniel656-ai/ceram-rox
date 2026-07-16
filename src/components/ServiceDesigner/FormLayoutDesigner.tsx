import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
  DragOverlay, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { FormField } from "@/lib/api/formFields";
import {
  type LayoutNode, type LayoutNodeType, type FormLayoutTree,
  type LayoutWidth, type FieldNode,
  createNode, normalizeLayout, findNode, updateNode,
  removeNode, insertNode, collectUsedFieldIds,
} from "@/lib/api/formDefinitionLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LayoutGrid, Columns3, Columns2, Square, Minus, Heading1,
  StickyNote, Save, RotateCcw, Trash2, ChevronRight, ChevronDown,
  GripVertical, FolderTree, Folders, Plus, Rows,
} from "lucide-react";
import FormLayoutRenderer from "./FormLayoutRenderer";

// ---------- palette ----------
const PALETTE: { key: LayoutNodeType; label: string; icon: any; extra?: any }[] = [
  { key: "section", label: "Abschnitt", icon: LayoutGrid },
  { key: "group", label: "Gruppe", icon: Folders },
  { key: "tabs", label: "Register/Tabs", icon: FolderTree },
  { key: "columns", label: "1 Spalte", icon: Rows, extra: { columnCount: 1 } },
  { key: "columns", label: "2 Spalten", icon: Columns2, extra: { columnCount: 2 } },
  { key: "columns", label: "3 Spalten", icon: Columns3, extra: { columnCount: 3 } },
  { key: "container", label: "Container", icon: Square },
  { key: "divider", label: "Trennlinie", icon: Minus },
  { key: "heading", label: "Überschrift", icon: Heading1 },
  { key: "note", label: "Hinweistext", icon: StickyNote },
];

const WIDTH_OPTS: { v: LayoutWidth; l: string }[] = [
  { v: 12, l: "100%" }, { v: 9, l: "75%" }, { v: 8, l: "66%" },
  { v: 6, l: "50%" }, { v: 4, l: "33%" }, { v: 3, l: "25%" },
];

const TYPE_LABELS: Record<LayoutNodeType, string> = {
  section: "Abschnitt", group: "Gruppe", tabs: "Tabs", tab: "Tab",
  columns: "Spalten", column: "Spalte", container: "Container", divider: "Trennlinie",
  heading: "Überschrift", note: "Hinweis", field: "Feld",
};

// ---------- dnd id encoding ----------
// draggable ids:
//   palette::<type>::<extraJson>
//   field::<fieldId>
//   node::<nodeId>
// droppable ids:
//   drop::root::<index>
//   drop::child::<parentId>::<index>
//   drop::append::<parentId>          (whole empty container area)
//   drop::rootAppend                  (whole empty canvas)

type DragData =
  | { kind: "palette"; nodeType: LayoutNodeType; extra?: any }
  | { kind: "field"; fieldId: string }
  | { kind: "move"; nodeId: string };

// ---------- main ----------
export default function FormLayoutDesigner({
  form,
  canManage,
  initialLayout,
  onSaveLayout,
  saveLabel = "Speichern",
  headerTitle = "Formular-Aufbau",
}: {
  form: FormDefinition;
  canManage: boolean;
  /** Override the layout source. When provided, the form's own layout is not used. */
  initialLayout?: FormLayoutTree | Record<string, unknown> | null;
  /** Override how the layout is persisted. Defaults to saving on `form_definitions.layout`. */
  onSaveLayout?: (layout: FormLayoutTree) => Promise<void>;
  saveLabel?: string;
  headerTitle?: string;
}) {
  const qc = useQueryClient();
  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });

  const baseLayout = initialLayout ?? (form as any).layout;
  const [layout, setLayout] = useState<FormLayoutTree>(() => normalizeLayout(baseLayout));
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);

  useEffect(() => {
    setLayout(normalizeLayout(initialLayout ?? (form as any).layout));
    setDirty(false);
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id, initialLayout]);

  const used = useMemo(() => collectUsedFieldIds(layout.nodes), [layout]);
  const unusedFields = useMemo(() => fields.filter(f => !used.has(f.id)), [fields, used]);
  const selected = selectedId ? findNode(layout.nodes, selectedId) : null;

  const mutate = (updater: (prev: FormLayoutTree) => FormLayoutTree) => {
    setLayout(prev => updater(prev));
    setDirty(true);
  };

  const applyDrop = (data: DragData, parentId: string | null, index: number) => {
    if (data.kind === "palette") {
      const node = createNode(data.nodeType, data.extra);
      mutate(prev => ({ ...prev, nodes: insertNode(prev.nodes, parentId, index, node) }));
      setSelectedId(node.id);
    } else if (data.kind === "field") {
      const node = createNode("field", { field_id: data.fieldId } as any);
      mutate(prev => ({ ...prev, nodes: insertNode(prev.nodes, parentId, index, node) }));
      setSelectedId(node.id);
    } else if (data.kind === "move") {
      mutate(prev => {
        const found = findNode(prev.nodes, data.nodeId);
        if (!found) return prev;
        if (parentId && isDescendant(found, parentId)) return prev;
        const removed = removeNode(prev.nodes, data.nodeId);
        return { ...prev, nodes: insertNode(removed, parentId, index, found) };
      });
    }
  };

  const addAtRoot = (t: LayoutNodeType, extra?: any) => {
    const node = createNode(t, extra);
    mutate(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelectedId(node.id);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as DragData | undefined;
    if (d) setDragging(d);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined;
    setDragging(null);
    if (!data || !e.over) return;
    const target = e.over.data.current as { parentId: string | null; index: number } | undefined;
    if (!target) return;
    applyDrop(data, target.parentId, target.index);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (onSaveLayout) return onSaveLayout(layout);
      return api.formDefinitions.update(form.id, { layout: layout as any });
    },
    onSuccess: () => {
      toast.success(`${saveLabel} erfolgreich`);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["form-definitions"] });
      qc.invalidateQueries({ queryKey: ["form-role-views", form.id] });
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid grid-cols-12 gap-3">
        {/* Palette + fields */}
        <div className="col-span-3 space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide">Layout-Bausteine</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {PALETTE.map((it, i) => (
                <PaletteItem key={i} it={it} canManage={canManage} onAdd={() => addAtRoot(it.key, it.extra)} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wide">Verfügbare Felder</CardTitle>
              <Badge variant="outline">{unusedFields.length}</Badge>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[420px] pr-2">
                {fields.length === 0 && <p className="text-xs text-muted-foreground p-2">Noch keine Felder definiert. Wechsle zum Tab „Felder".</p>}
                {fields.length > 0 && unusedFields.length === 0 && <p className="text-xs text-muted-foreground p-2">Alle Felder sind platziert.</p>}
                <div className="space-y-1">
                  {unusedFields.map(f => <FieldPaletteItem key={f.id} field={f} canManage={canManage} />)}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Canvas */}
        <div className="col-span-6">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{headerTitle}</CardTitle>
              <div className="flex gap-2">
                {dirty && <Badge variant="secondary">Ungespeichert</Badge>}
                <Button size="sm" variant="ghost" onClick={() => { setLayout(normalizeLayout(initialLayout ?? (form as any).layout)); setDirty(false); setSelectedId(null); }} disabled={!dirty}>
                  <RotateCcw className="h-3 w-3 mr-1" />Zurücksetzen
                </Button>
                <Button size="sm" onClick={() => saveMut.mutate()} disabled={!dirty || !canManage || saveMut.isPending}>
                  <Save className="h-3 w-3 mr-1" />Speichern
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RootCanvas
                layout={layout} fields={fields}
                selectedId={selectedId} onSelect={setSelectedId}
                onMutate={mutate} canManage={canManage}
              />
            </CardContent>
          </Card>
        </div>

        {/* Inspector + preview */}
        <div className="col-span-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide">Eigenschaften</CardTitle></CardHeader>
            <CardContent>
              {selected ? (
                <Inspector node={selected} fields={fields}
                  onChange={(patch) => mutate(prev => ({ ...prev, nodes: updateNode(prev.nodes, selected.id, patch) }))}
                  onDelete={() => { mutate(prev => ({ ...prev, nodes: removeNode(prev.nodes, selected.id) })); setSelectedId(null); }}
                  canManage={canManage} />
              ) : (
                <p className="text-xs text-muted-foreground">Kein Element ausgewählt. Baustein anklicken oder aus der Palette ziehen.</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-3">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide">Live-Vorschau</CardTitle></CardHeader>
            <CardContent>
              <div className="scale-[0.85] origin-top-left w-[118%]">
                <FormLayoutRenderer layout={layout} fields={fields} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DragOverlay>
        {dragging && <div className="border rounded bg-background shadow px-2 py-1 text-xs">
          {dragging.kind === "palette" ? PALETTE.find(p => p.key === dragging.nodeType && JSON.stringify(p.extra) === JSON.stringify((dragging as any).extra))?.label ?? dragging.nodeType
            : dragging.kind === "field" ? "Feld"
            : "Element verschieben"}
        </div>}
      </DragOverlay>
    </DndContext>
  );
}

// ---------- helpers ----------
function isDescendant(node: LayoutNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  if ("children" in node && Array.isArray((node as any).children)) {
    for (const c of (node as any).children) if (isDescendant(c, targetId)) return true;
  }
  return false;
}

// ---------- palette items ----------
function PaletteItem({ it, canManage, onAdd }: { it: typeof PALETTE[number]; canManage: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${it.key}-${JSON.stringify(it.extra ?? {})}-${it.label}`,
    data: { kind: "palette", nodeType: it.key, extra: it.extra } satisfies DragData,
    disabled: !canManage,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners} {...attributes}
      onDoubleClick={onAdd}
      title="Ziehen oder Doppelklick zum Einfügen"
      className={cn("border rounded p-2 flex flex-col items-center gap-1 cursor-grab hover:bg-muted text-xs select-none", isDragging && "opacity-40")}
    >
      <it.icon className="h-4 w-4" />
      <span className="text-center">{it.label}</span>
    </div>
  );
}

function FieldPaletteItem({ field, canManage }: { field: FormField; canManage: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-${field.id}`,
    data: { kind: "field", fieldId: field.id } satisfies DragData,
    disabled: !canManage,
  });
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      className={cn("border rounded p-2 cursor-grab hover:bg-muted flex items-center gap-2 select-none", isDragging && "opacity-40")}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{field.display_name}</div>
        <div className="text-[10px] text-muted-foreground truncate">{field.field_key} · {field.field_type}</div>
      </div>
    </div>
  );
}

// ---------- drop zones ----------
function DropZone({ id, parentId, index, mode = "gap" }:
  { id: string; parentId: string | null; index: number; mode?: "gap" | "empty" | "append" }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { parentId, index } });
  if (mode === "empty") {
    return (
      <div ref={setNodeRef}
        className={cn("text-[11px] text-muted-foreground text-center py-6 border border-dashed rounded transition-colors",
          isOver ? "bg-primary/10 border-primary text-primary" : "")}>
        Baustein oder Feld hierher ziehen
      </div>
    );
  }
  if (mode === "append") {
    return (
      <div ref={setNodeRef}
        className={cn("h-8 border border-dashed rounded mt-1 transition-colors flex items-center justify-center text-[10px] text-muted-foreground",
          isOver ? "bg-primary/10 border-primary text-primary" : "")}>
        {isOver ? "Hier ablegen" : ""}
      </div>
    );
  }
  return (
    <div ref={setNodeRef}
      className={cn("h-2 my-0.5 rounded transition-colors", isOver ? "bg-primary/50 h-3" : "bg-transparent")}
    />
  );
}

// ---------- canvas root ----------
function RootCanvas({ layout, fields, selectedId, onSelect, onMutate, canManage }: {
  layout: FormLayoutTree; fields: FormField[];
  selectedId: string | null; onSelect: (id: string) => void;
  onMutate: (u: (p: FormLayoutTree) => FormLayoutTree) => void;
  canManage: boolean;
}) {
  return (
    <div className="min-h-[520px] border rounded bg-background p-3">
      {layout.nodes.length === 0 ? (
        <DropZone id="drop-root-empty" parentId={null} index={0} mode="empty" />
      ) : (
        <>
          <DropZone id="drop-root-0" parentId={null} index={0} />
          {layout.nodes.map((n, i) => (
            <div key={n.id}>
              <NodeItem node={n} depth={0} fields={fields}
                selectedId={selectedId} onSelect={onSelect}
                onMutate={onMutate} canManage={canManage} />
              <DropZone id={`drop-root-${i + 1}`} parentId={null} index={i + 1} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------- recursive node ----------
function NodeItem({ node, depth, fields, selectedId, onSelect, onMutate, canManage }: {
  node: LayoutNode; depth: number; fields: FormField[];
  selectedId: string | null; onSelect: (id: string) => void;
  onMutate: (u: (p: FormLayoutTree) => FormLayoutTree) => void;
  canManage: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const selected = selectedId === node.id;
  const isContainer = "children" in node && Array.isArray((node as any).children);
  const children: LayoutNode[] = isContainer ? (node as any).children : [];

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `node-${node.id}`,
    data: { kind: "move", nodeId: node.id } satisfies DragData,
    disabled: !canManage,
  });

  const typeLabel = TYPE_LABELS[node.type] ?? node.type;
  const fieldLabel = node.type === "field"
    ? (fields.find(f => f.id === (node as FieldNode).field_id)?.display_name ?? "Feld nicht gefunden")
    : (node as any).title ?? (node as any).text ?? typeLabel;

  return (
    <div className={cn("border rounded mt-1", selected ? "border-primary" : "border-border", isDragging && "opacity-40")}>
      <div
        ref={setDragRef}
        className={cn("flex items-center gap-2 px-2 py-1.5 border-b cursor-pointer select-none",
          selected ? "bg-primary/10 border-primary" : "bg-muted/40")}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      >
        {isContainer && (
          <button onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }} className="text-muted-foreground">
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
        <span {...listeners} {...attributes} className="cursor-grab" title="Ziehen zum Verschieben">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </span>
        <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
        <span className="text-xs font-medium truncate flex-1">{fieldLabel}</span>
        {node.width && node.width !== 12 && <Badge variant="secondary" className="text-[10px]">{WIDTH_OPTS.find(w => w.v === node.width)?.l}</Badge>}
      </div>

      {isContainer && !collapsed && (
        <div className="p-2" style={{ paddingLeft: 8 + depth * 4 }}>
          {node.type === "tabs" ? (
            <TabsChildrenEditor node={node as any} fields={fields}
              onMutate={onMutate} selectedId={selectedId} onSelect={onSelect}
              depth={depth} canManage={canManage} />
          ) : node.type === "columns" ? (
            <ColumnsChildrenEditor node={node as any} fields={fields}
              onMutate={onMutate} selectedId={selectedId} onSelect={onSelect}
              depth={depth} canManage={canManage} />
          ) : (
            <ContainerChildren parentId={node.id} children={children} depth={depth}
              fields={fields} selectedId={selectedId} onSelect={onSelect}
              onMutate={onMutate} canManage={canManage} />
          )}
        </div>
      )}
    </div>
  );
}

function ContainerChildren({ parentId, children, depth, fields, selectedId, onSelect, onMutate, canManage }: {
  parentId: string; children: LayoutNode[]; depth: number; fields: FormField[];
  selectedId: string | null; onSelect: (id: string) => void;
  onMutate: (u: (p: FormLayoutTree) => FormLayoutTree) => void; canManage: boolean;
}) {
  if (children.length === 0) {
    return <DropZone id={`drop-empty-${parentId}`} parentId={parentId} index={0} mode="empty" />;
  }
  return (
    <>
      <DropZone id={`drop-${parentId}-0`} parentId={parentId} index={0} />
      {children.map((c, i) => (
        <div key={c.id}>
          <NodeItem node={c} depth={depth + 1} fields={fields}
            selectedId={selectedId} onSelect={onSelect}
            onMutate={onMutate} canManage={canManage} />
          <DropZone id={`drop-${parentId}-${i + 1}`} parentId={parentId} index={i + 1} />
        </div>
      ))}
    </>
  );
}

function TabsChildrenEditor({ node, fields, onMutate, selectedId, onSelect, depth, canManage }: any) {
  return (
    <div className="space-y-1">
      {node.children.map((tab: LayoutNode, i: number) => (
        <div key={tab.id} className="border rounded">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/30">
            <Badge variant="outline" className="text-[10px]">Tab</Badge>
            <Input value={(tab as any).title ?? ""} className="h-6 text-xs" disabled={!canManage}
              onChange={(e) => onMutate((prev: FormLayoutTree) => ({ ...prev, nodes: updateNode(prev.nodes, tab.id, { title: e.target.value } as any) }))} />
            <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!canManage}
              onClick={() => onMutate((prev: FormLayoutTree) => ({
                ...prev,
                nodes: updateNode(prev.nodes, node.id, { children: node.children.filter((_: any, idx: number) => idx !== i) } as any),
              }))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="p-2">
            <ContainerChildren parentId={tab.id} children={(tab as any).children} depth={depth + 1}
              fields={fields} selectedId={selectedId} onSelect={onSelect}
              onMutate={onMutate} canManage={canManage} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" disabled={!canManage} onClick={() => onMutate((prev: FormLayoutTree) => ({
        ...prev,
        nodes: updateNode(prev.nodes, node.id, {
          children: [...node.children, createNode("tab", { title: `Tab ${node.children.length + 1}` })],
        } as any),
      }))}>
        <Plus className="h-3 w-3 mr-1" />Tab hinzufügen
      </Button>
    </div>
  );
}

function ColumnsChildrenEditor({ node, fields, onMutate, selectedId, onSelect, depth, canManage }: any) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${node.columnCount}, minmax(0,1fr))` }}>
      {node.children.map((col: LayoutNode, ci: number) => (
        <div key={col.id} className="border rounded p-1 min-h-[80px]">
          <div className="text-[10px] text-muted-foreground px-1 py-0.5">Spalte {ci + 1}</div>
          <ContainerChildren parentId={col.id} children={(col as any).children} depth={depth + 1}
            fields={fields} selectedId={selectedId} onSelect={onSelect}
            onMutate={onMutate} canManage={canManage} />
        </div>
      ))}
    </div>
  );
}

// ---------- inspector ----------
function Inspector({ node, fields, onChange, onDelete, canManage }: {
  node: LayoutNode; fields: FormField[];
  onChange: (patch: Partial<LayoutNode>) => void;
  onDelete: () => void; canManage: boolean;
}) {
  const disabled = !canManage;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[node.type] ?? node.type}</Badge>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete} disabled={disabled}><Trash2 className="h-3 w-3" /></Button>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Sichtbar</Label>
        <Switch checked={node.visible !== false} onCheckedChange={(v) => onChange({ visible: v } as any)} disabled={disabled} />
      </div>

      <div>
        <Label className="text-xs">Breite</Label>
        <Select value={String(node.width ?? 12)} onValueChange={(v) => onChange({ width: parseInt(v, 10) as LayoutWidth } as any)} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{WIDTH_OPTS.map(w => <SelectItem key={w.v} value={String(w.v)}>{w.l}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">CSS-Klassen</Label>
        <Input value={node.className ?? ""} className="h-8 text-xs"
          onChange={(e) => onChange({ className: e.target.value } as any)} disabled={disabled} />
      </div>

      {("title" in node) && (
        <div>
          <Label className="text-xs">Titel</Label>
          <Input value={(node as any).title ?? ""} className="h-8 text-xs" onChange={(e) => onChange({ title: e.target.value } as any)} disabled={disabled} />
        </div>
      )}
      {node.type === "section" && (
        <>
          <div>
            <Label className="text-xs">Beschreibung</Label>
            <Textarea rows={2} value={(node as any).description ?? ""} onChange={(e) => onChange({ description: e.target.value } as any)} disabled={disabled} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Standardmäßig eingeklappt</Label>
            <Switch checked={!!(node as any).collapsed} onCheckedChange={(v) => onChange({ collapsed: v } as any)} disabled={disabled} />
          </div>
        </>
      )}
      {node.type === "columns" && (
        <div>
          <Label className="text-xs">Anzahl Spalten</Label>
          <Select value={String((node as any).columnCount ?? 2)} onValueChange={(v) => {
            const count = parseInt(v, 10);
            const existing = (node as any).children ?? [];
            const nextCols = Array.from({ length: count }, (_, i) => existing[i] ?? ({ id: Math.random().toString(36).slice(2, 10), type: "column", children: [], visible: true, width: 12 }));
            onChange({ columnCount: count, children: nextCols } as any);
          }} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {node.type === "heading" && (
        <>
          <div>
            <Label className="text-xs">Text</Label>
            <Input value={(node as any).text ?? ""} className="h-8 text-xs" onChange={(e) => onChange({ text: e.target.value } as any)} disabled={disabled} />
          </div>
          <div>
            <Label className="text-xs">Ebene</Label>
            <Select value={String((node as any).level ?? 3)} onValueChange={(v) => onChange({ level: parseInt(v, 10) } as any)} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4].map(l => <SelectItem key={l} value={String(l)}>H{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </>
      )}
      {node.type === "note" && (
        <>
          <div>
            <Label className="text-xs">Text</Label>
            <Textarea rows={3} value={(node as any).text ?? ""} onChange={(e) => onChange({ text: e.target.value } as any)} disabled={disabled} />
          </div>
          <div>
            <Label className="text-xs">Variante</Label>
            <Select value={(node as any).variant ?? "info"} onValueChange={(v) => onChange({ variant: v } as any)} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warnung</SelectItem>
                <SelectItem value="muted">Dezent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {node.type === "field" && (
        <>
          <div>
            <Label className="text-xs">Feld</Label>
            <Select value={(node as FieldNode).field_id} onValueChange={(v) => onChange({ field_id: v } as any)} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.display_name} ({f.field_key})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Label-Override</Label>
            <Input value={(node as FieldNode).label_override ?? ""} className="h-8 text-xs" onChange={(e) => onChange({ label_override: e.target.value } as any)} disabled={disabled} />
          </div>
          <div>
            <Label className="text-xs">Hilfetext-Override</Label>
            <Textarea rows={2} value={(node as FieldNode).description_override ?? ""} onChange={(e) => onChange({ description_override: e.target.value } as any)} disabled={disabled} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Nur lesend</Label>
            <Switch checked={!!(node as FieldNode).readonly} onCheckedChange={(v) => onChange({ readonly: v } as any)} disabled={disabled} />
          </div>
        </>
      )}
    </div>
  );
}
