import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { FormField } from "@/lib/api/formFields";
import {
  type LayoutNode, type LayoutNodeType, type FormLayoutTree,
  type LayoutWidth, type FieldNode,
  createNode, emptyLayout, normalizeLayout, findNode, updateNode,
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
  LayoutGrid, Rows3, Columns3, Columns2, Square, Minus, Heading1,
  StickyNote, Save, RotateCcw, Trash2, ChevronRight, ChevronDown,
  GripVertical, FolderTree, Folders, Plus,
} from "lucide-react";
import FormLayoutRenderer from "./FormLayoutRenderer";

// ------------- palette definition -------------
const PALETTE: { key: LayoutNodeType; label: string; icon: any; extra?: any }[] = [
  { key: "section", label: "Abschnitt", icon: LayoutGrid },
  { key: "group", label: "Gruppe", icon: Folders },
  { key: "tabs", label: "Register/Tabs", icon: FolderTree },
  { key: "columns", label: "2 Spalten", icon: Columns2, extra: { columnCount: 2 } },
  { key: "columns", label: "3 Spalten", icon: Columns3, extra: { columnCount: 3 } },
  { key: "container", label: "Container/Panel", icon: Square },
  { key: "divider", label: "Trennlinie", icon: Minus },
  { key: "heading", label: "Überschrift", icon: Heading1 },
  { key: "note", label: "Hinweistext", icon: StickyNote },
];

const WIDTH_OPTS: { v: LayoutWidth; l: string }[] = [
  { v: 12, l: "100%" }, { v: 9, l: "75%" }, { v: 8, l: "66%" },
  { v: 6, l: "50%" }, { v: 4, l: "33%" }, { v: 3, l: "25%" },
];

// ------------- drag payload helpers -------------
type DragPayload =
  | { kind: "palette"; nodeType: LayoutNodeType; extra?: any }
  | { kind: "field"; fieldId: string }
  | { kind: "move"; nodeId: string };

const DND_MIME = "application/x-form-layout";

function setDragPayload(e: React.DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}
function getDragPayload(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DND_MIME);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ------------- main component -------------
export default function FormLayoutDesigner({ form, canManage }: { form: FormDefinition; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });

  const [layout, setLayout] = useState<FormLayoutTree>(() => normalizeLayout((form as any).layout));
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLayout(normalizeLayout((form as any).layout));
    setDirty(false);
    setSelectedId(null);
  }, [form.id]);

  const used = useMemo(() => collectUsedFieldIds(layout.nodes), [layout]);
  const unusedFields = useMemo(() => fields.filter(f => !used.has(f.id)), [fields, used]);
  const selected = selectedId ? findNode(layout.nodes, selectedId) : null;

  const mutate = (updater: (prev: FormLayoutTree) => FormLayoutTree) => {
    setLayout(prev => {
      const next = updater(prev);
      return next;
    });
    setDirty(true);
  };

  const handleDropOnRoot = (index: number) => (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const p = getDragPayload(e); if (!p) return;
    applyDrop(p, null, index);
  };

  const applyDrop = (p: DragPayload, parentId: string | null, index: number) => {
    if (p.kind === "palette") {
      const node = createNode(p.nodeType, p.extra);
      mutate(prev => ({ ...prev, nodes: insertNode(prev.nodes, parentId, index, node) }));
      setSelectedId(node.id);
    } else if (p.kind === "field") {
      const node = createNode("field", { field_id: p.fieldId } as any);
      mutate(prev => ({ ...prev, nodes: insertNode(prev.nodes, parentId, index, node) }));
      setSelectedId(node.id);
    } else if (p.kind === "move") {
      // remove then insert
      mutate(prev => {
        const found = findNode(prev.nodes, p.nodeId);
        if (!found) return prev;
        const removed = removeNode(prev.nodes, p.nodeId);
        return { ...prev, nodes: insertNode(removed, parentId, index, found) };
      });
    }
  };

  const saveMut = useMutation({
    mutationFn: () => api.formDefinitions.update(form.id, { layout: layout as any }),
    onSuccess: () => {
      toast.success("Layout gespeichert");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["form-definitions"] });
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Palette + fields */}
      <div className="col-span-3 space-y-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide">Layout-Bausteine</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {PALETTE.map((it, i) => (
              <div key={i}
                draggable={canManage}
                onDragStart={(e) => setDragPayload(e, { kind: "palette", nodeType: it.key, extra: it.extra })}
                className="border rounded p-2 flex flex-col items-center gap-1 cursor-grab hover:bg-muted text-xs">
                <it.icon className="h-4 w-4" />
                <span>{it.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wide">Verfügbare Felder</CardTitle>
            <Badge variant="outline">{unusedFields.length}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[360px] pr-2">
              {fields.length === 0 && <p className="text-xs text-muted-foreground p-2">Noch keine Felder definiert. Wechsle zum Tab „Felder".</p>}
              {fields.length > 0 && unusedFields.length === 0 && <p className="text-xs text-muted-foreground p-2">Alle Felder sind platziert.</p>}
              <div className="space-y-1">
                {unusedFields.map(f => (
                  <div key={f.id}
                    draggable={canManage}
                    onDragStart={(e) => setDragPayload(e, { kind: "field", fieldId: f.id })}
                    className="border rounded p-2 cursor-grab hover:bg-muted flex items-center gap-2">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{f.display_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{f.field_key} · {f.field_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <div className="col-span-6">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Canvas</CardTitle>
            <div className="flex gap-2">
              {dirty && <Badge variant="secondary">Ungespeichert</Badge>}
              <Button size="sm" variant="ghost" onClick={() => { setLayout(normalizeLayout((form as any).layout)); setDirty(false); setSelectedId(null); }} disabled={!dirty}>
                <RotateCcw className="h-3 w-3 mr-1" />Zurücksetzen
              </Button>
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={!dirty || !canManage || saveMut.isPending}>
                <Save className="h-3 w-3 mr-1" />Speichern
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[500px] border rounded bg-background p-3 space-y-2">
              <RootDropZone index={0} onDrop={handleDropOnRoot(0)} />
              {layout.nodes.map((n, i) => (
                <div key={n.id}>
                  <NodeItem
                    node={n} depth={0}
                    fields={fields}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onMutate={mutate}
                    canManage={canManage}
                    onDrop={(parentId, idx, e) => {
                      e.preventDefault(); e.stopPropagation();
                      const p = getDragPayload(e); if (p) applyDrop(p, parentId, idx);
                    }}
                  />
                  <RootDropZone index={i + 1} onDrop={handleDropOnRoot(i + 1)} />
                </div>
              ))}
              {layout.nodes.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-16 border border-dashed rounded">
                  Bausteine oder Felder hierher ziehen
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inspector */}
      <div className="col-span-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide">Eigenschaften</CardTitle></CardHeader>
          <CardContent>
            {selected ? (
              <Inspector node={selected} fields={fields} onChange={(patch) => mutate(prev => ({ ...prev, nodes: updateNode(prev.nodes, selected.id, patch) }))}
                onDelete={() => { mutate(prev => ({ ...prev, nodes: removeNode(prev.nodes, selected.id) })); setSelectedId(null); }}
                canManage={canManage} />
            ) : (
              <p className="text-xs text-muted-foreground">Kein Element ausgewählt.</p>
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
  );
}

// ------------- root drop zone (between nodes) -------------
function RootDropZone({ index, onDrop }: { index: number; onDrop: (e: React.DragEvent) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e); }}
      className={cn("h-2 rounded transition-colors", over ? "bg-primary/40" : "bg-transparent")}
      aria-hidden
    />
  );
}

// ------------- recursive node item -------------
function NodeItem({
  node, depth, fields, selectedId, onSelect, onMutate, canManage, onDrop,
}: {
  node: LayoutNode; depth: number; fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMutate: (u: (p: FormLayoutTree) => FormLayoutTree) => void;
  canManage: boolean;
  onDrop: (parentId: string | null, index: number, e: React.DragEvent) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const selected = selectedId === node.id;
  const isContainer = "children" in node && Array.isArray((node as any).children);
  const children: LayoutNode[] = isContainer ? (node as any).children : [];

  const headerBg = selected ? "bg-primary/10 border-primary" : "bg-muted/40 border-transparent";
  const typeLabel = TYPE_LABELS[node.type] ?? node.type;

  const fieldLabel = node.type === "field"
    ? (fields.find(f => f.id === (node as FieldNode).field_id)?.display_name ?? "Feld?")
    : (node as any).title ?? (node as any).text ?? typeLabel;

  return (
    <div className={cn("border rounded", selected && "border-primary")}>
      <div
        className={cn("flex items-center gap-2 px-2 py-1.5 border-b cursor-pointer select-none", headerBg)}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        draggable={canManage}
        onDragStart={(e) => { e.stopPropagation(); setDragPayload(e, { kind: "move", nodeId: node.id }); }}
      >
        {isContainer && (
          <button onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }} className="text-muted-foreground">
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
        <GripVertical className="h-3 w-3 text-muted-foreground" />
        <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
        <span className="text-xs font-medium truncate flex-1">{fieldLabel}</span>
        {node.width && node.width !== 12 && <Badge variant="secondary" className="text-[10px]">{WIDTH_OPTS.find(w => w.v === node.width)?.l}</Badge>}
      </div>

      {isContainer && !collapsed && (
        <div className="p-2 space-y-1" style={{ paddingLeft: 8 + depth * 4 }}>
          {node.type === "tabs" ? (
            <TabsChildrenEditor node={node as any} fields={fields} onMutate={onMutate} onDrop={onDrop} selectedId={selectedId} onSelect={onSelect} depth={depth} canManage={canManage} />
          ) : node.type === "columns" ? (
            <ColumnsChildrenEditor node={node as any} fields={fields} onMutate={onMutate} onDrop={onDrop} selectedId={selectedId} onSelect={onSelect} depth={depth} canManage={canManage} />
          ) : (
            <>
              <ChildDropZone parentId={node.id} index={0} onDrop={onDrop} />
              {children.map((c, i) => (
                <div key={c.id}>
                  <NodeItem node={c} depth={depth + 1} fields={fields} selectedId={selectedId} onSelect={onSelect} onMutate={onMutate} canManage={canManage} onDrop={onDrop} />
                  <ChildDropZone parentId={node.id} index={i + 1} onDrop={onDrop} />
                </div>
              ))}
              {children.length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-3 border border-dashed rounded">
                  Elemente hierher ziehen
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChildDropZone({ parentId, index, onDrop }: { parentId: string; index: number; onDrop: (p: string | null, i: number, e: React.DragEvent) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(parentId, index, e); }}
      className={cn("h-1.5 rounded transition-colors", over ? "bg-primary/40" : "bg-transparent")}
      aria-hidden
    />
  );
}

function TabsChildrenEditor(props: any) {
  const { node, fields, onMutate, onDrop, selectedId, onSelect, depth, canManage } = props;
  return (
    <div className="space-y-1">
      {node.children.map((tab: LayoutNode, i: number) => (
        <div key={tab.id} className="border rounded">
          <div className="flex items-center gap-2 px-2 py-1 bg-muted/30">
            <Badge variant="outline" className="text-[10px]">Tab</Badge>
            <Input value={(tab as any).title ?? ""} className="h-6 text-xs" disabled={!canManage}
              onChange={(e) => onMutate((prev: FormLayoutTree) => ({ ...prev, nodes: updateNode(prev.nodes, tab.id, { title: e.target.value } as any) }))} />
            <Button size="icon" variant="ghost" className="h-6 w-6"
              onClick={() => onMutate((prev: FormLayoutTree) => ({ ...prev, nodes: updateNode(prev.nodes, node.id, { children: node.children.filter((_: any, idx: number) => idx !== i) } as any) }))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="p-2 space-y-1">
            <ChildDropZone parentId={tab.id} index={0} onDrop={onDrop} />
            {(tab as any).children.map((c: LayoutNode, j: number) => (
              <div key={c.id}>
                <NodeItem node={c} depth={depth + 1} fields={fields} selectedId={selectedId} onSelect={onSelect} onMutate={onMutate} canManage={canManage} onDrop={onDrop} />
                <ChildDropZone parentId={tab.id} index={j + 1} onDrop={onDrop} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onMutate((prev: FormLayoutTree) => ({
        ...prev, nodes: updateNode(prev.nodes, node.id, {
          children: [...node.children, createNode("tab", { title: `Tab ${node.children.length + 1}` })],
        } as any),
      }))}>
        <Plus className="h-3 w-3 mr-1" />Tab hinzufügen
      </Button>
    </div>
  );
}

function ColumnsChildrenEditor(props: any) {
  const { node, fields, onMutate, onDrop, selectedId, onSelect, depth, canManage } = props;
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${node.columnCount}, 1fr)` }}>
      {node.children.map((col: LayoutNode) => (
        <div key={col.id} className="border rounded p-1 min-h-[80px]">
          <div className="text-[10px] text-muted-foreground px-1 py-0.5">Spalte</div>
          <ChildDropZone parentId={col.id} index={0} onDrop={onDrop} />
          {(col as any).children.map((c: LayoutNode, j: number) => (
            <div key={c.id}>
              <NodeItem node={c} depth={depth + 1} fields={fields} selectedId={selectedId} onSelect={onSelect} onMutate={onMutate} canManage={canManage} onDrop={onDrop} />
              <ChildDropZone parentId={col.id} index={j + 1} onDrop={onDrop} />
            </div>
          ))}
          {(col as any).children.length === 0 && (
            <div className="text-[11px] text-muted-foreground text-center py-3 border border-dashed rounded">leer</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ------------- inspector -------------
function Inspector({ node, fields, onChange, onDelete, canManage }: {
  node: LayoutNode; fields: FormField[];
  onChange: (patch: Partial<LayoutNode>) => void;
  onDelete: () => void;
  canManage: boolean;
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
        <div>
          <Label className="text-xs">Beschreibung</Label>
          <Textarea rows={2} value={(node as any).description ?? ""} onChange={(e) => onChange({ description: e.target.value } as any)} disabled={disabled} />
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
            <Label className="text-xs">Read-only</Label>
            <Switch checked={!!(node as FieldNode).readonly} onCheckedChange={(v) => onChange({ readonly: v } as any)} disabled={disabled} />
          </div>
        </>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<LayoutNodeType, string> = {
  section: "Abschnitt", group: "Gruppe", tabs: "Tabs", tab: "Tab",
  columns: "Spalten", column: "Spalte", container: "Container", divider: "Trennlinie",
  heading: "Überschrift", note: "Hinweis", field: "Feld",
};
