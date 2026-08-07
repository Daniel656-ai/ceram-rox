import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Boxes, Pencil, Archive, Search, Lock } from "lucide-react";
import {
  GLOBAL_FIELD_SOURCES,
  GLOBAL_FIELD_TYPES,
  readGlobalRepeaterMeta,
  readGlobalRepeaterSubfields,
  type GlobalRepeaterMeta,
  type GlobalRepeaterSubfield,
  type GlobalField,
  type GlobalObject,
} from "@/lib/api/globalModel";

const slug = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

type FieldDraft = {
  id?: string;
  object_id: string;
  field_key: string;
  display_name: string;
  description: string;
  data_type: string;
  category: string;
  unit: string;
  default_value: string;
  data_source: string;
  list_id: string | null;
  calculation_id: string | null;
  validation_ids: string[];
  is_repeatable: boolean;
  repeater: GlobalRepeaterMeta;
  subfields: GlobalRepeaterSubfield[];
};

const emptyField: FieldDraft = {
  object_id: "",
  field_key: "", display_name: "", description: "", data_type: "text",
  category: "", unit: "", default_value: "", data_source: "manual",
  list_id: null, calculation_id: null, validation_ids: [], is_repeatable: false,
  repeater: { min_entries: 0, item_label: "Eintrag", add_label: "Eintrag hinzufügen" },
  subfields: [],
};

const SUBFIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "longtext", label: "Mehrzeiliger Text" },
  { value: "number", label: "Zahl" },
  { value: "decimal", label: "Dezimalzahl" },
  { value: "percent", label: "Prozent" },
  { value: "date", label: "Datum" },
  { value: "time", label: "Uhrzeit" },
  { value: "datetime", label: "Datum & Uhrzeit" },
  { value: "boolean", label: "Ja/Nein (Checkbox)" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Mehrfachauswahl" },
  { value: "file", label: "Datei" },
  { value: "image", label: "Bild" },
];



const NONE = "__none__";
const ALL = "__all__";

/**
 * Phase 1 des zentralen Datenmodells: Verwaltung globaler Objekte und
 * globaler Felder. Rein ergänzend – bestehende Formulare bleiben unberührt.
 */
export default function GlobalModelTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>(ALL);

  const [objOpen, setObjOpen] = useState(false);
  const [objDraft, setObjDraft] = useState<{ id?: string; object_key: string; display_name: string; description: string; category: string }>(
    { object_key: "", display_name: "", description: "", category: "" }
  );
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>(emptyField);

  const { data: lists = [] } = useQuery({ queryKey: ["global-lists"], queryFn: () => api.globalLists.list() });
  const { data: calcs = [] } = useQuery({ queryKey: ["global-calculations"], queryFn: () => api.globalCalculations.list() });
  const { data: validations = [] } = useQuery({ queryKey: ["global-validations"], queryFn: () => api.globalValidations.list() });

  const { data: objects = [], isLoading } = useQuery({
    queryKey: ["global-objects"],
    queryFn: () => api.globalObjects.list(),
  });

  // "Alle Objekte" ist ein vollwertiger Modus – die Bibliothek ist auch ohne
  // ausgewähltes oder überhaupt vorhandenes Objekt nutzbar.
  const activeObject: GlobalObject | undefined = useMemo(
    () => (selectedId && selectedId !== ALL ? objects.find((o) => o.id === selectedId) : undefined),
    [objects, selectedId]
  );

  const { data: fields = [] } = useQuery({
    queryKey: ["global-fields", activeObject?.id ?? "all"],
    queryFn: () => api.globalFields.list(activeObject?.id ? { objectId: activeObject.id } : {}),
  });


  const invalidateObjects = () => qc.invalidateQueries({ queryKey: ["global-objects"] });
  const invalidateFields = () => qc.invalidateQueries({ queryKey: ["global-fields"] });

  const saveObject = useMutation({
    mutationFn: async () => {
      if (objDraft.id) {
        await api.globalObjects.update(objDraft.id, {
          display_name: objDraft.display_name,
          description: objDraft.description || null,
          category: objDraft.category || null,
        });
        return objDraft.id;
      }
      const created = await api.globalObjects.create({
        object_key: objDraft.object_key || slug(objDraft.display_name),
        display_name: objDraft.display_name,
        description: objDraft.description || null,
        category: objDraft.category || null,
        sort_order: (objects.at(-1)?.sort_order ?? 0) + 10,
      });
      return created.id;
    },
    onSuccess: (id) => {
      invalidateObjects();
      setSelectedId(id);
      setObjOpen(false);
      toast.success("Objekt gespeichert");
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const archiveObject = useMutation({
    mutationFn: (id: string) => api.globalObjects.archive(id),
    onSuccess: () => { invalidateObjects(); toast.success("Objekt archiviert"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const saveField = useMutation({
    mutationFn: async () => {
      const payload = {
        display_name: fieldDraft.display_name,
        description: fieldDraft.description || null,
        data_type: fieldDraft.data_type as any,
        category: fieldDraft.category || null,
        unit: fieldDraft.unit || null,
        default_value: fieldDraft.default_value || null,
        data_source: fieldDraft.data_source as any,
        list_id: fieldDraft.list_id,
        calculation_id: fieldDraft.calculation_id,
        validation_ids: fieldDraft.validation_ids,
        is_repeatable: fieldDraft.data_type === "repeater" ? true : fieldDraft.is_repeatable,
        metadata: (fieldDraft.data_type === "repeater"
          ? { repeater: fieldDraft.repeater, subfields: fieldDraft.subfields }
          : {}) as any,
      };
      if (fieldDraft.id) {
        const current = fields.find((f) => f.id === fieldDraft.id);
        await api.globalFields.update(fieldDraft.id, {
          ...payload,
          version: (current?.version ?? 1) + 1,
        });
      } else {
        const targetObjectId = fieldDraft.object_id || activeObject?.id || objects[0]?.id;
        if (!targetObjectId) throw new Error("Bitte zuerst ein globales Objekt anlegen.");
        await api.globalFields.create({
          object_id: targetObjectId,
          field_key: fieldDraft.field_key || slug(fieldDraft.display_name),
          sort_order: (fields.at(-1)?.sort_order ?? 0) + 10,
          ...payload,
        });
      }
    },
    onSuccess: () => { invalidateFields(); setFieldOpen(false); toast.success("Feld gespeichert"); },
    onError: (e: any) => toast.error(e.message || "Fehler beim Speichern"),
  });

  const archiveField = useMutation({
    mutationFn: (id: string) => api.globalFields.archive(id),
    onSuccess: () => { invalidateFields(); toast.success("Feld archiviert"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const objectName = (id: string) => objects.find((o) => o.id === id)?.display_name ?? "—";

  const categories = useMemo(
    () => Array.from(new Set(fields.map((f) => f.category).filter(Boolean) as string[])).sort(),
    [fields]
  );

  const visibleFields = fields.filter((f: GlobalField) => {
    if (catFilter !== ALL && (f.category ?? "") !== catFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      f.display_name.toLowerCase().includes(q) ||
      f.field_key.toLowerCase().includes(q) ||
      (f.category ?? "").toLowerCase().includes(q)
    );
  });

  const openNewField = () => {
    setFieldDraft({ ...emptyField, object_id: activeObject?.id ?? objects[0]?.id ?? "" });
    setFieldOpen(true);
  };


  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Globale Objekte
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Fachliche Objekte als Grundlage aller Formulare.
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading && <p className="text-xs text-muted-foreground">Lade…</p>}
          <button
            onClick={() => setSelectedId(ALL)}
            className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
              !activeObject ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
            }`}
          >
            Alle Objekte
            <span className="block text-[10px] text-muted-foreground">Gesamte Feldbibliothek</span>
          </button>
          {objects.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
                activeObject?.id === o.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">{o.display_name}</span>
                {o.is_system && <Lock className="h-3 w-3 shrink-0 opacity-50" />}
              </span>
              <span className="block font-mono text-[10px] text-muted-foreground">{o.object_key}</span>
            </button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => { setObjDraft({ object_key: "", display_name: "", description: "", category: "" }); setObjOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" /> Neues Objekt
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">
                Globale Felder{activeObject ? ` · ${activeObject.display_name}` : " · Alle Objekte"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Jedes Datenfeld existiert genau einmal. Die technische ID ist unveränderlich.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeObject && !activeObject.is_system && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setObjDraft({
                      id: activeObject.id, object_key: activeObject.object_key,
                      display_name: activeObject.display_name,
                      description: activeObject.description ?? "",
                      category: activeObject.category ?? "",
                    });
                    setObjOpen(true);
                  }}><Pencil className="h-4 w-4 mr-1" />Objekt</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm("Objekt archivieren?")) archiveObject.mutate(activeObject.id);
                  }}><Archive className="h-4 w-4" /></Button>
                </>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Feld suchen…"
                  className="h-8 w-48 pl-7 text-xs"
                />
              </div>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Kategorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Alle Kategorien</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Immer aktiv – die Verfügbarkeit hängt nur von der Berechtigung ab,
                  nie vom Datenbestand. */}
              <Button size="sm" onClick={openNewField}>
                <Plus className="h-4 w-4 mr-1" /> Neues Feld
              </Button>

            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anzeigename</TableHead>
                <TableHead>Technische ID</TableHead>
                <TableHead>Objekt</TableHead>
                <TableHead>Datentyp</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Einheit</TableHead>
                <TableHead>Datenquelle</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleFields.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center">
                    <p className="text-sm font-medium">Noch keine globalen Felder vorhanden.</p>
                    <p className="text-xs text-muted-foreground">Erstellen Sie Ihr erstes globales Feld.</p>
                    <Button size="sm" className="mt-3" onClick={openNewField}>
                      <Plus className="h-4 w-4 mr-1" /> Globales Feld erstellen
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {visibleFields.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.display_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{f.field_key}</TableCell>
                  <TableCell className="text-xs">{objectName(f.object_id)}</TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {GLOBAL_FIELD_TYPES.find((t) => t.value === f.data_type)?.label ?? f.data_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{f.category ?? "—"}</TableCell>
                  <TableCell className="text-xs">{f.unit ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {GLOBAL_FIELD_SOURCES.find((s) => s.value === f.data_source)?.label ?? f.data_source}
                  </TableCell>
                  <TableCell className="text-xs">v{f.version}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setFieldDraft({
                        id: f.id, object_id: f.object_id, field_key: f.field_key, display_name: f.display_name,
                        description: f.description ?? "", data_type: f.data_type,
                        category: f.category ?? "", unit: f.unit ?? "",
                        default_value: f.default_value ?? "", data_source: f.data_source,
                        list_id: f.list_id ?? null, calculation_id: f.calculation_id ?? null,
                        validation_ids: f.validation_ids ?? [], is_repeatable: !!f.is_repeatable,
                        repeater: readGlobalRepeaterMeta(f),
                        subfields: readGlobalRepeaterSubfields(f),
                      });
                      setFieldOpen(true);
                    }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Feld archivieren?")) archiveField.mutate(f.id);
                    }}><Archive className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={objOpen} onOpenChange={setObjOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{objDraft.id ? "Objekt bearbeiten" : "Neues globales Objekt"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Anzeigename</Label>
              <Input value={objDraft.display_name} onChange={(e) => setObjDraft({ ...objDraft, display_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Technische ID {objDraft.id && "(unveränderlich)"}</Label>
              <Input
                className="font-mono text-xs"
                disabled={!!objDraft.id}
                value={objDraft.id ? objDraft.object_key : (objDraft.object_key || slug(objDraft.display_name))}
                onChange={(e) => setObjDraft({ ...objDraft, object_key: slug(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Kategorie</Label>
              <Input value={objDraft.category} onChange={(e) => setObjDraft({ ...objDraft, category: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Beschreibung</Label>
              <Textarea rows={2} value={objDraft.description} onChange={(e) => setObjDraft({ ...objDraft, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjOpen(false)}>Abbrechen</Button>
            <Button disabled={!objDraft.display_name || saveObject.isPending} onClick={() => saveObject.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{fieldDraft.id ? "Globales Feld bearbeiten" : "Neues globales Feld"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Objekt</Label>
              {objects.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Noch kein globales Objekt vorhanden – bitte zuerst links „Neues Objekt“ anlegen.
                </p>
              ) : (
                <Select
                  value={fieldDraft.object_id || objects[0].id}
                  onValueChange={(v) => setFieldDraft({ ...fieldDraft, object_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {objects.map((o) => <SelectItem key={o.id} value={o.id}>{o.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="sm:col-span-2">

              <Label className="text-xs">Anzeigename</Label>
              <Input value={fieldDraft.display_name} onChange={(e) => setFieldDraft({ ...fieldDraft, display_name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Technische ID {fieldDraft.id && "(unveränderlich)"}</Label>
              <Input
                className="font-mono text-xs"
                disabled={!!fieldDraft.id}
                value={fieldDraft.id ? fieldDraft.field_key : (fieldDraft.field_key || slug(fieldDraft.display_name))}
                onChange={(e) => setFieldDraft({ ...fieldDraft, field_key: slug(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Datentyp</Label>
              <Select value={fieldDraft.data_type} onValueChange={(v) => setFieldDraft({ ...fieldDraft, data_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GLOBAL_FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Datenquelle</Label>
              <Select value={fieldDraft.data_source} onValueChange={(v) => setFieldDraft({ ...fieldDraft, data_source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GLOBAL_FIELD_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kategorie</Label>
              <Input value={fieldDraft.category} onChange={(e) => setFieldDraft({ ...fieldDraft, category: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Einheit</Label>
              <Input value={fieldDraft.unit} onChange={(e) => setFieldDraft({ ...fieldDraft, unit: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Standardwert</Label>
              <Input value={fieldDraft.default_value} onChange={(e) => setFieldDraft({ ...fieldDraft, default_value: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Globale Liste (Auswahlwerte)</Label>
              <Select
                value={fieldDraft.list_id ?? NONE}
                onValueChange={(v) => setFieldDraft({ ...fieldDraft, list_id: v === NONE ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine</SelectItem>
                  {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Globale Berechnung</Label>
              <Select
                value={fieldDraft.calculation_id ?? NONE}
                onValueChange={(v) => setFieldDraft({ ...fieldDraft, calculation_id: v === NONE ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine</SelectItem>
                  {calcs.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Globale Validierungen</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {validations.length === 0 && (
                  <p className="text-xs text-muted-foreground">Noch keine Regeln definiert.</p>
                )}
                {validations.map((v) => {
                  const active = fieldDraft.validation_ids.includes(v.id);
                  return (
                    <Button
                      key={v.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setFieldDraft({
                        ...fieldDraft,
                        validation_ids: active
                          ? fieldDraft.validation_ids.filter((x) => x !== v.id)
                          : [...fieldDraft.validation_ids, v.id],
                      })}
                    >
                      {v.display_name}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={fieldDraft.is_repeatable}
                  onChange={(e) => setFieldDraft({ ...fieldDraft, is_repeatable: e.target.checked })}
                />
                Wiederholbar (mehrere Proben, Messungen, Rohstoffe, Bilder – ohne feste Zeilenanzahl)
              </label>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Beschreibung</Label>
              <Textarea rows={2} value={fieldDraft.description} onChange={(e) => setFieldDraft({ ...fieldDraft, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldOpen(false)}>Abbrechen</Button>
            <Button disabled={!fieldDraft.display_name || saveField.isPending} onClick={() => saveField.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
