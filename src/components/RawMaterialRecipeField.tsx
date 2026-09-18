import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, ChevronsUpDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { formatQuantity } from "@/lib/formatQuantity";

export interface RecipeRow {
  raw_material_id: string;
  quantity: number | string;
  unit: string;
  note?: string;
}

interface Props {
  value: RecipeRow[] | undefined;
  onChange: (rows: RecipeRow[]) => void;
  readonly?: boolean;
}

/** Option der Rohstoffsuche – ausschließlich aus der bestehenden Rohstoffverwaltung. */
interface MaterialOption {
  id: string;
  name: string;
  number: string | null;
  other: string | null;
  unit: string | null;
  supplier: string | null;
  /** Vorberechneter Suchtext über alle Identifikationsfelder. */
  haystack: string;
}

function MaterialPicker({
  options, valueId, disabled, onSelect,
}: {
  options: MaterialOption[];
  valueId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === valueId) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-8 w-full justify-between font-normal"
        >
          <span className="truncate">
            {current
              ? `${current.name}${current.number ? ` (${current.number})` : ""}`
              : "Rohstoff suchen …"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        {/* Suche über Bezeichnung, Rohstoffnummer, weitere Bezeichnung, CAS/MRS/EG, Hersteller, Lieferant. */}
        <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase().trim()) ? 1 : 0)}>
          <CommandInput placeholder="z. B. 1821 oder TiW …" />
          <CommandList>
            <CommandEmpty>Kein Rohstoff in den Stammdaten gefunden.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={o.haystack} onSelect={() => { onSelect(o.id); setOpen(false); }}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{o.name}</span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {[o.number, o.other, o.supplier].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SortableRow({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="grid grid-cols-[auto_minmax(180px,2fr)_100px_80px_1fr_auto] items-center gap-2"
    >
      <button
        type="button"
        aria-label="Position verschieben"
        className="cursor-grab text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

/**
 * Rezeptur / Rohstoffliste (Auftraggeber).
 * Es werden ausschließlich bestehende Rohstoffe der Rohstoffverwaltung
 * ausgewählt (Referenz auf `raw_materials.id`); Stammdaten werden hier nie
 * verändert oder neu angelegt. Die Reihenfolge der Positionen ist Teil des
 * gespeicherten Werts (Array-Reihenfolge).
 */
export default function RawMaterialRecipeField({ value, onChange, readonly }: Props) {
  const rows: RecipeRow[] = Array.isArray(value) ? value : [];

  const { data: materials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => api.rawMaterials.list(),
  });
  const { data: containers = [] } = useQuery({
    queryKey: ["raw-material-containers", "all"],
    queryFn: () => api.rawMaterialContainers.list(),
  });

  const materialById = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of materials as any[]) m.set(r.id, r);
    return m;
  }, [materials]);

  const options = useMemo<MaterialOption[]>(
    () =>
      (materials as any[]).map((m) => ({
        id: m.id as string,
        name: (m.material_name ?? "") as string,
        number: (m.material_number ?? null) as string | null,
        other: (m.other_designation ?? null) as string | null,
        unit: (m.unit ?? null) as string | null,
        supplier: (m.supplier ?? null) as string | null,
        // Zentrale Suchlogik inkl. LOT-Nummern und LOT-bezogener MRS-Nummern
        haystack: rawMaterialSearchHaystack(m),
      })),
    [materials]
  );

  const availableByMaterial = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of containers as any[]) {
      if (c.status === "entsorgt" || c.status === "gesperrt") continue;
      const avail = Number(c.current_quantity ?? 0) - Number(c.reserved_quantity ?? 0);
      if (avail <= 0) continue;
      m.set(c.raw_material_id, (m.get(c.raw_material_id) ?? 0) + avail);
    }
    return m;
  }, [containers]);

  const update = (idx: number, patch: Partial<RecipeRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { raw_material_id: "", quantity: "", unit: "", note: "" }]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const rowIds = rows.map((_, i) => `recipe-row-${i}`);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rowIds.indexOf(String(active.id));
    const to = rowIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(rows, from, to));
  };

  const shortages = useMemo(() => {
    const list: Array<{ name: string; required: number; available: number; unit: string }> = [];
    for (const r of rows) {
      if (!r.raw_material_id) continue;
      const req = Number(r.quantity);
      if (!isFinite(req) || req <= 0) continue;
      const avail = availableByMaterial.get(r.raw_material_id) ?? 0;
      if (avail < req) {
        const mat = materialById.get(r.raw_material_id);
        list.push({
          name: mat?.material_name ?? "Unbekannt",
          required: req,
          available: avail,
          unit: r.unit || mat?.unit || "",
        });
      }
    }
    return list;
  }, [rows, availableByMaterial, materialById]);

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Rezeptur / Rohstoffliste</span>
        {!readonly && (
          <Button type="button" size="sm" variant="outline" onClick={add} className="h-7">
            <Plus className="mr-1 h-3 w-3" /> Rohstoff hinzufügen
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">Noch keine Rohstoffe hinzugefügt.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[auto_minmax(180px,2fr)_100px_80px_1fr_auto] gap-2 px-1 text-[10px] uppercase text-muted-foreground">
            <div className="w-4">#</div>
            <div>Rohstoff</div>
            <div>Sollmenge</div>
            <div>Einheit</div>
            <div>Bemerkung</div>
            <div />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              {rows.map((row, idx) => {
                const mat = materialById.get(row.raw_material_id);
                const req = Number(row.quantity);
                const avail = availableByMaterial.get(row.raw_material_id) ?? 0;
                const short = row.raw_material_id && isFinite(req) && req > 0 && avail < req;
                return (
                  <SortableRow key={rowIds[idx]} id={rowIds[idx]} disabled={readonly}>
                    <MaterialPicker
                      options={options}
                      valueId={row.raw_material_id}
                      disabled={readonly}
                      onSelect={(v) => {
                        const chosen = options.find((o) => o.id === v);
                        update(idx, { raw_material_id: v, unit: row.unit || chosen?.unit || "" });
                      }}
                    />
                    <Input
                      type="number"
                      step="any"
                      value={row.quantity ?? ""}
                      onChange={(e) => update(idx, { quantity: e.target.value })}
                      disabled={readonly}
                      className="h-8"
                    />
                    <Input
                      value={row.unit ?? ""}
                      onChange={(e) => update(idx, { unit: e.target.value })}
                      disabled={readonly}
                      className="h-8"
                      placeholder={mat?.unit ?? "kg"}
                    />
                    <Input
                      value={row.note ?? ""}
                      onChange={(e) => update(idx, { note: e.target.value })}
                      disabled={readonly}
                      className="h-8"
                      placeholder="optional"
                    />
                    <div className="flex items-center gap-1">
                      {row.raw_material_id && isFinite(req) && req > 0 && (
                        <Badge variant={short ? "destructive" : "secondary"} className="text-[10px]">
                          {short ? <AlertTriangle className="mr-0.5 h-3 w-3" /> : <CheckCircle2 className="mr-0.5 h-3 w-3" />}
                          {formatQuantity(avail)} {row.unit || mat?.unit || ""}
                        </Badge>
                      )}
                      {!readonly && (
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </SortableRow>
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {shortages.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nicht ausreichend Material verfügbar</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-1 text-xs">
              {shortages.map((s, i) => (
                <li key={i}>
                  <strong>{s.name}</strong>: benötigt {formatQuantity(s.required)} {s.unit},
                  verfügbar {formatQuantity(s.available)} {s.unit}
                  {" — "}
                  <strong>fehlt {formatQuantity(s.required - s.available)} {s.unit}</strong>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
