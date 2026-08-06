import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import {
  MASTER_DATA_ATTRIBUTE_TYPES,
  type GlobalList,
  type GlobalListItem,
  type GlobalListAttribute,
  type MasterDataAttributeType,
} from "@/lib/api/globalLibrary";

const slug = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

type AttrDraft = {
  id?: string;
  attribute_key: string;
  display_name: string;
  data_type: MasterDataAttributeType;
  unit: string;
  options: string;
  is_required: boolean;
  show_in_table: boolean;
  description: string;
  sort_order: number;
};

const emptyAttr: AttrDraft = {
  attribute_key: "", display_name: "", data_type: "text", unit: "", options: "",
  is_required: false, show_in_table: true, description: "", sort_order: 0,
};

function AttributeValueInput({
  attr, value, onChange,
}: { attr: GlobalListAttribute; value: unknown; onChange: (v: unknown) => void }) {
  if (attr.data_type === "boolean") {
    return (
      <div className="flex h-10 items-center">
        <Switch checked={!!value} onCheckedChange={(c) => onChange(c)} />
      </div>
    );
  }
  if (attr.data_type === "select") {
    return (
      <Select value={(value as string) || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">– keine Angabe –</SelectItem>
          {(attr.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (attr.data_type === "longtext") {
    return <Textarea rows={2} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <Input
      type={attr.data_type === "number" ? "number" : attr.data_type === "date" ? "date" : "text"}
      value={(value as string | number) ?? ""}
      onChange={(e) => onChange(attr.data_type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
    />
  );
}

function formatValue(attr: GlobalListAttribute, v: unknown) {
  if (v === null || v === undefined || v === "") return "–";
  if (attr.data_type === "boolean") return v ? "Ja" : "Nein";
  return `${v}${attr.unit ? ` ${attr.unit}` : ""}`;
}

export default function MasterDataSection() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [listOpen, setListOpen] = useState(false);
  const [listDraft, setListDraft] = useState<{ id?: string; list_key: string; display_name: string; description: string; category: string }>(
    { list_key: "", display_name: "", description: "", category: "" }
  );

  const [attrOpen, setAttrOpen] = useState(false);
  const [attrDraft, setAttrDraft] = useState<AttrDraft>(emptyAttr);

  const [itemOpen, setItemOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<{
    id?: string; item_value: string; label: string; description: string; sort_order: number;
    is_active: boolean; metadata: Record<string, unknown>;
  }>({ item_value: "", label: "", description: "", sort_order: 0, is_active: true, metadata: {} });

  const { data: lists = [] } = useQuery({ queryKey: ["global-lists"], queryFn: () => api.globalLists.list() });
  const selected = lists.find((l: GlobalList) => l.id === selectedId) ?? null;

  const { data: attributes = [] } = useQuery({
    queryKey: ["master-data-attributes", selectedId],
    queryFn: () => api.globalListAttributes.list(selectedId!),
    enabled: !!selectedId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["global-list-items", selectedId],
    queryFn: () => api.globalListItems.list(selectedId!),
    enabled: !!selectedId,
  });

  const tableAttrs = useMemo(() => attributes.filter((a) => a.show_in_table).slice(0, 6), [attributes]);

  const invalidateCatalog = () => qc.invalidateQueries({ queryKey: ["master-data-catalog"] });

  const saveList = useMutation({
    mutationFn: async () => {
      const payload = {
        list_key: listDraft.list_key || slug(listDraft.display_name),
        display_name: listDraft.display_name.trim(),
        description: listDraft.description.trim() || null,
        category: listDraft.category.trim() || null,
      };
      if (!payload.display_name) throw new Error("Bezeichnung erforderlich");
      if (listDraft.id) {
        const { list_key: _k, ...rest } = payload;
        await api.globalLists.update(listDraft.id, rest);
      } else {
        const created = await api.globalLists.create(payload);
        setSelectedId(created.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-lists"] });
      invalidateCatalog();
      setListOpen(false);
      toast.success("Stammdaten-Kategorie gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const archiveList = useMutation({
    mutationFn: (id: string) => api.globalLists.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-lists"] });
      invalidateCatalog();
      setSelectedId(null);
      toast.success("Kategorie archiviert");
    },
  });

  const saveAttr = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Keine Kategorie ausgewählt");
      const payload = {
        list_id: selectedId,
        attribute_key: attrDraft.attribute_key || slug(attrDraft.display_name),
        display_name: attrDraft.display_name.trim(),
        data_type: attrDraft.data_type,
        unit: attrDraft.unit.trim() || null,
        options: attrDraft.options.split(",").map((s) => s.trim()).filter(Boolean),
        is_required: attrDraft.is_required,
        show_in_table: attrDraft.show_in_table,
        description: attrDraft.description.trim() || null,
        sort_order: attrDraft.sort_order,
      };
      if (!payload.display_name) throw new Error("Bezeichnung erforderlich");
      if (attrDraft.id) {
        const { list_id: _l, attribute_key: _k, ...rest } = payload;
        await api.globalListAttributes.update(attrDraft.id, rest as any);
      } else {
        await api.globalListAttributes.create(payload as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master-data-attributes", selectedId] });
      invalidateCatalog();
      setAttrOpen(false);
      toast.success("Eigenschaft gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const removeAttr = useMutation({
    mutationFn: (id: string) => api.globalListAttributes.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master-data-attributes", selectedId] });
      invalidateCatalog();
    },
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Keine Kategorie ausgewählt");
      for (const a of attributes) {
        if (a.is_required) {
          const v = itemDraft.metadata[a.attribute_key];
          if (v === undefined || v === null || v === "") throw new Error(`Pflichtfeld fehlt: ${a.display_name}`);
        }
      }
      const payload = {
        list_id: selectedId,
        item_value: itemDraft.item_value || slug(itemDraft.label),
        label: itemDraft.label.trim(),
        description: itemDraft.description.trim() || null,
        sort_order: itemDraft.sort_order,
        is_active: itemDraft.is_active,
        metadata: itemDraft.metadata,
      };
      if (!payload.label) throw new Error("Bezeichnung erforderlich");
      if (itemDraft.id) {
        const { list_id: _l, ...rest } = payload;
        await api.globalListItems.update(itemDraft.id, rest as any);
      } else {
        await api.globalListItems.create(payload as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-list-items", selectedId] });
      invalidateCatalog();
      setItemOpen(false);
      toast.success("Stammdatensatz gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api.globalListItems.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-list-items", selectedId] });
      invalidateCatalog();
    },
  });

  const openNewItem = () => setItemDraft({
    item_value: "", label: "", description: "", sort_order: items.length, is_active: true, metadata: {},
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-sm">Kategorien</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setListDraft({ list_key: "", display_name: "", description: "", category: "" }); setListOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 pb-3">
          {lists.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Stammdaten angelegt.</p>}
          {lists.map((l: GlobalList) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm ${selectedId === l.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}
            >
              {l.display_name}
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">{l.list_key}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!selected ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Kategorie auswählen oder neu anlegen (z.B. Mundstücke, Messgeräte, Lieferanten).
          </CardContent></Card>
        ) : (
          <Tabs defaultValue="entries" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="entries">Stammdatensätze</TabsTrigger>
                <TabsTrigger value="schema">Eigenschaften</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setListDraft({ id: selected.id, list_key: selected.list_key, display_name: selected.display_name, description: selected.description ?? "", category: selected.category ?? "" })
                  || setListOpen(true)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />Kategorie bearbeiten
                </Button>
                <Button size="sm" variant="outline" onClick={() => archiveList.mutate(selected.id)}>Archivieren</Button>
              </div>
            </div>

            <TabsContent value="entries">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
                  <CardTitle className="text-sm">{selected.display_name}</CardTitle>
                  <Button size="sm" onClick={() => { openNewItem(); setItemOpen(true); }}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Neuer Eintrag
                  </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bezeichnung</TableHead>
                        {tableAttrs.map((a) => (
                          <TableHead key={a.id}>{a.display_name}{a.unit ? ` (${a.unit})` : ""}</TableHead>
                        ))}
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 && (
                        <TableRow><TableCell colSpan={tableAttrs.length + 3} className="text-center text-sm text-muted-foreground">Keine Einträge.</TableCell></TableRow>
                      )}
                      {items.map((it: GlobalListItem) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            {it.label}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{it.item_value}</span>
                          </TableCell>
                          {tableAttrs.map((a) => (
                            <TableCell key={a.id} className="text-sm">{formatValue(a, (it.metadata ?? {})[a.attribute_key])}</TableCell>
                          ))}
                          <TableCell>
                            <Badge variant={it.is_active === false ? "outline" : "secondary"}>
                              {it.is_active === false ? "Inaktiv" : "Aktiv"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button size="icon" variant="ghost" onClick={() => {
                              setItemDraft({
                                id: it.id, item_value: it.item_value, label: it.label,
                                description: it.description ?? "", sort_order: it.sort_order,
                                is_active: it.is_active !== false, metadata: { ...(it.metadata ?? {}) },
                              });
                              setItemOpen(true);
                            }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => removeItem.mutate(it.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schema">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
                  <CardTitle className="text-sm">Eigenschaften von „{selected.display_name}“</CardTitle>
                  <Button size="sm" onClick={() => { setAttrDraft({ ...emptyAttr, sort_order: attributes.length }); setAttrOpen(true); }}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Eigenschaft
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Frei definierbar – ohne Programmierung. Jede Eigenschaft steht systemweit als Token zur Verfügung,
                    z.B. <code className="font-mono">{`{{${selected.list_key}.schlitzbreite}}`}</code>.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bezeichnung</TableHead>
                        <TableHead>Schlüssel / Token</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Einheit</TableHead>
                        <TableHead>Pflicht</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attributes.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Noch keine Eigenschaften definiert.</TableCell></TableRow>
                      )}
                      {attributes.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.display_name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            <button
                              className="hover:text-primary"
                              title="Token kopieren"
                              onClick={() => {
                                navigator.clipboard?.writeText(`{{${selected.list_key}.${a.attribute_key}}}`);
                                toast.success("Token kopiert");
                              }}
                            >
                              {`{{${selected.list_key}.${a.attribute_key}}}`} <Copy className="inline h-3 w-3" />
                            </button>
                          </TableCell>
                          <TableCell className="text-xs">{MASTER_DATA_ATTRIBUTE_TYPES.find((t) => t.value === a.data_type)?.label ?? a.data_type}</TableCell>
                          <TableCell className="text-xs">{a.unit ?? "–"}</TableCell>
                          <TableCell className="text-xs">{a.is_required ? "Ja" : "Nein"}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button size="icon" variant="ghost" onClick={() => {
                              setAttrDraft({
                                id: a.id, attribute_key: a.attribute_key, display_name: a.display_name,
                                data_type: a.data_type, unit: a.unit ?? "", options: (a.options ?? []).join(", "),
                                is_required: a.is_required, show_in_table: a.show_in_table,
                                description: a.description ?? "", sort_order: a.sort_order,
                              });
                              setAttrOpen(true);
                            }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => removeAttr.mutate(a.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Kategorie-Dialog */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{listDraft.id ? "Kategorie bearbeiten" : "Neue Stammdaten-Kategorie"}</DialogTitle>
            <DialogDescription>Zentrale Datenquelle für Formulare, Workflows, Berichte und Berechnungen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Bezeichnung</Label><Input value={listDraft.display_name} onChange={(e) => setListDraft((d) => ({ ...d, display_name: e.target.value }))} placeholder="z.B. Mundstücke" /></div>
            <div>
              <Label>Schlüssel</Label>
              <Input value={listDraft.list_key} disabled={!!listDraft.id} onChange={(e) => setListDraft((d) => ({ ...d, list_key: slug(e.target.value) }))} placeholder={slug(listDraft.display_name) || "mundstuecke"} />
            </div>
            <div><Label>Kategorie</Label><Input value={listDraft.category} onChange={(e) => setListDraft((d) => ({ ...d, category: e.target.value }))} /></div>
            <div><Label>Beschreibung</Label><Textarea rows={2} value={listDraft.description} onChange={(e) => setListDraft((d) => ({ ...d, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListOpen(false)}>Abbrechen</Button>
            <Button disabled={saveList.isPending} onClick={() => saveList.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attribut-Dialog */}
      <Dialog open={attrOpen} onOpenChange={setAttrOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{attrDraft.id ? "Eigenschaft bearbeiten" : "Neue Eigenschaft"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bezeichnung</Label><Input value={attrDraft.display_name} onChange={(e) => setAttrDraft((d) => ({ ...d, display_name: e.target.value }))} placeholder="z.B. Schlitzbreite" /></div>
            <div>
              <Label>Schlüssel</Label>
              <Input value={attrDraft.attribute_key} disabled={!!attrDraft.id} onChange={(e) => setAttrDraft((d) => ({ ...d, attribute_key: slug(e.target.value) }))} placeholder={slug(attrDraft.display_name) || "schlitzbreite"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={attrDraft.data_type} onValueChange={(v) => setAttrDraft((d) => ({ ...d, data_type: v as MasterDataAttributeType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MASTER_DATA_ATTRIBUTE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Einheit</Label><Input value={attrDraft.unit} onChange={(e) => setAttrDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="mm, cpsi, …" /></div>
            </div>
            {attrDraft.data_type === "select" && (
              <div><Label>Auswahloptionen (Komma-getrennt)</Label><Input value={attrDraft.options} onChange={(e) => setAttrDraft((d) => ({ ...d, options: e.target.value }))} placeholder="rund, quadratisch, wabenförmig" /></div>
            )}
            <div><Label>Hilfetext</Label><Input value={attrDraft.description} onChange={(e) => setAttrDraft((d) => ({ ...d, description: e.target.value }))} /></div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={attrDraft.is_required} onCheckedChange={(c) => setAttrDraft((d) => ({ ...d, is_required: c }))} />
                Pflichtfeld
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={attrDraft.show_in_table} onCheckedChange={(c) => setAttrDraft((d) => ({ ...d, show_in_table: c }))} />
                In Übersicht anzeigen
              </label>
            </div>
            <div><Label>Reihenfolge</Label><Input type="number" value={attrDraft.sort_order} onChange={(e) => setAttrDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttrOpen(false)}>Abbrechen</Button>
            <Button disabled={saveAttr.isPending} onClick={() => saveAttr.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eintrags-Dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{itemDraft.id ? "Stammdatensatz bearbeiten" : "Neuer Stammdatensatz"}</DialogTitle>
            {selected && <DialogDescription>{selected.display_name}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Bezeichnung</Label><Input value={itemDraft.label} onChange={(e) => setItemDraft((d) => ({ ...d, label: e.target.value }))} /></div>
            <div><Label>Wert / Schlüssel</Label><Input value={itemDraft.item_value} onChange={(e) => setItemDraft((d) => ({ ...d, item_value: e.target.value }))} placeholder={slug(itemDraft.label)} /></div>
            {attributes.map((a) => (
              <div key={a.id}>
                <Label>
                  {a.display_name}{a.unit ? ` (${a.unit})` : ""}{a.is_required && <span className="text-destructive"> *</span>}
                </Label>
                <AttributeValueInput
                  attr={a}
                  value={itemDraft.metadata[a.attribute_key]}
                  onChange={(v) => setItemDraft((d) => ({ ...d, metadata: { ...d.metadata, [a.attribute_key]: v } }))}
                />
                {a.description && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}
              </div>
            ))}
            <div><Label>Bemerkung</Label><Textarea rows={2} value={itemDraft.description} onChange={(e) => setItemDraft((d) => ({ ...d, description: e.target.value }))} /></div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={itemDraft.is_active} onCheckedChange={(c) => setItemDraft((d) => ({ ...d, is_active: c }))} />
                Aktiv
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Reihenfolge</Label>
                <Input className="w-24" type="number" value={itemDraft.sort_order} onChange={(e) => setItemDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>Abbrechen</Button>
            <Button disabled={saveItem.isPending} onClick={() => saveItem.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
