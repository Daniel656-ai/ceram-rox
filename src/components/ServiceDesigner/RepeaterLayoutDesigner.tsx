import { useMemo, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SymbolInput } from "@/components/forms/SymbolInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Trash2, Plus, Heading1, Minus, CornerDownLeft, Folders, Move, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type RepeaterLayout, type RepeaterLayoutItem, type RepeaterLeafItem, type RepeaterGroupItem,
  REPEATER_WIDTHS, repeaterWidthClass, repeaterGapClass, newItemId, normalizeRepeaterLayout,
} from "@/lib/repeaterLayout";

export interface RepeaterSubfieldInfo {
  key: string;
  label: string;
  type?: string;
  unit?: string | null;
}

export interface RepeaterCalcInfo {
  calc_key: string;
  label: string;
  unit?: string | null;
}

interface Props {
  subfields: RepeaterSubfieldInfo[];
  /**
   * Lokale Berechnungen des Formulars. Sie können als Element im Eintrag
   * platziert werden und werden je Messpunkt mit dessen Werten ausgewertet.
   */
  calculations?: RepeaterCalcInfo[];
  /** Rohwert aus metadata.repeater.layout */
  value: unknown;
  onChange: (layout: RepeaterLayout) => void;
  disabled?: boolean;
}

const ROOT = "__root__";

/**
 * Kleiner Layout-Designer für die Unterfelder eines Repeaters.
 * Ergebnis wird pro Repeater gespeichert und in jedem Formular verwendet,
 * das diesen Repeater referenziert.
 */
export default function RepeaterLayoutDesigner({ subfields, calculations = [], value, onChange, disabled }: Props) {
  const keys = useMemo(() => subfields.map((s) => s.key), [subfields]);
  const layout = useMemo(() => normalizeRepeaterLayout(value, keys), [value, keys]);
  const labelFor = (k: string) => subfields.find((s) => s.key === k)?.label ?? k;
  const calcLabelFor = (k: string) => calculations.find((c) => c.calc_key === k)?.label ?? k;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [previewCount] = useState(1);

  const commit = (items: RepeaterLayoutItem[], gap = layout.gap) =>
    onChange({ version: 1, gap, items });

  // ---- container helpers ----
  const containerOf = (id: string): string | null => {
    if (layout.items.some((i) => i.id === id)) return ROOT;
    for (const it of layout.items) {
      if (it.type === "group" && it.children.some((c) => c.id === id)) return it.id;
    }
    return null;
  };
  const itemsOf = (container: string): RepeaterLayoutItem[] =>
    container === ROOT
      ? layout.items
      : ((layout.items.find((i) => i.id === container) as RepeaterGroupItem | undefined)?.children ?? []);

  const setItemsOf = (container: string, next: RepeaterLayoutItem[]) => {
    if (container === ROOT) return commit(next);
    commit(layout.items.map((i) =>
      i.id === container && i.type === "group"
        ? { ...i, children: next.filter((c) => c.type !== "group") as RepeaterLeafItem[] }
        : i
    ));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const from = containerOf(activeId);
    if (!from) return;

    // Drop auf eine Gruppenzone
    const dropGroup = overId.startsWith("zone:") ? overId.slice(5) : null;
    const to = dropGroup ?? containerOf(overId);
    if (!to) return;

    const src = itemsOf(from).slice();
    const idx = src.findIndex((i) => i.id === activeId);
    if (idx < 0) return;
    const moved = src[idx];
    if (moved.type === "group" && to !== ROOT) return; // keine verschachtelten Gruppen

    if (from === to) {
      const overIdx = src.findIndex((i) => i.id === overId);
      if (overIdx < 0) return;
      setItemsOf(from, arrayMove(src, idx, overIdx));
      return;
    }

    src.splice(idx, 1);
    const dst = (to === from ? src : itemsOf(to).slice());
    const overIdx = dropGroup ? dst.length : dst.findIndex((i) => i.id === overId);
    dst.splice(overIdx < 0 ? dst.length : overIdx, 0, moved);

    // beide Container in einem Commit schreiben
    if (from === ROOT) {
      const rootItems = src.map((i) =>
        i.id === to && i.type === "group"
          ? { ...i, children: dst.filter((c) => c.type !== "group") as RepeaterLeafItem[] }
          : i
      );
      commit(rootItems);
    } else if (to === ROOT) {
      const rootItems = dst.map((i) =>
        i.id === from && i.type === "group"
          ? { ...i, children: src.filter((c) => c.type !== "group") as RepeaterLeafItem[] }
          : i
      );
      commit(rootItems);
    } else {
      commit(layout.items.map((i) => {
        if (i.type !== "group") return i;
        if (i.id === from) return { ...i, children: src as RepeaterLeafItem[] };
        if (i.id === to) return { ...i, children: dst as RepeaterLeafItem[] };
        return i;
      }));
    }
  };

  const patchItem = (id: string, patch: Partial<RepeaterLayoutItem>) => {
    commit(layout.items.map((i) => {
      if (i.id === id) return { ...i, ...patch } as RepeaterLayoutItem;
      if (i.type === "group") {
        return { ...i, children: i.children.map((c) => (c.id === id ? { ...c, ...patch } as RepeaterLeafItem : c)) };
      }
      return i;
    }));
  };

  const removeItem = (id: string) => {
    commit(
      layout.items
        .filter((i) => i.id !== id)
        .map((i) => (i.type === "group" ? { ...i, children: i.children.filter((c) => c.id !== id) } : i))
    );
  };

  const addItem = (item: RepeaterLayoutItem) => commit([...layout.items, item]);

  const moveToContainer = (id: string, target: string) => {
    const from = containerOf(id);
    if (!from || from === target) return;
    let moved: RepeaterLayoutItem | null = null;
    const stripped = layout.items
      .filter((i) => {
        if (i.id === id) { moved = i; return false; }
        return true;
      })
      .map((i) => {
        if (i.type === "group") {
          const hit = i.children.find((c) => c.id === id);
          if (hit) { moved = hit; return { ...i, children: i.children.filter((c) => c.id !== id) }; }
        }
        return i;
      });
    if (!moved) return;
    if (target === ROOT) return commit([...stripped, moved]);
    commit(stripped.map((i) =>
      i.id === target && i.type === "group"
        ? { ...i, children: [...i.children, moved as RepeaterLeafItem] }
        : i
    ));
  };

  const groups = layout.items.filter((i) => i.type === "group") as RepeaterGroupItem[];

  const renderRow = (item: RepeaterLayoutItem, container: string) => (
    <SortableRow key={item.id} id={item.id} disabled={!!disabled}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex-1 min-w-0 truncate text-xs">
          {item.type === "field" && (
            <>
              {labelFor(item.key)}
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">{item.key}</span>
            </>
          )}
          {item.type === "heading" && (
            <Input
              className="h-7 text-xs" value={item.text} disabled={disabled}
              onChange={(e) => patchItem(item.id, { text: e.target.value } as any)}
            />
          )}
          {item.type === "calculation" && (
            <>
              <Calculator className="inline h-3 w-3 mr-1 text-muted-foreground" />
              {calcLabelFor(item.calc_key)}
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">{item.calc_key}</span>
            </>
          )}
          {item.type === "spacer" && <span className="text-muted-foreground">Abstand / Platzhalter</span>}
          {item.type === "break" && <span className="text-muted-foreground">Zeilenumbruch</span>}
          {item.type === "group" && (
            <SymbolInput
              className="h-7 text-xs" value={item.title} disabled={disabled}
              onChange={(v) => patchItem(item.id, { title: v } as any)}
            />
          )}
        </span>

        {item.type !== "break" && (
          <Select
            value={String((item as any).width ?? 12)}
            onValueChange={(v) => patchItem(item.id, { width: Number(v) } as any)}
            disabled={disabled}
          >
            <SelectTrigger className="h-7 w-[130px] text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPEATER_WIDTHS.map((w) => (
                <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {item.type !== "group" && groups.length > 0 && (
          <Select value={container} onValueChange={(v) => moveToContainer(item.id, v)} disabled={disabled}>
            <SelectTrigger className="h-7 w-[120px] text-[11px]">
              <Move className="h-3 w-3 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>Hauptbereich</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {item.type !== "field" && (
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={disabled}
            onClick={() => removeItem(item.id)} type="button">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {item.type === "group" && (
        <GroupZone id={item.id}>
          <SortableContext items={item.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1 pl-4 border-l ml-1 mt-2">
              {item.children.length === 0 && (
                <p className="text-[10px] text-muted-foreground py-1">Felder hierher ziehen…</p>
              )}
              {item.children.map((c) => renderRow(c, item.id))}
            </div>
          </SortableContext>
        </GroupZone>
      )}
    </SortableRow>
  );

  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Layout der Unterfelder
        </p>
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground">Abstand</Label>
          <Select value={layout.gap} onValueChange={(v) => commit(layout.items, v as any)} disabled={disabled}>
            <SelectTrigger className="h-7 w-[110px] text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Kompakt</SelectItem>
              <SelectItem value="md">Normal</SelectItem>
              <SelectItem value="lg">Weit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!disabled && (
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
            onClick={() => addItem({ id: newItemId(), type: "heading", text: "Überschrift", width: 12 })}>
            <Heading1 className="h-3 w-3 mr-1" />Überschrift
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
            onClick={() => addItem({ id: newItemId(), type: "group", title: "Gruppe", width: 12, children: [] })}>
            <Folders className="h-3 w-3 mr-1" />Gruppe
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
            onClick={() => addItem({ id: newItemId(), type: "break" })}>
            <CornerDownLeft className="h-3 w-3 mr-1" />Zeilenumbruch
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
            onClick={() => addItem({ id: newItemId(), type: "spacer", width: 6 })}>
            <Minus className="h-3 w-3 mr-1" />Abstand
          </Button>
          {calculations.length > 0 && (
            <Select
              value=""
              onValueChange={(v) => addItem({ id: newItemId(), type: "calculation", calc_key: v, width: 4 })}
            >
              <SelectTrigger className="h-7 w-[190px] text-[11px]">
                <Calculator className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Berechnung einfügen" />
              </SelectTrigger>
              <SelectContent>
                {calculations.map((c) => (
                  <SelectItem key={c.calc_key} value={c.calc_key}>
                    {c.label}{c.unit ? ` [${c.unit}]` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]"
            onClick={() => commit(keys.map((k) => ({ id: newItemId(), type: "field", key: k, width: 6 } as RepeaterLayoutItem)))}>
            <Plus className="h-3 w-3 mr-1" />Zurücksetzen
          </Button>
        </div>
      )}

      {subfields.length === 0 ? (
        <p className="text-xs text-muted-foreground">Zuerst Unterfelder anlegen.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={layout.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {layout.items.map((i) => renderRow(i, ROOT))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Vorschau */}
      <div className="border-t pt-3">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">Vorschau eines Eintrags</p>
        <div className="rounded border p-3 bg-muted/20">
          <div className={cn("grid grid-cols-12", repeaterGapClass(layout.gap))}>
            {layout.items.map((it) => <PreviewItem key={it.id} item={it} labelFor={labelFor} gap={layout.gap} />)}
          </div>
        </div>
      </div>
      {previewCount === 0 && null}
    </div>
  );
}

function PreviewItem({
  item, labelFor, gap,
}: { item: RepeaterLayoutItem; labelFor: (k: string) => string; gap: any }) {
  if (item.type === "break") return <div className="col-span-12 h-0" />;
  if (item.type === "spacer") return <div className={repeaterWidthClass(item.width)} />;
  if (item.type === "heading") {
    return <div className={cn(repeaterWidthClass(item.width), "text-xs font-semibold pt-1")}>{item.text}</div>;
  }
  if (item.type === "group") {
    return (
      <div className={cn(repeaterWidthClass(item.width), "rounded border bg-background p-2")}>
        <p className="text-[11px] font-medium mb-1">{item.title}</p>
        <div className={cn("grid grid-cols-12", repeaterGapClass(gap))}>
          {item.children.map((c) => <PreviewItem key={c.id} item={c} labelFor={labelFor} gap={gap} />)}
        </div>
      </div>
    );
  }
  if (item.type === "calculation") {
    return (
      <div className={repeaterWidthClass(item.width)}>
        <p className="text-[10px] text-muted-foreground truncate">{item.label_override || item.calc_key}</p>
        <div className="h-7 rounded border bg-muted/40" />
      </div>
    );
  }
  return (
    <div className={repeaterWidthClass(item.width)}>
      <p className="text-[10px] text-muted-foreground truncate">{labelFor(item.key)}</p>
      <div className="h-7 rounded border bg-background" />
    </div>
  );
}

function SortableRow({ id, disabled, children }: { id: string; disabled: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded border bg-card px-2 py-1.5", isDragging && "opacity-50 ring-1 ring-primary")}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab text-muted-foreground disabled:cursor-not-allowed"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function GroupZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useSortable({ id: `zone:${id}` });
  return <div ref={setNodeRef}>{children}</div>;
}

export { ROOT as REPEATER_LAYOUT_ROOT };
export const RepeaterLayoutBadge = ({ count }: { count: number }) => (
  <Badge variant="outline" className="text-[10px]">{count} Elemente</Badge>
);
