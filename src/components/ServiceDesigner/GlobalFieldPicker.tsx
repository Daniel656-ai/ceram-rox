import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Boxes, Minus, Plus as PlusIcon } from "lucide-react";
import {
  GLOBAL_FIELD_TYPES,
  bindingPathFor,
  readGlobalRepeaterMeta,
  readGlobalRepeaterSubfields,
  globalTypeToFormFieldType,
  type GlobalField,
  type GlobalObject,
} from "@/lib/api/globalModel";
import type { FormField } from "@/lib/api/formFields";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  formId: string;
  /** Bereits im Formular vorhandene Felder (zur Duplikatserkennung). */
  existing: FormField[];
  onInserted: () => void;
}

/**
 * Phase 2: Felder werden aus der globalen Feldbibliothek referenziert.
 * Das Formular speichert nur noch Position/Sichtbarkeit/Pflicht — die
 * Felddefinition bleibt im globalen Feld.
 */
export default function GlobalFieldPicker({ open, onOpenChange, formId, existing, onInserted }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [objectId, setObjectId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});

  const { data: objects = [] } = useQuery({
    queryKey: ["global-objects"],
    queryFn: () => api.globalObjects.list(),
    enabled: open,
  });

  const { data: allFields = [] } = useQuery({
    queryKey: ["global-fields", "all"],
    queryFn: () => api.globalFields.list(),
    enabled: open,
  });

  // Stammdaten liefern die Auswahlwerte zentral – Formulare erben sie beim Einfügen.
  const { data: lists = [] } = useQuery({
    queryKey: ["global-lists"],
    queryFn: () => api.globalLists.list(),
    enabled: open,
  });

  const objectById = useMemo(
    () => Object.fromEntries(objects.map((o: GlobalObject) => [o.id, o])),
    [objects]
  );

  const usageCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of existing) {
      if (!f.global_field_id) continue;
      m.set(f.global_field_id, (m.get(f.global_field_id) ?? 0) + 1);
    }
    return m;
  }, [existing]);

  /** Bereits vergebene technische Keys im Formular (UNIQUE form_id+field_key). */
  const takenKeys = useMemo(() => new Set(existing.map((f) => f.field_key)), [existing]);


  const q = search.trim().toLowerCase();
  const visible = allFields.filter((f: GlobalField) => {
    if (objectId && f.object_id !== objectId) return false;
    if (!q) return true;
    const obj = objectById[f.object_id];
    return (
      f.display_name.toLowerCase().includes(q) ||
      f.field_key.toLowerCase().includes(q) ||
      (obj?.display_name ?? "").toLowerCase().includes(q)
    );
  });

  const grouped = useMemo(() => {
    const map = new Map<string, GlobalField[]>();
    for (const f of visible) {
      const list = map.get(f.object_id) ?? [];
      list.push(f);
      map.set(f.object_id, list);
    }
    return [...map.entries()].sort(
      (a, b) => (objectById[a[0]]?.sort_order ?? 0) - (objectById[b[0]]?.sort_order ?? 0)
    );
  }, [visible, objectById]);

  const insertMut = useMutation({
    mutationFn: async () => {
      // Wiederholbare Felder können in einem Schritt mehrfach eingefügt werden.
      const ids = Object.entries(selected)
        .filter(([, n]) => (n ?? 0) > 0)
        .flatMap(([k, n]) => Array.from({ length: n }, () => k));
      if (ids.length === 0) throw new Error("Keine Felder ausgewählt");
      let sort = (existing.at(-1)?.sort_order ?? -1) + 1;
      const usedKeys = new Set(takenKeys);
      const runningUsage = new Map(usageCount);
      for (const id of ids) {
        const gf = allFields.find((f) => f.id === id);
        if (!gf) continue;
        const obj = objectById[gf.object_id];
        // Auswahlwerte aus der globalen Liste übernehmen (falls verknüpft)
        let options = gf.select_options as any;
        if (gf.list_id && lists.some((l) => l.id === gf.list_id)) {
          const items = await api.globalListItems.list(gf.list_id);
          options = items.map((i) => ({ label: i.label, value: i.item_value }));
        }
        const isRepeater = gf.data_type === "repeater";

        // Mehrfachverwendung: eindeutiger technischer Key je Verwendung,
        // die globale Definition (global_field_id / binding_path) bleibt identisch.
        const usageIndex = (runningUsage.get(gf.id) ?? 0) + 1;
        runningUsage.set(gf.id, usageIndex);

        let fieldKey = gf.field_key;
        if (usedKeys.has(fieldKey)) {
          let n = Math.max(usageIndex, 2);
          while (usedKeys.has(`${gf.field_key}_${n}`)) n++;
          fieldKey = `${gf.field_key}_${n}`;
        }
        usedKeys.add(fieldKey);
        const displayName =
          usageIndex > 1 ? `${gf.display_name} (Verwendung ${usageIndex})` : gf.display_name;

        const created = await api.formFields.create({
          form_id: formId,
          field_key: fieldKey,
          display_name: displayName,
          field_type: globalTypeToFormFieldType(gf.data_type) as any,
          description: gf.description,
          unit: gf.unit,
          default_value: gf.default_value,
          category: gf.category,
          select_options: options,
          sort_order: sort++,
          global_field_id: gf.id,
          binding_path: obj ? bindingPathFor(obj.object_key, gf.field_key) : gf.field_key,
          metadata: {
            global_list_id: gf.list_id ?? null,
            global_calculation_id: gf.calculation_id ?? null,
            validation_ids: gf.validation_ids ?? [],
            is_repeatable: isRepeater ? true : !!gf.is_repeatable,
            usage_index: usageIndex,
            ...(isRepeater
              ? {
                  repeater: {
                    ...readGlobalRepeaterMeta(gf),
                    storage_key: readGlobalRepeaterMeta(gf).storage_key || fieldKey,
                  },
                }
              : {}),
          },
        } as any);


        // Repeater: Unterfelder aus der globalen Definition übernehmen.
        if (isRepeater) {
          const subs = readGlobalRepeaterSubfields(gf);
          let subSort = 0;
          for (const s of subs) {
            let subKey = s.field_key;
            if (usedKeys.has(subKey)) {
              let n = 2;
              while (usedKeys.has(`${s.field_key}_${n}`)) n++;
              subKey = `${s.field_key}_${n}`;
            }
            usedKeys.add(subKey);
            await api.formFields.create({
              form_id: formId,
              field_key: subKey,
              display_name: s.display_name,
              field_type: globalTypeToFormFieldType(s.data_type) as any,
              unit: s.unit ?? null,
              is_required: !!s.is_required,
              select_options: (s.select_options ?? []) as any,
              parent_field_id: created.id,
              sort_order: subSort++,
            } as any);
          }

        }

      }
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["form-fields", formId] });
      onInserted();
      setSelected({});
      onOpenChange(false);
      toast.success(`${n} globale${n === 1 ? "s Feld" : " Felder"} eingefügt`);
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Einfügen"),
  });

  const selectedCount = Object.values(selected).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Globale Feldbibliothek
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <div className="space-y-1">
            <button
              onClick={() => setObjectId(null)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm ${!objectId ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
            >
              Alle Objekte
            </button>
            <ScrollArea className="h-72 pr-2">
              {objects.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setObjectId(o.id)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm ${objectId === o.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                >
                  {o.display_name}
                </button>
              ))}
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Globales Feld suchen…"
                className="h-8 pl-7 text-sm"
              />
            </div>
            <ScrollArea className="h-72 rounded border">
              {grouped.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Keine globalen Felder gefunden. Lege sie unter „Globale Objekte &amp; Felder" an.
                </p>
              )}
              {grouped.map(([objId, list]) => (
                <div key={objId}>
                  <div className="sticky top-0 bg-muted/70 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {objectById[objId]?.display_name ?? "Unbekannt"}
                  </div>
                  {list.map((f) => {
                    const uses = usageCount.get(f.id) ?? 0;
                    const repeatable = !!f.is_repeatable || f.data_type === "repeater";
                    // Wiederholbare Felder dürfen mehrfach eingefügt werden.
                    const blocked = uses > 0 && !repeatable;
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2 border-b px-2 py-1.5 text-sm ${blocked ? "opacity-50" : "cursor-pointer hover:bg-muted/40"}`}
                      >
                        <Checkbox
                          checked={(selected[f.id] ?? 0) > 0}
                          disabled={blocked}
                          onCheckedChange={(c) => setSelected((s) => ({ ...s, [f.id]: c ? 1 : 0 }))}
                        />
                        <span className="flex-1 truncate">
                          {f.display_name}
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                            {objectById[f.object_id]?.object_key}.{f.field_key}
                          </span>
                        </span>
                        {f.unit && <Badge variant="outline" className="text-[10px]">{f.unit}</Badge>}
                        <Badge variant="outline" className="text-[10px]">
                          {GLOBAL_FIELD_TYPES.find((t) => t.value === f.data_type)?.label ?? f.data_type}
                        </Badge>
                        {repeatable && (
                          <>
                            <Badge variant="outline" className="text-[10px]">wiederholbar</Badge>
                            {(selected[f.id] ?? 0) > 0 && (
                              <span
                                className="flex items-center gap-1"
                                onClick={(e) => e.preventDefault()}
                              >
                                <Button
                                  type="button" size="icon" variant="outline" className="h-6 w-6"
                                  onClick={() => setSelected((s) => ({ ...s, [f.id]: Math.max(1, (s[f.id] ?? 1) - 1) }))}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-5 text-center text-xs tabular-nums">{selected[f.id]}×</span>
                                <Button
                                  type="button" size="icon" variant="outline" className="h-6 w-6"
                                  onClick={() => setSelected((s) => ({ ...s, [f.id]: (s[f.id] ?? 1) + 1 }))}
                                >
                                  <PlusIcon className="h-3 w-3" />
                                </Button>
                              </span>
                            )}
                          </>
                        )}
                        {uses > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {repeatable ? `${uses}× im Formular` : "im Formular"}
                          </Badge>
                        )}
                      </label>
                    );
                  })}

                </div>
              ))}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button disabled={selectedCount === 0 || insertMut.isPending} onClick={() => insertMut.mutate()}>
            {selectedCount > 0 ? `${selectedCount} Feld(er) einfügen` : "Einfügen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
