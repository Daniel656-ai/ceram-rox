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
import { Plus, Boxes, Pencil, Archive, Search, Lock, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import RepeaterLayoutDesigner from "./RepeaterLayoutDesigner";
import { SymbolInput, SymbolTextarea } from "@/components/forms/SymbolInput";
import RichText from "@/components/forms/RichText";
import { toPlain } from "@/lib/richText";
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
  // Auszeichnung (_{...} / ^{...}) fließt nie in technische Schlüssel ein.
  toPlain(s).toLowerCase()
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
  select_options: Array<{ label: string; value: string }>;
  repeater: GlobalRepeaterMeta;
  subfields: GlobalRepeaterSubfield[];
};

const emptyField: FieldDraft = {
  object_id: "",
  field_key: "", display_name: "", description: "", data_type: "text",
  category: "", unit: "", default_value: "", data_source: "manual",
  list_id: null, calculation_id: null, validation_ids: [], is_repeatable: false,
  select_options: [],
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
  { value: "ref_material", label: "Rohstoff (aus Rohstoffverwaltung)" },
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
        select_options:
          fieldDraft.data_type === "select" || fieldDraft.data_type === "multiselect"
            ? (fieldDraft.select_options as any)
            : ([] as any),
        is_repeatable: fieldDraft.data_type === "repeater" ? true : fieldDraft.is_repeatable,
        metadata: (() => {
          const current = (fields.find((f) => f.id === fieldDraft.id)?.metadata ?? {}) as Record<string, unknown>;
          const next = { ...current };
          if (fieldDraft.data_type === "repeater") {
            next.repeater = fieldDraft.repeater;
            next.subfields = fieldDraft.subfields;
          } else {
            delete next.repeater;
            delete next.subfields;
          }
          return next;
        })() as any,
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
                  <TableCell className="font-medium"><RichText value={f.display_name} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{f.field_key}</TableCell>
                  <TableCell className="text-xs">{objectName(f.object_id)}</TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {GLOBAL_FIELD_TYPES.find((t) => t.value === f.data_type)?.label ?? f.data_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{f.category ?? "—"}</TableCell>
                  <TableCell className="text-xs">{f.unit ? <RichText value={f.unit} /> : "—"}</TableCell>
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
                        select_options: (f.select_options ?? []).map((o: any) =>
                          typeof o === "string" ? { label: o, value: o } : { label: o.label ?? o.value, value: o.value ?? o.label }
                        ),
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
              <SymbolInput value={objDraft.display_name} onChange={(v) => setObjDraft({ ...objDraft, display_name: v })} />
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
              <SymbolTextarea rows={2} value={objDraft.description} onChange={(v) => setObjDraft({ ...objDraft, description: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjOpen(false)}>Abbrechen</Button>
            <Button disabled={!objDraft.display_name || saveObject.isPending} onClick={() => saveObject.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">

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
              <SymbolInput value={fieldDraft.display_name} onChange={(v) => setFieldDraft({ ...fieldDraft, display_name: v })} />
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
            {(fieldDraft.data_type === "select" || fieldDraft.data_type === "multiselect") && (
              <div className="sm:col-span-2">
                <SelectOptionsEditor
                  options={fieldDraft.select_options}
                  disabled={!!fieldDraft.list_id}
                  onChange={(opts) => setFieldDraft({ ...fieldDraft, select_options: opts })}
                />
              </div>
            )}
            {fieldDraft.data_type !== "repeater" && (
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={fieldDraft.is_repeatable}
                    onChange={(e) => setFieldDraft({ ...fieldDraft, is_repeatable: e.target.checked })}
                  />
                  Wiederverwendbar (Feld darf mehrfach im selben Formular eingefügt werden – jede Instanz hat einen eigenen Wert)
                </label>
              </div>
            )}
            {fieldDraft.data_type === "repeater" && (
              <div className="sm:col-span-2">
                <GlobalRepeaterSettings
                  draft={fieldDraft}
                  onChange={(patch) => setFieldDraft({ ...fieldDraft, ...patch })}
                />
              </div>
            )}

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

/* ------------------------------------------------------------------
 * Repeater-Einstellungen eines globalen Feldes (1:n-Unterliste)
 * ------------------------------------------------------------------ */
function GlobalRepeaterSettings({
  draft,
  onChange,
}: {
  draft: FieldDraft;
  onChange: (patch: Partial<FieldDraft>) => void;
}) {
  const meta = draft.repeater ?? {};
  const subfields = draft.subfields ?? [];
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [newUnit, setNewUnit] = useState("");

  const setMeta = (patch: Partial<GlobalRepeaterMeta>) => onChange({ repeater: { ...meta, ...patch } });
  const setSubfields = (next: GlobalRepeaterSubfield[]) => onChange({ subfields: next });

  const addSubfield = () => {
    const key = slug(newKey || newLabel);
    if (!key || !newLabel.trim()) return;
    if (subfields.some((s) => s.field_key === key)) {
      toast.error("Technische ID bereits vergeben");
      return;
    }
    setSubfields([
      ...subfields,
      {
        field_key: key,
        display_name: newLabel.trim(),
        data_type: newType as any,
        unit: newUnit.trim() || null,
        is_required: false,
        select_options: [],
      },
    ]);
    setNewKey(""); setNewLabel(""); setNewUnit(""); setNewType("text");
  };

  const patchSubfield = (i: number, patch: Partial<GlobalRepeaterSubfield>) =>
    setSubfields(subfields.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= subfields.length) return;
    const next = subfields.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setSubfields(next);
  };

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Repeater-Einstellungen (1:n-Unterliste)
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Mindestanzahl</Label>
          <Input
            type="number" className="h-8 text-xs" value={meta.min_entries ?? 0}
            onChange={(e) => setMeta({ min_entries: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">Maximalanzahl</Label>
          <Input
            type="number" className="h-8 text-xs" value={meta.max_entries ?? ""} placeholder="unbegrenzt"
            onChange={(e) => setMeta({ max_entries: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">Eintrag-Label</Label>
          <Input className="h-8 text-xs" value={meta.item_label ?? ""} placeholder="Eintrag"
            onChange={(e) => setMeta({ item_label: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Button-Text</Label>
          <Input className="h-8 text-xs" value={meta.add_label ?? ""} placeholder="Rohstoff hinzufügen"
            onChange={(e) => setMeta({ add_label: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Storage-Key (optional)</Label>
          <Input className="h-8 text-xs font-mono" value={meta.storage_key ?? ""}
            placeholder={draft.field_key || slug(draft.display_name)}
            onChange={(e) => setMeta({ storage_key: e.target.value ? slug(e.target.value) : undefined })} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Gleicher Storage-Key in mehreren Formularen → die Liste wird im gesamten Auftrag geteilt
            (Auftraggeber erfasst, Dienstleister sieht sie ohne erneute Eingabe).
          </p>
        </div>
      </div>

      <div className="border-t pt-2">
        <p className="text-xs font-semibold mb-2">Unterfelder ({subfields.length})</p>
        <div className="space-y-1 mb-2">
          {subfields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Noch keine Unterfelder – z. B. Rohstoff, Rohstoffcode, Lotnummer, Menge, Einheit, Bemerkung.
            </p>
          )}
          {subfields.map((s, i) => (
            <div key={s.field_key} className="rounded border bg-background px-2 py-1.5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-xs font-medium">{s.display_name}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{s.field_key}</Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)}>↑</Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)}>↓</Button>
                <Button size="icon" variant="ghost" className="h-6 w-6"
                  onClick={() => setSubfields(subfields.filter((_, idx) => idx !== i))}>×</Button>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <Select value={s.data_type} onValueChange={(v) => patchSubfield(i, { data_type: v as any })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBFIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="h-7 text-xs" placeholder="Einheit" value={s.unit ?? ""}
                  onChange={(e) => patchSubfield(i, { unit: e.target.value || null })} />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!s.is_required}
                    onChange={(e) => patchSubfield(i, { is_required: e.target.checked })} />
                  Pflichtfeld
                </label>
              </div>
              {(s.data_type === "select" || s.data_type === "multiselect") && (
                <Input
                  className="h-7 text-xs"
                  placeholder="Optionen, mit Komma getrennt"
                  value={(s.select_options ?? []).map((o: any) => (typeof o === "string" ? o : o.label)).join(", ")}
                  onChange={(e) =>
                    patchSubfield(i, {
                      select_options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          <Input className="h-8 text-xs" placeholder="Anzeigename (z. B. Rohstoff)"
            value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Input className="h-8 text-xs font-mono" placeholder={slug(newLabel) || "technische_id"}
            value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBFIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="h-8 text-xs" placeholder="Einheit (optional)"
            value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
        </div>
        <Button type="button" size="sm" variant="outline" className="mt-2 w-full"
          disabled={!newLabel.trim()} onClick={addSubfield}>
          <Plus className="h-3 w-3 mr-1" /> Unterfeld hinzufügen
        </Button>
      </div>

      {subfields.length > 0 && (
        <div className="border-t pt-2">
          <RepeaterLayoutDesigner
            subfields={subfields.map((s) => ({
              key: s.field_key, label: s.display_name, type: s.data_type, unit: s.unit,
            }))}
            value={meta.layout}
            onChange={(layout) => setMeta({ layout })}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Dieses Layout wird in jedem Formular verwendet, das diesen globalen Repeater referenziert.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
 * Auswahlwerte eines globalen Auswahl-Feldes (hinzufügen, bearbeiten,
 * löschen, Reihenfolge ändern). Bei verknüpfter Stammdatenliste liefern
 * die Stammdaten die Werte – dann ist der Editor deaktiviert.
 * ------------------------------------------------------------------ */
function SelectOptionsEditor({
  options, onChange, disabled,
}: {
  options: Array<{ label: string; value: string }>;
  onChange: (o: Array<{ label: string; value: string }>) => void;
  disabled?: boolean;
}) {
  const patch = (i: number, p: Partial<{ label: string; value: string }>) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...p } : o)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="rounded-md border p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Auswahlwerte (Optionen)</Label>
        {!disabled && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onChange([...options, { label: "", value: "" }])}
          >
            <Plus className="h-3 w-3 mr-1" /> Option
          </Button>
        )}
      </div>

      {disabled ? (
        <p className="text-xs text-muted-foreground">
          Die Optionen stammen aus der verknüpften Stammdatenliste. Zum manuellen Pflegen die Liste auf „Keine“ setzen.
        </p>
      ) : options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Optionen definiert.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] uppercase text-muted-foreground px-1">
            <div>Anzeige</div><div>Wert (technisch)</div><div />
          </div>
          {options.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input
                className="h-8"
                value={o.label}
                placeholder="z. B. Diesel catalyst"
                onChange={(e) => {
                  const label = e.target.value;
                  const autoValue = !o.value || o.value === slug(o.label);
                  patch(i, autoValue ? { label, value: slug(label) } : { label });
                }}
              />
              <Input
                className="h-8 font-mono text-xs"
                value={o.value}
                placeholder="diesel_catalyst"
                onChange={(e) => patch(i, { value: e.target.value })}
              />
              <div className="flex items-center gap-0.5">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => onChange(options.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
