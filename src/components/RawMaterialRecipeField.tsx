import { useMemo, useState } from "react";
import { rawMaterialSearchHaystack } from "@/lib/rawMaterialSearch";
import { useQuery } from "@tanstack/react-query";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, ChevronsUpDown, GripVertical, Plus, SeparatorHorizontal, Trash2 } from "lucide-react";
import { formatQuantity } from "@/lib/formatQuantity";
import { compareStock, convertQuantity, defaultRecipeUnit } from "@/lib/recipeUnits";
import {
  appendRowToSection,
  appendSection,
  groupRecipeSections,
  isSectionEntry,
  removeSectionMarker,
  sectionTitle,
  updateSectionMarker,
  type RecipeEntry,
  type RecipeMaterialRow,
} from "@/lib/recipeSections";

/** Rohstoffzeile einer Rezeptur (unverändertes Format, plus optionale Lot-Felder). */
export type RecipeRow = RecipeMaterialRow;

interface Props {
  value: RecipeEntry[] | undefined;
  onChange: (rows: RecipeEntry[]) => void;
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

/** Radix-Select: leere Auswahl ist immer "__none__", nie ein leerer String. */
const NO_LOT = "__none__";

/**
 * Einheitliche Spaltendefinition für Kopfzeile und Datenzeilen.
 * Feste Breiten für Drag-Handle, Bestandsstatus und Löschaktion, damit sich
 * die Spalten nicht verschieben, wenn ein Bestands-Badge ein- oder ausgeblendet wird.
 */
const GRID =
  "grid grid-cols-[24px_minmax(160px,2fr)_minmax(150px,1.4fr)_90px_64px_minmax(110px,1fr)_150px_32px] items-center gap-2 px-1";

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
      className={GRID}
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

/** Lesbare Bezeichnung eines Gebindes für die Lot-Auswahl. */
function containerLabel(c: any): string {
  const lot = c.raw_material_batches?.batch_number ?? null;
  const avail = Number(c.current_quantity ?? 0) - Number(c.reserved_quantity ?? 0);
  const parts = [
    lot ? `Lot ${lot}` : (c.container_name || c.container_code || "Gebinde"),
    c.container_code || null,
    `verf.: ${formatQuantity(avail)} ${c.unit ?? ""}`.trim(),
  ];
  return parts.filter(Boolean).join(" · ");
}

/**
 * Rezeptur / Rohstoffliste (Auftraggeber) mit Zugabefolge.
 * Es werden ausschließlich bestehende Rohstoffe der Rohstoffverwaltung
 * ausgewählt (Referenz auf `raw_materials.id`); Stammdaten werden hier nie
 * verändert oder neu angelegt. Die Reihenfolge der Positionen ist Teil des
 * gespeicherten Werts (Array-Reihenfolge). Abschnittswechsel markieren
 * Teilprozessschritte mit eigener Zugabezeit. Optional kann pro Zeile ein
 * vorhandenes Gebinde (Lotnummer) zugeordnet werden – als Snapshot, ohne
 * Reservierung oder Bestandsbuchung.
 */
export default function RawMaterialRecipeField({ value, onChange, readonly }: Props) {
  const entries: RecipeEntry[] = Array.isArray(value) ? value : [];
  const sections = useMemo(() => groupRecipeSections(entries), [entries]);

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

  /** Wählbare Gebinde je Rohstoff (Status- und Archivierungsregeln der Gebindeverwaltung). */
  const containersByMaterial = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of containers as any[]) {
      if (c.status === "entsorgt" || c.status === "gesperrt") continue;
      const list = m.get(c.raw_material_id) ?? [];
      list.push(c);
      m.set(c.raw_material_id, list);
    }
    return m;
  }, [containers]);

  const containerById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of containers as any[]) m.set(c.id, c);
    return m;
  }, [containers]);

  /** Gesamtverfügbarkeit je Rohstoff in der Gebinde-/Stammdateneinheit. */
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
    onChange(entries.map((r, i) => (i === idx ? { ...(r as RecipeRow), ...patch } : r)));
  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx));
  const addRow = (sectionIdx: number) => onChange(appendRowToSection(entries, sectionIdx));
  const addSection = () => onChange(appendSection(entries, ""));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const rowId = (index: number) => `recipe-row-${index}`;
  const sortableIds = entries.map((e, i) => (isSectionEntry(e) ? `recipe-section-${i}` : rowId(i)));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sortableIds.indexOf(String(active.id));
    const to = sortableIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(entries, from, to));
  };

  interface Shortage {
    name: string;
    required: number;
    available: number;
    unit: string;
    container?: boolean;
  }

  /**
   * Fehlmengen in der Eingabeeinheit der jeweiligen Zeile. Der Vergleich
   * selbst läuft über `compareStock` in der Bestandseinheit; inkompatible
   * Einheiten lösen keinen Alarm aus.
   */
  const shortages = useMemo(() => {
    const list: Shortage[] = [];
    for (const e of entries) {
      if (isSectionEntry(e)) continue;
      const r = e as RecipeRow;
      if (!r.raw_material_id) continue;
      const req = Number(r.quantity);
      if (!isFinite(req) || req <= 0) continue;
      const mat = materialById.get(r.raw_material_id);
      const entryUnit = r.unit || mat?.unit || "";
      const stockUnit = mat?.unit || entryUnit;
      const name = mat?.material_name ?? "Unbekannt";

      // Prüfung 1: Gesamtbestand des Rohstoffs (wie bisher, jetzt einheitenbereinigt).
      const total = compareStock(req, entryUnit, availableByMaterial.get(r.raw_material_id) ?? 0, stockUnit);
      if (total?.short) {
        list.push({ name, required: req, available: convertQuantity(total.available, total.unit, entryUnit) ?? total.available, unit: entryUnit });
      }

      // Prüfung 2: ausgewähltes Gebinde (zusätzlich, unabhängig vom Gesamtbestand).
      if (r.container_id) {
        const c = containerById.get(r.container_id);
        if (c) {
          const cAvail = Number(c.current_quantity ?? 0) - Number(c.reserved_quantity ?? 0);
          const cc = compareStock(req, entryUnit, cAvail, c.unit ?? stockUnit);
          if (cc?.short) {
            list.push({
              name: `${name} (Lot ${r.lot_number ?? c.raw_material_batches?.batch_number ?? "?"})`,
              required: req,
              available: convertQuantity(cc.available, cc.unit, entryUnit) ?? cc.available,
              unit: entryUnit,
              container: true,
            });
          }
        }
        // Gebinde nicht mehr auffindbar (archiviert/gelöscht): Snapshot bleibt, kein Alarm.
      }
    }
    return list;
  }, [entries, availableByMaterial, materialById, containerById]);

  const renderRow = (index: number, row: RecipeRow) => {
    const mat = materialById.get(row.raw_material_id);
    const req = Number(row.quantity);
    const entryUnit = row.unit || mat?.unit || "";
    const stockUnit = mat?.unit || entryUnit;
    const hasReq = !!row.raw_material_id && isFinite(req) && req > 0;

    // Gesamtbestand in der Eingabeeinheit anzeigen (Fallback: Bestandseinheit).
    const totalAvail = availableByMaterial.get(row.raw_material_id) ?? 0;
    const totalCmp = hasReq ? compareStock(req, entryUnit, totalAvail, stockUnit) : null;
    const totalShort = !!totalCmp?.short;
    const availDisplay = convertQuantity(totalAvail, stockUnit, entryUnit);
    const availText = availDisplay !== null ? `${formatQuantity(availDisplay)} ${entryUnit}` : `${formatQuantity(totalAvail)} ${stockUnit}`;

    // Gebinde-Auswahl: nur Gebinde des gewählten Rohstoffs; gespeichertes,
    // inzwischen nicht mehr gelistetes Gebinde bleibt als Snapshot sichtbar.
    const lotOptions = row.raw_material_id ? containersByMaterial.get(row.raw_material_id) ?? [] : [];
    const selectedContainer = row.container_id ? containerById.get(row.container_id) : null;
    const snapshotMissing = !!row.container_id && !lotOptions.some((c) => c.id === row.container_id);

    // Zusatzprüfung Gebindebestand.
    let containerShort = false;
    if (hasReq && selectedContainer) {
      const cAvail = Number(selectedContainer.current_quantity ?? 0) - Number(selectedContainer.reserved_quantity ?? 0);
      containerShort = !!compareStock(req, entryUnit, cAvail, selectedContainer.unit ?? stockUnit)?.short;
    }

    return (
      <SortableRow key={rowId(index)} id={rowId(index)} disabled={readonly}>
        <MaterialPicker
          options={options}
          valueId={row.raw_material_id}
          disabled={readonly}
          onSelect={(v) => {
            const chosen = options.find((o) => o.id === v);
            const materialChanged = v !== row.raw_material_id;
            update(index, {
              raw_material_id: v,
              // Feststoffe (kg) standardmäßig in g; Flüssigkeiten behalten ihre Einheit.
              unit: row.unit || defaultRecipeUnit(chosen?.unit),
              // Bei Rohstoffwechsel passt eine alte Gebindezuordnung nicht mehr.
              ...(materialChanged ? { container_id: null, lot_number: null } : {}),
            });
          }}
        />
        <Select
          value={row.container_id ?? NO_LOT}
          disabled={readonly || !row.raw_material_id}
          onValueChange={(v) => {
            if (v === NO_LOT) {
              update(index, { container_id: null, lot_number: null });
              return;
            }
            const c = lotOptions.find((x) => x.id === v);
            update(index, {
              container_id: v,
              lot_number: c?.raw_material_batches?.batch_number ?? null,
            });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Keine bestimmte Lot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_LOT}>Keine bestimmte Lot</SelectItem>
            {lotOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {containerLabel(c)}
              </SelectItem>
            ))}
            {snapshotMissing && (
              <SelectItem value={row.container_id as string} disabled>
                Lot {row.lot_number ?? "unbekannt"} (nicht mehr verfügbar)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="any"
          value={row.quantity ?? ""}
          onChange={(e) => update(index, { quantity: e.target.value })}
          disabled={readonly}
          className="h-8"
        />
        <Input
          value={row.unit ?? ""}
          onChange={(e) => update(index, { unit: e.target.value })}
          disabled={readonly}
          className="h-8"
          placeholder={defaultRecipeUnit(mat?.unit) || "kg"}
        />
        <Input
          value={row.note ?? ""}
          onChange={(e) => update(index, { note: e.target.value })}
          disabled={readonly}
          className="h-8"
          placeholder="optional"
        />
        {/* Feste Spalte: Badge-Fläche bleibt auch leer erhalten, damit sich nichts verschiebt. */}
        <div className="flex items-center gap-1">
          {hasReq && (
            <Badge variant={totalShort ? "destructive" : "secondary"} className="text-[10px]">
              {totalShort ? <AlertTriangle className="mr-0.5 h-3 w-3" /> : <CheckCircle2 className="mr-0.5 h-3 w-3" />}
              {availText}
            </Badge>
          )}
          {hasReq && containerShort && (
            <Badge variant="destructive" className="text-[10px]" title="Der Bestand des gewählten Gebindes reicht nicht aus">
              <AlertTriangle className="mr-0.5 h-3 w-3" />
              Gebinde zu klein
            </Badge>
          )}
        </div>
        <div>
          {!readonly && (
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(index)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </SortableRow>
    );
  };

  const isEmpty = entries.length === 0;

  return (
    <div className="space-y-3 rounded-md border p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Rezeptur / Zugabefolge</span>
        {!readonly && (
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => addRow(Math.max(sections.length - 1, 0))} className="h-7">
              <Plus className="mr-1 h-3 w-3" /> Rohstoff hinzufügen
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={addSection} className="h-7">
              <SeparatorHorizontal className="mr-1 h-3 w-3" /> Abschnittswechsel
            </Button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <p className="py-2 text-xs text-muted-foreground">Noch keine Rohstoffe hinzugefügt.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {sections.map((section, sIdx) => (
                <section key={section.markerIndex >= 0 ? `sec-${section.markerIndex}` : "sec-implicit"} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 border-l-2 border-primary/60 pl-2">
                    <span className="text-xs font-semibold">{sectionTitle(section, sIdx)}</span>
                    <span className="text-[11px] text-muted-foreground">Zugabezeit</span>
                    <Input
                      type="number"
                      step="any"
                      className="h-7 w-20"
                      placeholder="0"
                      value={section.offset_minutes ?? ""}
                      disabled={readonly || section.markerIndex < 0}
                      onChange={(e) =>
                        onChange(updateSectionMarker(entries, section.markerIndex, { offset_minutes: e.target.value }))
                      }
                    />
                    <span className="text-[11px] text-muted-foreground">min</span>
                    {!readonly && section.markerIndex >= 0 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label="Abschnittswechsel entfernen"
                        onClick={() => onChange(removeSectionMarker(entries, section.markerIndex))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {section.rows.length === 0 ? (
                    <p className="pl-2 text-xs text-muted-foreground">Noch keine Rohstoffe in diesem Abschnitt.</p>
                  ) : (
                    <div className="space-y-1">
                      {/* Kopfzeile: identische Grid-Definition und Abstände wie die Datenzeilen. */}
                      <div className={`${GRID} text-[10px] uppercase text-muted-foreground`}>
                        <div>#</div>
                        <div>Rohstoff</div>
                        <div>Lot / Gebinde</div>
                        <div>Sollmenge</div>
                        <div>Einheit</div>
                        <div>Bemerkung</div>
                        <div>Bestand</div>
                        <div />
                      </div>
                      {section.rows.map(({ index, row }) => renderRow(index, row))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
                  {s.container && " (gewähltes Gebinde)"}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
