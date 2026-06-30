import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, Database, FormInput, Workflow, Zap,
  FileText, Eye, History, Settings, GripVertical,
} from "lucide-react";
import type { ServiceDataField, ServiceFieldType } from "@/lib/api/serviceDesigner";
import FormDesignerTab from "@/components/ServiceDesigner/FormDesigner";
import WorkflowDesignerTab from "@/components/ServiceDesigner/WorkflowDesigner";

const FIELD_TYPE_GROUPS: { label: string; types: { value: ServiceFieldType; label: string }[] }[] = [
  {
    label: "Standard",
    types: [
      { value: "text", label: "Text" },
      { value: "longtext", label: "Mehrzeiliger Text" },
      { value: "number", label: "Zahl" },
      { value: "decimal", label: "Dezimalzahl" },
      { value: "percent", label: "Prozent" },
      { value: "boolean", label: "Ja / Nein" },
    ],
  },
  {
    label: "Datum & Zeit",
    types: [
      { value: "date", label: "Datum" },
      { value: "time", label: "Uhrzeit" },
      { value: "datetime", label: "Datum & Uhrzeit" },
    ],
  },
  {
    label: "Auswahl",
    types: [
      { value: "select", label: "Dropdown" },
      { value: "multiselect", label: "Mehrfachauswahl" },
    ],
  },
  {
    label: "Dateien & Codes",
    types: [
      { value: "file", label: "Datei" },
      { value: "image", label: "Bild" },
      { value: "barcode", label: "Barcode" },
      { value: "qrcode", label: "QR-Code" },
    ],
  },
  {
    label: "Beziehungen",
    types: [
      { value: "ref_customer", label: "Kunde" },
      { value: "ref_material", label: "Material" },
      { value: "ref_product", label: "Produkt" },
      { value: "ref_machine", label: "Maschine" },
      { value: "ref_employee", label: "Mitarbeiter" },
      { value: "ref_location", label: "Standort" },
      { value: "ref_batch", label: "Chargennummer" },
      { value: "ref_serial", label: "Seriennummer" },
      { value: "repeater", label: "Unterliste (1:n)" },
    ],
  },
];

const ALL_TYPES = FIELD_TYPE_GROUPS.flatMap((g) => g.types);

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export default function AdminServiceDesignerPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { role } = useAuth();
  const canManage = role === "master" || hasPermission("admin.system" as any);
  const qc = useQueryClient();


  const { data: service, isLoading } = useQuery({
    queryKey: ["service-designer", serviceId],
    queryFn: () => api.measurementServices.getById(serviceId!),
    enabled: !!serviceId,
  });

  if (!serviceId) return null;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/messdienstleistungen")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              Service Designer
              {service?.service_name ? <span className="text-muted-foreground"> · {service.service_name}</span> : null}
            </h1>
            <p className="text-sm text-muted-foreground">No-Code Konfiguration für Dienstleistungen</p>
          </div>
        </div>
        {!canManage && <Badge variant="outline">Nur Lesezugriff</Badge>}
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general"><Settings className="h-4 w-4 mr-1" />Allgemein</TabsTrigger>
          <TabsTrigger value="data"><Database className="h-4 w-4 mr-1" />Datenmodell</TabsTrigger>
          <TabsTrigger value="form"><FormInput className="h-4 w-4 mr-1" />Formular</TabsTrigger>
          <TabsTrigger value="workflow" disabled><Workflow className="h-4 w-4 mr-1" />Workflow</TabsTrigger>
          <TabsTrigger value="rules" disabled><Zap className="h-4 w-4 mr-1" />Regeln</TabsTrigger>
          <TabsTrigger value="docs" disabled><FileText className="h-4 w-4 mr-1" />Dokumente</TabsTrigger>
          <TabsTrigger value="preview" disabled><Eye className="h-4 w-4 mr-1" />Vorschau</TabsTrigger>
          <TabsTrigger value="versions" disabled><History className="h-4 w-4 mr-1" />Versionen</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab serviceId={serviceId} service={service} canManage={canManage} loading={isLoading} onSaved={() => qc.invalidateQueries({ queryKey: ["service-designer", serviceId] })} />
        </TabsContent>

        <TabsContent value="data">
          <DataModelTab serviceId={serviceId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="form">
          <FormDesignerTab serviceId={serviceId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----------------------------- General Tab -----------------------------

function GeneralTab({
  serviceId, service, canManage, loading, onSaved,
}: { serviceId: string; service: any; canManage: boolean; loading: boolean; onSaved: () => void }) {
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (service) setForm({ ...service }); }, [service]);

  const save = useMutation({
    mutationFn: () =>
      api.measurementServices.update(serviceId, {
        service_name: form.service_name,
        description: form.description ?? null,
        icon: form.icon ?? null,
        color: form.color ?? null,
        department: form.department ?? null,
        hourly_rate: form.hourly_rate != null ? Number(form.hourly_rate) : undefined,
        price: form.price != null && form.price !== "" ? Number(form.price) : null,
        standard_duration_hours: form.standard_duration_hours != null ? Number(form.standard_duration_hours) : undefined,
        active: !!form.active,
      }),
    onSuccess: () => { toast.success("Gespeichert"); onSaved(); },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  if (loading || !service) return <Card><CardContent className="p-6 text-muted-foreground">Lade …</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle>Stammdaten</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={form.service_name ?? ""} disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, service_name: e.target.value }))} />
          </Field>
          <Field label="Kategorie">
            <Input value={form.category ?? ""} disabled />
          </Field>
          <Field label="Abteilung">
            <Input value={form.department ?? ""} disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, department: e.target.value }))} />
          </Field>
          <Field label="Icon (Lucide-Name)">
            <Input value={form.icon ?? ""} placeholder="z.B. flask-conical" disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, icon: e.target.value }))} />
          </Field>
          <Field label="Farbe">
            <div className="flex items-center gap-2">
              <Input type="color" value={form.color ?? "#3b82f6"} disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, color: e.target.value }))} className="h-9 w-16 p-1" />
              <Input value={form.color ?? ""} placeholder="#3b82f6" disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, color: e.target.value }))} />
            </div>
          </Field>
          <Field label="Standarddauer (h)">
            <Input type="number" min={0.25} step={0.25} value={form.standard_duration_hours ?? ""} disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, standard_duration_hours: e.target.value }))} />
          </Field>
          <Field label="Stundensatz (€)">
            <Input type="number" min={0} step={0.01} value={form.hourly_rate ?? ""} disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, hourly_rate: e.target.value }))} />
          </Field>
          <Field label="Festpreis (€, optional)">
            <Input type="number" min={0} step={0.01} value={form.price ?? ""} disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, price: e.target.value }))} />
          </Field>
        </div>
        <Field label="Beschreibung">
          <Textarea rows={4} value={form.description ?? ""} disabled={!canManage} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
        </Field>
        <div className="flex items-center gap-3">
          <Switch checked={!!form.active} disabled={!canManage} onCheckedChange={(c) => setForm((f: any) => ({ ...f, active: c }))} />
          <span className="text-sm">{form.active ? "Aktiv" : "Inaktiv"}</span>
        </div>
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Speichern</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ---------------------------- Data Model Tab ----------------------------

function DataModelTab({ serviceId, canManage }: { serviceId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId),
  });

  const [editing, setEditing] = useState<ServiceDataField | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ServiceDataField | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(
    () => fields.filter((f) => showArchived || !f.archived),
    [fields, showArchived]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceDataField[]>();
    for (const f of visible) {
      const cat = f.category || "Allgemein";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    return Array.from(map.entries());
  }, [visible]);

  const removeField = useMutation({
    mutationFn: (id: string) => api.serviceDataFields.delete(id),
    onSuccess: () => {
      toast.success("Feld gelöscht");
      qc.invalidateQueries({ queryKey: ["service-data-fields", serviceId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Datenmodell</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Definiere alle Daten, die zu dieser Dienstleistung gehören. Diese Felder werden später in Formular, Workflow, Regeln, Dokumenten und Berichten wiederverwendet.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              Archivierte zeigen
            </label>
            {canManage && (
              <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Neues Feld</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Lade …</div>
          ) : visible.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
              Noch keine Datenfelder. {canManage && "Lege oben das erste Feld an."}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([cat, items]) => (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{cat}</h3>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Anzeigename</TableHead>
                          <TableHead>Schlüssel</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Einheit</TableHead>
                          <TableHead className="text-center">Pflicht</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((f) => (
                          <TableRow key={f.id} className={f.archived ? "opacity-50" : ""}>
                            <TableCell><GripVertical className="h-4 w-4 text-muted-foreground" /></TableCell>
                            <TableCell className="font-medium">
                              {f.display_name}
                              {f.archived && <Badge variant="outline" className="ml-2 text-[10px]">archiviert</Badge>}
                            </TableCell>
                            <TableCell><code className="text-xs">{f.field_key}</code></TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {ALL_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{f.unit || "—"}</TableCell>
                            <TableCell className="text-center">{f.is_required ? "Ja" : "—"}</TableCell>
                            <TableCell>
                              {canManage && (
                                <div className="flex gap-1 justify-end">
                                  <Button size="icon" variant="ghost" onClick={() => setEditing(f)}><Pencil className="h-4 w-4" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(f)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(creating || editing) && (
        <FieldDialog
          serviceId={serviceId}
          field={editing}
          existingKeys={fields.map((f) => f.field_key)}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["service-data-fields", serviceId] });
            setEditing(null); setCreating(false);
          }}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Feld löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{confirmDelete?.display_name}" wird unwiderruflich gelöscht. Wenn das Feld bereits in Aufträgen verwendet wird, archiviere es stattdessen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) removeField.mutate(confirmDelete.id); setConfirmDelete(null); }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----------------------- Field create/edit dialog -----------------------

function FieldDialog({
  serviceId, field, existingKeys, onClose, onSaved,
}: {
  serviceId: string;
  field: ServiceDataField | null;
  existingKeys: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!field;
  const [form, setForm] = useState<Partial<ServiceDataField>>(() =>
    field ?? {
      service_id: serviceId,
      field_key: "",
      display_name: "",
      field_type: "text",
      is_required: false,
      readonly: false,
      archived: false,
      select_options: [],
      category: "Allgemein",
      sort_order: 0,
    }
  );
  const [optionsText, setOptionsText] = useState<string>(() => {
    const opts = (field?.select_options as any[]) ?? [];
    return opts
      .map((o) => (typeof o === "string" ? o : o?.label ?? o?.value ?? ""))
      .filter(Boolean)
      .join("\n");
  });
  const [autoKey, setAutoKey] = useState(!isEdit);

  // Auto-generate key from display name while not edited manually
  useEffect(() => {
    if (autoKey && form.display_name) {
      setForm((f) => ({ ...f, field_key: slugify(String(form.display_name)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.display_name, autoKey]);

  const needsOptions = form.field_type === "select" || form.field_type === "multiselect";

  const save = useMutation({
    mutationFn: async () => {
      const key = (form.field_key || "").trim();
      if (!key) throw new Error("Schlüssel fehlt");
      if (!isEdit && existingKeys.includes(key)) throw new Error("Schlüssel existiert bereits in dieser Dienstleistung");

      const payload: any = {
        service_id: serviceId,
        field_key: key,
        display_name: form.display_name,
        description: form.description ?? null,
        field_type: form.field_type,
        category: form.category ?? null,
        unit: form.unit ?? null,
        is_required: !!form.is_required,
        default_value: form.default_value ?? null,
        min_value: form.min_value != null && form.min_value !== ("" as any) ? Number(form.min_value) : null,
        max_value: form.max_value != null && form.max_value !== ("" as any) ? Number(form.max_value) : null,
        decimal_places: form.decimal_places != null && form.decimal_places !== ("" as any) ? Number(form.decimal_places) : null,
        readonly: !!form.readonly,
        archived: !!form.archived,
        select_options: needsOptions
          ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
        sort_order: form.sort_order ?? 0,
      };
      if (isEdit) {
        await api.serviceDataFields.update(field!.id, payload);
      } else {
        await api.serviceDataFields.create(payload);
      }
    },
    onSuccess: () => { toast.success(isEdit ? "Feld aktualisiert" : "Feld angelegt"); onSaved(); },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Feld bearbeiten" : "Neues Feld"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Anzeigename">
              <Input value={form.display_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </Field>
            <Field label="Interner Schlüssel">
              <Input
                value={form.field_key ?? ""}
                onChange={(e) => { setAutoKey(false); setForm((f) => ({ ...f, field_key: slugify(e.target.value) })); }}
                disabled={isEdit}
              />
            </Field>
            <Field label="Datentyp">
              <Select value={form.field_type as string} onValueChange={(v) => setForm((f) => ({ ...f, field_type: v as ServiceFieldType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_GROUPS.map((g) => (
                    <div key={g.label}>
                      <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">{g.label}</div>
                      {g.types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Kategorie">
              <Input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="z.B. Einstellparameter" />
            </Field>
            <Field label="Einheit">
              <Input value={form.unit ?? ""} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="z.B. mm, °C, %" />
            </Field>
            <Field label="Standardwert">
              <Input value={form.default_value ?? ""} onChange={(e) => setForm((f) => ({ ...f, default_value: e.target.value }))} />
            </Field>
            {(form.field_type === "number" || form.field_type === "decimal" || form.field_type === "percent") && (
              <>
                <Field label="Minimum">
                  <Input type="number" value={(form.min_value as any) ?? ""} onChange={(e) => setForm((f) => ({ ...f, min_value: e.target.value as any }))} />
                </Field>
                <Field label="Maximum">
                  <Input type="number" value={(form.max_value as any) ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_value: e.target.value as any }))} />
                </Field>
                <Field label="Nachkommastellen">
                  <Input type="number" min={0} max={6} value={(form.decimal_places as any) ?? ""} onChange={(e) => setForm((f) => ({ ...f, decimal_places: e.target.value as any }))} />
                </Field>
              </>
            )}
          </div>

          {needsOptions && (
            <Field label="Auswahloptionen (eine pro Zeile)">
              <Textarea rows={5} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
            </Field>
          )}

          <Field label="Beschreibung">
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!form.is_required} onCheckedChange={(c) => setForm((f) => ({ ...f, is_required: c }))} />
              Pflichtfeld
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!form.readonly} onCheckedChange={(c) => setForm((f) => ({ ...f, readonly: c }))} />
              Schreibgeschützt
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!form.archived} onCheckedChange={(c) => setForm((f) => ({ ...f, archived: c }))} />
              Archiviert
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.display_name || !form.field_key}>
            {isEdit ? "Speichern" : "Anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
