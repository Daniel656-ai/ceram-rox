import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Beaker, Factory, Layers, FileText, FormInput, Puzzle, LinkIcon, Settings, Eye, Calculator, ClipboardList, Boxes, Library } from "lucide-react";
import type { ProcessKind, ProcessTemplate } from "@/lib/api/processTemplates";
import type { ProcessStep } from "@/lib/api/processSteps";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { FormField, FormFieldType } from "@/lib/api/formFields";
import { ProcessStepRawMaterials } from "@/components/ProcessStepRawMaterials";
import FormLayoutDesigner from "@/components/ServiceDesigner/FormLayoutDesigner";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import RoleViewsDesigner from "@/components/ServiceDesigner/RoleViewsDesigner";
import { normalizeLayout } from "@/lib/api/formDefinitionLayout";
import ProcessServicesTab from "@/components/ServiceDesigner/ProcessServicesTab";
import OrderKindMappingTab from "@/components/ServiceDesigner/OrderKindMappingTab";
import RoleFormTab from "@/components/ServiceDesigner/RoleFormTab";
import ServicePreviewTab from "@/components/ServiceDesigner/ServicePreviewTab";
import ReportTemplateDesigner from "@/components/ServiceDesigner/ReportTemplateDesigner";
import GlobalModelTab from "@/components/ServiceDesigner/GlobalModelTab";
import GlobalLibraryTab from "@/components/ServiceDesigner/GlobalLibraryTab";
import GlobalFieldPicker from "@/components/ServiceDesigner/GlobalFieldPicker";


const FIELD_TYPE_GROUPS: { label: string; types: { value: FormFieldType; label: string }[] }[] = [
  { label: "Standard", types: [
    { value: "text", label: "Text" }, { value: "longtext", label: "Mehrzeiliger Text" },
    { value: "number", label: "Zahl" }, { value: "decimal", label: "Dezimalzahl" },
    { value: "percent", label: "Prozent" }, { value: "boolean", label: "Ja / Nein" },
  ]},
  { label: "Datum & Zeit", types: [
    { value: "date", label: "Datum" }, { value: "time", label: "Uhrzeit" }, { value: "datetime", label: "Datum & Uhrzeit" },
  ]},
  { label: "Auswahl", types: [{ value: "select", label: "Dropdown" }, { value: "multiselect", label: "Mehrfachauswahl" }]},
  { label: "Dateien & Codes", types: [
    { value: "file", label: "Datei" }, { value: "image", label: "Bild" },
    { value: "barcode", label: "Barcode" }, { value: "qrcode", label: "QR-Code" },
    { value: "handwriting", label: "Handschrift (Stift/Tablet)" },
  ]},
  { label: "Berechnung", types: [{ value: "computed", label: "Berechnetes Feld (Formel)" }]},
  { label: "Rohstoffe", types: [{ value: "raw_material_recipe", label: "Rezeptur / Rohstoffliste (Auftraggeber)" }]},
  { label: "Wiederholbare Gruppen", types: [
    { value: "repeater", label: "Repeater (wiederholbare Einträge)" },
  ]},
  { label: "Beziehungen", types: [
    { value: "ref_customer", label: "Kunde" }, { value: "ref_material", label: "Material" },
    { value: "ref_product", label: "Produkt" }, { value: "ref_machine", label: "Maschine" },
    { value: "ref_employee", label: "Mitarbeiter" }, { value: "ref_location", label: "Standort" },
    { value: "ref_batch", label: "Chargennummer" }, { value: "ref_serial", label: "Seriennummer" },
  ]},
];
const ALL_TYPES = FIELD_TYPE_GROUPS.flatMap(g => g.types);

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

export default function AdminServiceDesignerPage() {
  const { templateId } = useParams<{ templateId?: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { role } = useAuth();
  const canManage = role === "master" || hasPermission("admin.system" as any);

  if (!canManage) {
    return (
      <div className="p-6"><Card><CardContent className="pt-6">
        Sie haben keine Berechtigung, den Prozess-Designer zu verwalten.
      </CardContent></Card></div>
    );
  }

  return templateId ? <TemplateEditor templateId={templateId} onBack={() => navigate("/admin/prozess-designer")} /> : <TemplateList navigate={navigate} />;
}

// ---------------- List View ----------------
function TemplateList({ navigate }: { navigate: (p: string) => void }) {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  // Alle Tabs sind gleichwertig registriert. Neue Bereiche MÜSSEN hier ergänzt
  // werden, sonst fällt der kontrollierte Tab still auf "templates" zurück und
  // wirkt deaktiviert. Die Auswahl hängt nie vom Datenbestand ab.
  const DESIGNER_TABS = ["templates", "library", "mapping", "global", "library-global"] as const;
  const tabParam = searchParams.get("tab");
  const initialTab = (DESIGNER_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as string)
    : "templates";

  const [filterKind, setFilterKind] = useState<"all" | ProcessKind>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<ProcessKind>("labor");
  const [newCategory, setNewCategory] = useState("");
  const [newScope, setNewScope] = useState<"template" | "snippet">("template");
  const [confirmDelete, setConfirmDelete] = useState<ProcessTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["process-templates"],
    queryFn: () => api.processTemplates.list({ includeArchived: false }),
  });

  const filtered = useMemo(() => {
    return templates.filter(t => filterKind === "all" || t.kind === filterKind);
  }, [templates, filterKind]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Name erforderlich");
      const t = await api.processTemplates.create({
        name: newName.trim(), kind: newKind, scope: newScope,
        category: newCategory.trim() || null, is_active: true,
      });
      return t;
    },
    onSuccess: (t) => {
      toast.success("Vorlage angelegt");
      qc.invalidateQueries({ queryKey: ["process-templates"] });
      setNewOpen(false); setNewName(""); setNewCategory("");
      navigate(`/admin/prozess-designer/${t.id}`);
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.processTemplates.remove(id),
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["process-templates"] });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Löschen fehlgeschlagen"),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Layers className="h-6 w-6" /> Service- & Prozess-Designer</h1>
          <p className="text-sm text-muted-foreground">Formular-Bibliothek (Service Designer) und zentrale Vorlagen für Labor- & Pilot-Plant-Prozesse.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-2" />Neue Vorlage</Button>
      </div>

      <Tabs value={initialTab} onValueChange={(v) => setSearchParams(v === "templates" ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="templates"><Layers className="h-4 w-4 mr-1" />Vorlagen & Snippets</TabsTrigger>
          <TabsTrigger value="library"><FormInput className="h-4 w-4 mr-1" />Formular-Bibliothek (Service Designer)</TabsTrigger>
          <TabsTrigger value="mapping"><LinkIcon className="h-4 w-4 mr-1" />Auftragsart-Zuordnung</TabsTrigger>
          <TabsTrigger value="global"><Boxes className="h-4 w-4 mr-1" />Globale Objekte & Felder</TabsTrigger>
          <TabsTrigger value="library-global"><Library className="h-4 w-4 mr-1" />Stammdaten, Berechnungen & Validierungen</TabsTrigger>
        </TabsList>

        <TabsContent value="library-global" className="mt-4">
          <GlobalLibraryTab />
        </TabsContent>

        <TabsContent value="global" className="mt-4">
          <GlobalModelTab />
        </TabsContent>



        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Button variant={filterKind === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterKind("all")}>Alle</Button>
            <Button variant={filterKind === "labor" ? "default" : "outline"} size="sm" onClick={() => setFilterKind("labor")}><Beaker className="h-4 w-4 mr-1" />Labor</Button>
            <Button variant={filterKind === "pilot_plant" ? "default" : "outline"} size="sm" onClick={() => setFilterKind("pilot_plant")}><Factory className="h-4 w-4 mr-1" />Pilot Plant</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Modus</TableHead><TableHead>Typ</TableHead>
                  <TableHead>Kategorie</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Lade…</TableCell></TableRow>}
                  {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Vorlagen vorhanden.</TableCell></TableRow>}
                  {filtered.map(t => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/admin/prozess-designer/${t.id}`)}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.kind === "labor" ? <Badge variant="secondary"><Beaker className="h-3 w-3 mr-1" />Labor</Badge> : <Badge variant="secondary"><Factory className="h-3 w-3 mr-1" />Pilot Plant</Badge>}</TableCell>
                      <TableCell>{t.scope === "snippet" ? <Badge variant="outline"><Puzzle className="h-3 w-3 mr-1" />Snippet</Badge> : <Badge variant="outline">Vorlage</Badge>}</TableCell>
                      <TableCell>{t.category || "—"}</TableCell>
                      <TableCell>v{t.version}</TableCell>
                      <TableCell>{t.is_active ? <Badge>aktiv</Badge> : <Badge variant="outline">inaktiv</Badge>}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(t)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="mt-4">
          <GlobalFormLibrary />
        </TabsContent>

        <TabsContent value="mapping" className="mt-4">
          <OrderKindMappingTab />
        </TabsContent>
      </Tabs>


      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Vorlage anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z. B. Biegefestigkeit DIN EN 843-1" />
            </div>
            <div>
              <Label>Modus (nach dem Anlegen nicht mehr änderbar)</Label>
              <Select value={newKind} onValueChange={(v: ProcessKind) => setNewKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">Labor — geräte-/methodenorientiert</SelectItem>
                  <SelectItem value="pilot_plant">Pilot Plant — prozessorientiert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Typ</Label>
              <Select value={newScope} onValueChange={(v: any) => setNewScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Vollständige Vorlage</SelectItem>
                  <SelectItem value="snippet">Snippet (wiederverwendbar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kategorie (optional)</Label>
              <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="z. B. Mechanik, Thermik" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Abbrechen</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !newName.trim()}>Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{confirmDelete?.name}" wird endgültig entfernt. Bereits laufende Aufträge behalten ihre Snapshot-Kopie.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- Editor ----------------
function TemplateEditor({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const { data: template, isLoading: loadingT } = useQuery({
    queryKey: ["process-template", templateId],
    queryFn: () => api.processTemplates.get(templateId),
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["process-steps", templateId],
    queryFn: () => api.processTemplateSteps.listForTemplate(templateId),
  });

  const { data: snippets = [] } = useQuery({
    queryKey: ["process-snippets", template?.kind],
    queryFn: () => api.processTemplates.list({ kind: template!.kind, scope: "snippet" }),
    enabled: !!template,
  });

  const invalidateSteps = () => qc.invalidateQueries({ queryKey: ["process-steps", templateId] });

  const updateTemplateMut = useMutation({
    mutationFn: (u: Partial<ProcessTemplate>) => api.processTemplates.update(templateId, u),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["process-template", templateId] }); toast.success("Gespeichert"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const addStepMut = useMutation({
    mutationFn: async () => {
      const order = (steps.at(-1)?.order_index ?? -1) + 1;
      return api.processTemplateSteps.create({
        template_id: templateId, step_key: `step_${order + 1}`, name: `Schritt ${order + 1}`, order_index: order,
      });
    },
    onSuccess: (s) => { invalidateSteps(); setSelectedStepId(s.id); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const insertSnippetMut = useMutation({
    mutationFn: async (snippet: ProcessTemplate) => {
      const count = await api.processTemplates.insertSnippet(templateId, snippet.id);
      return { snippet, count };
    },
    onSuccess: ({ snippet, count }) => {
      invalidateSteps();
      toast.success(`${count} Schritt(e) aus „${snippet.name}" eingefügt`);
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const cloneVersionMut = useMutation({
    mutationFn: () => api.processTemplates.cloneAsNewVersion(templateId),
    onSuccess: (newId) => {
      toast.success("Neue Version erstellt");
      qc.invalidateQueries({ queryKey: ["process-templates"] });
      window.location.href = `/admin/prozess-designer/${newId}`;
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = steps.findIndex(s => s.id === id);
      const swap = steps[idx + dir];
      if (!swap) return;
      await api.processTemplateSteps.reorder([
        { id: steps[idx].id, sort_order: swap.order_index } as any,
        { id: swap.id, sort_order: steps[idx].order_index } as any,
      ]);
      // reorder uses order_index — call proper update
      await api.processTemplateSteps.update(steps[idx].id, { order_index: swap.order_index });
      await api.processTemplateSteps.update(swap.id, { order_index: steps[idx].order_index });
    },
    onSuccess: invalidateSteps,
  });

  const deleteStepMut = useMutation({
    mutationFn: (id: string) => api.processTemplateSteps.remove(id),
    onSuccess: () => { invalidateSteps(); setSelectedStepId(null); toast.success("Schritt gelöscht"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  if (loadingT || !template) return <div className="p-6">Lade…</div>;

  const selectedStep = steps.find(s => s.id === selectedStepId) ?? null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Zurück</Button>
          <div>
            <h1 className="text-xl font-semibold">{template.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {template.kind === "labor" ? <Badge variant="secondary"><Beaker className="h-3 w-3 mr-1" />Labor</Badge> : <Badge variant="secondary"><Factory className="h-3 w-3 mr-1" />Pilot Plant</Badge>}
              <Badge variant="outline">v{template.version}</Badge>
              {template.scope === "snippet" && <Badge variant="outline"><Puzzle className="h-3 w-3 mr-1" />Snippet</Badge>}
              {!template.is_active && <Badge variant="outline">inaktiv</Badge>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { if (confirm("Neue Version erstellen? Die aktuelle Version wird archiviert.")) cloneVersionMut.mutate(); }} disabled={cloneVersionMut.isPending}>
          <Layers className="h-4 w-4 mr-1" />Neue Version
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general"><Settings className="h-4 w-4 mr-1" />Allgemein</TabsTrigger>
          <TabsTrigger value="steps"><Layers className="h-4 w-4 mr-1" />Workflow</TabsTrigger>
          <TabsTrigger value="customer_form"><FormInput className="h-4 w-4 mr-1" />Auftraggeberformular</TabsTrigger>
          <TabsTrigger value="employee_form"><FormInput className="h-4 w-4 mr-1" />Messdienstleisterformular</TabsTrigger>
          <TabsTrigger value="report"><FileText className="h-4 w-4 mr-1" />Berichtsvorlage</TabsTrigger>
          <TabsTrigger value="calc"><Calculator className="h-4 w-4 mr-1" />Berechnungen</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1" />Vorschau</TabsTrigger>
          <TabsTrigger value="services"><Puzzle className="h-4 w-4 mr-1" />Dienstleistungen</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <TemplateMetaEditor template={template} onSave={(u) => updateTemplateMut.mutate(u)} />
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <ProcessServicesTab processTemplateId={template.id} canManage={true} />
        </TabsContent>

        <TabsContent value="customer_form" className="mt-4">
          <RoleFormTab
            template={template}
            metaKey="customer_form_id"
            title="Auftraggeberformular"
            description="Formular, das der Auftraggeber beim Anlegen dieser Dienstleistung ausfüllt."
            defaultFormName={`Auftraggeberformular: ${template.name}`}
            renderFieldsEditor={(f) => <FormFieldsEditor form={f} />}
          />
        </TabsContent>

        <TabsContent value="employee_form" className="mt-4">
          <RoleFormTab
            template={template}
            metaKey="employee_form_id"
            title="Messdienstleisterformular"
            description="Formular, das der Messdienstleister bei der Ausführung ausfüllt."
            defaultFormName={`Messdienstleisterformular: ${template.name}`}
            renderFieldsEditor={(f) => <FormFieldsEditor form={f} />}
          />
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <ReportTemplateDesigner template={template} />
        </TabsContent>


        <TabsContent value="calc" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" />Berechnungen</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Dieser Tab ist vorbereitet für Formeldefinitionen und berechnete Felder auf Dienstleistungs-Ebene.</p>
              <p>Formel-Editor und Feldreferenzen werden im nächsten Schritt hier integriert.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <ServicePreviewTab template={template} />
        </TabsContent>

        <TabsContent value="steps" className="mt-4">
          <div className="grid grid-cols-12 gap-4">
            {/* Steps list */}
            <Card className="col-span-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm">Schritte</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => addStepMut.mutate()}><Plus className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {steps.length === 0 && <div className="text-xs text-muted-foreground p-2">Noch keine Schritte.</div>}
                {steps.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-1 rounded px-2 py-2 cursor-pointer ${selectedStepId === s.id ? "bg-primary/10" : "hover:bg-muted"}`} onClick={() => setSelectedStepId(s.id)}>
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{i + 1}. {s.name}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveMut.mutate({ id: s.id, dir: -1 }); }}><ArrowUp className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === steps.length - 1} onClick={(e) => { e.stopPropagation(); moveMut.mutate({ id: s.id, dir: 1 }); }}><ArrowDown className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); if (confirm(`Schritt „${s.name}" löschen?`)) deleteStepMut.mutate(s.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Step editor */}
            <div className="col-span-6">
              {selectedStep ? <StepEditor step={selectedStep} onSaved={invalidateSteps} /> : (
                <Card><CardContent className="pt-6 text-sm text-muted-foreground text-center">Bitte einen Schritt links auswählen oder anlegen.</CardContent></Card>
              )}
            </div>

            {/* Snippets palette */}
            <Card className="col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Puzzle className="h-4 w-4" />Snippets</CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1">
                {snippets.length === 0 && <div className="text-xs text-muted-foreground p-2">Keine Snippets für Modus {template.kind}.</div>}
                {snippets.map(sn => (
                  <button key={sn.id} className="w-full text-left rounded border px-2 py-2 text-sm hover:bg-muted"
                    onClick={() => insertSnippetMut.mutate(sn)} title={sn.description || ""}>
                    <div className="font-medium truncate">{sn.name}</div>
                    {sn.category && <div className="text-xs text-muted-foreground">{sn.category}</div>}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Template Meta ----------------
function TemplateMetaEditor({ template, onSave }: { template: ProcessTemplate; onSave: (u: Partial<ProcessTemplate>) => void }) {
  const meta = (template.metadata ?? {}) as Record<string, any>;
  const [name, setName] = useState(template.name);
  const [desc, setDesc] = useState(template.description ?? "");
  const [category, setCategory] = useState(template.category ?? "");
  const [isActive, setIsActive] = useState(template.is_active);
  const [responsible, setResponsible] = useState<string>(meta.responsible ?? "");
  const [billing, setBilling] = useState<string>(meta.billing ?? "");
  const [duration, setDuration] = useState<string>(meta.duration ?? "");
  const [cost, setCost] = useState<string>(meta.cost ?? "");
  return (
    <Card><CardContent className="pt-6 space-y-4 max-w-3xl">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div><Label>Kategorie</Label><Input value={category} onChange={e => setCategory(e.target.value)} /></div>
      </div>
      <div><Label>Beschreibung</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Verantwortlicher</Label><Input value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="z. B. Abteilungsleiter Labor" /></div>
        <div><Label>Abrechnung</Label><Input value={billing} onChange={e => setBilling(e.target.value)} placeholder="z. B. pauschal, pro Stunde" /></div>
        <div><Label>Dauer</Label><Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="z. B. 2 h" /></div>
        <div><Label>Kosten</Label><Input value={cost} onChange={e => setCost(e.target.value)} placeholder="z. B. 250 €" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Version</Label><Input value={`v${template.version}`} disabled /></div>
        <div className="flex items-end gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Aktiv</Label></div>
      </div>
      <Button onClick={() => onSave({
        name: name.trim(),
        description: desc.trim() || null,
        category: category.trim() || null,
        is_active: isActive,
        metadata: {
          ...(template.metadata ?? {}),
          responsible: responsible.trim() || undefined,
          billing: billing.trim() || undefined,
          duration: duration.trim() || undefined,
          cost: cost.trim() || undefined,
        },
      } as any)}>Speichern</Button>
    </CardContent></Card>
  );
}


// ---------------- Step Editor ----------------
function StepEditor({ step, onSaved }: { step: ProcessStep; onSaved: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(step.name);
  const [stepKey, setStepKey] = useState(step.step_key);
  const [desc, setDesc] = useState(step.description ?? "");
  const [role, setRole] = useState(step.role_required ?? "any");
  const [mandatory, setMandatory] = useState(step.is_mandatory);
  const [positionSource, setPositionSource] = useState<string>(step.position_source ?? "none");

  // Sync when step changes
  useMemo(() => { setName(step.name); setStepKey(step.step_key); setDesc(step.description ?? ""); setRole(step.role_required ?? "any"); setMandatory(step.is_mandatory); setPositionSource(step.position_source ?? "none"); }, [step.id]);

  const saveMut = useMutation({
    mutationFn: () => api.processTemplateSteps.update(step.id, {
      name: name.trim(), step_key: stepKey.trim() || slugify(name),
      description: desc.trim() || null,
      role_required: role === "any" ? null : role,
      is_mandatory: mandatory,
      position_source: positionSource === "none" ? null : positionSource,
    }),
    onSuccess: () => { toast.success("Gespeichert"); onSaved(); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const { data: form } = useQuery({
    queryKey: ["step-form", step.id, step.form_id],
    queryFn: () => step.form_id ? api.formDefinitions.get(step.form_id) : Promise.resolve(null),
  });

  const createFormMut = useMutation({
    mutationFn: async () => {
      // Neu angelegte Formulare landen direkt in der globalen Bibliothek,
      // damit sie in weiteren Prozessschritten wiederverwendet werden können.
      const f = await api.formDefinitions.create({ name: `Formular: ${step.name}`, scope: "global" });
      await api.processTemplateSteps.update(step.id, { form_id: f.id });
      return f;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["step-form", step.id] }); qc.invalidateQueries({ queryKey: ["process-steps"] }); qc.invalidateQueries({ queryKey: ["form-definitions"] }); onSaved(); toast.success("Formular angelegt"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  // Alle vorhandenen Formularvorlagen zur Verknüpfung anbieten (global + template-eigene),
  // damit im Service/Prozess-Designer angelegte Formulare hier ausgewählt werden können.
  const { data: allForms = [] } = useQuery({
    queryKey: ["form-definitions", "all"],
    queryFn: () => api.formDefinitions.list(),
  });
  const linkableForms = allForms.filter(f => f.id !== step.form_id);

  const linkFormMut = useMutation({
    mutationFn: async (formId: string) => api.processTemplateSteps.update(step.id, { form_id: formId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["step-form", step.id] }); qc.invalidateQueries({ queryKey: ["process-steps"] }); onSaved(); toast.success("Formular verknüpft"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const unlinkFormMut = useMutation({
    mutationFn: async () => api.processTemplateSteps.update(step.id, { form_id: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["step-form", step.id] }); qc.invalidateQueries({ queryKey: ["process-steps"] }); onSaved(); toast.success("Verknüpfung aufgehoben"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Schritt bearbeiten</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Schlüssel</Label><Input value={stepKey} onChange={e => setStepKey(e.target.value)} /></div>
        </div>
        <div><Label>Beschreibung</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Rolle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Beliebig</SelectItem>
                <SelectItem value="auftraggeber">Auftraggeber</SelectItem>
                <SelectItem value="durchfuehrer">Durchführer</SelectItem>
                <SelectItem value="master">Master</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Positionsquelle</Label>
            <Select value={positionSource} onValueChange={setPositionSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine (Einzel-Schritt)</SelectItem>
                <SelectItem value="samples">Pro Probe</SelectItem>
                <SelectItem value="mouthpieces">Pro Mundstück</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2"><Switch checked={mandatory} onCheckedChange={setMandatory} /><Label>Pflicht</Label></div>
        </div>
        <div className="flex justify-end"><Button onClick={() => saveMut.mutate()}>Schritt speichern</Button></div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><FormInput className="h-4 w-4" />Formular</h3>
            {step.form_id && (
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Formular-Verknüpfung aufheben? Das Formular selbst bleibt erhalten.")) unlinkFormMut.mutate(); }}>
                Verknüpfung aufheben
              </Button>
            )}
          </div>

          {!step.form_id && (
            <div className="space-y-3 rounded border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Vorhandenes Formular aus dem Service Designer verknüpfen (bevorzugt — vermeidet Duplikate)
                oder neues, schritt-eigenes Formular anlegen.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select onValueChange={(v) => v && linkFormMut.mutate(v)}>
                  <SelectTrigger className="w-72"><SelectValue placeholder="Vorhandenes Formular verknüpfen…" /></SelectTrigger>
                  <SelectContent>
                    {linkableForms.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Keine Formulare vorhanden.</div>}
                    {linkableForms.map(gf => (
                      <SelectItem key={gf.id} value={gf.id}>
                        {gf.name} · v{gf.version}{gf.scope === "global" ? " · global" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">oder</span>
                <Button size="sm" variant="outline" onClick={() => createFormMut.mutate()}>
                  <Plus className="h-4 w-4 mr-1" />Neues Formular
                </Button>
              </div>
            </div>
          )}

          {step.form_id && form && (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Verknüpftes Formular: <span className="font-medium">{form.name}</span>
                {form.scope === "global" && <Badge variant="outline" className="ml-2 text-xs">Global (Service Designer)</Badge>}
              </div>
              <FormFieldsEditor form={form} />
            </>
          )}
        </div>

        <div className="border-t pt-4">
          <ProcessStepRawMaterials stepId={step.id} />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Form Fields Editor ----------------
function FormFieldsEditor({ form }: { form: FormDefinition }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormFieldType>("text");
  const [editingField, setEditingField] = useState<FormField | null>(null);

  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["form-fields", form.id] });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!newLabel.trim()) throw new Error("Bezeichnung erforderlich");
      const key = slugify(newLabel);
      const sort = (fields.at(-1)?.sort_order ?? -1) + 1;
      return api.formFields.create({
        form_id: form.id, field_key: key, display_name: newLabel.trim(), field_type: newType, sort_order: sort,
      });
    },
    onSuccess: () => { invalidate(); setAddOpen(false); setNewLabel(""); setNewType("text"); toast.success("Feld hinzugefügt"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.formFields.remove(id),
    onSuccess: () => { invalidate(); toast.success("Feld entfernt"); },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">Formular: <span className="font-medium">{form.name}</span></div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setPickerOpen(true)}><Boxes className="h-4 w-4 mr-1" />Globales Feld</Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Lokales Feld</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Neue Felder werden bevorzugt aus der globalen Feldbibliothek referenziert — das Formular speichert dann nur
        Position, Sichtbarkeit, Pflicht und Layout. Lokale Felder bleiben für Bestandsformulare weiterhin möglich.
      </p>

      {fields.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center border rounded">Noch keine Felder.</div>}

      <div className="space-y-1">
        {fields.map(f => (
          <div key={f.id} className="flex items-center gap-2 border rounded px-2 py-1.5 hover:bg-muted/40">
            <span className="flex-1 text-sm"><span className="font-medium">{f.display_name}</span> <span className="text-muted-foreground text-xs">({f.field_key})</span></span>
            {f.global_field_id && (
              <Badge variant="secondary" className="text-xs font-mono" title="Referenz auf globales Feld">
                {f.binding_path ?? "global"}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">{ALL_TYPES.find(t => t.value === f.field_type)?.label ?? f.field_type}</Badge>
            {f.is_required && <Badge variant="secondary" className="text-xs">Pflicht</Badge>}
            {f.unit && <Badge variant="outline" className="text-xs">{f.unit}</Badge>}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingField(f)}><FormInput className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm(`Feld „${f.display_name}" entfernen?`)) removeMut.mutate(f.id); }}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      <GlobalFieldPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        formId={form.id}
        existing={fields}
        onInserted={invalidate}
      />


      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neues Feld</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bezeichnung</Label><Input value={newLabel} onChange={e => setNewLabel(e.target.value)} autoFocus /></div>
            <div>
              <Label>Typ</Label>
              <Select value={newType} onValueChange={(v: FormFieldType) => setNewType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-96">
                  {FIELD_TYPE_GROUPS.map(g => (
                    <div key={g.label}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{g.label}</div>
                      {g.types.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
            <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !newLabel.trim()}>Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingField && <FieldEditDialog field={editingField} onClose={() => setEditingField(null)} onSaved={invalidate} />}
    </div>
  );
}

// ---------------- Field Detail Editor ----------------
function FieldEditDialog({ field, onClose, onSaved }: { field: FormField; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(field.display_name);
  const [key, setKey] = useState(field.field_key);
  const [desc, setDesc] = useState(field.description ?? "");
  const [unit, setUnit] = useState(field.unit ?? "");
  const [required, setRequired] = useState(field.is_required);
  const [readonly, setReadonly] = useState(field.readonly);
  const [defaultValue, setDefaultValue] = useState(field.default_value ?? "");
  const [formula, setFormula] = useState(field.formula ?? "");
  const [selectOptions, setSelectOptions] = useState((field.select_options ?? []).map(o => typeof o === "string" ? o : o.label).join("\n"));
  const [decimalPlaces, setDecimalPlaces] = useState(field.decimal_places?.toString() ?? "");
  const [minV, setMinV] = useState(field.min_value?.toString() ?? "");
  const [maxV, setMaxV] = useState(field.max_value?.toString() ?? "");

  const isNumeric = ["number", "decimal", "percent"].includes(field.field_type);
  const isGlobalRef = !!field.global_field_id;
  const isSelect = ["select", "multiselect"].includes(field.field_type);
  const isComputed = field.field_type === "computed";

  const saveMut = useMutation({
    mutationFn: () => api.formFields.update(field.id, {
      display_name: label.trim(),
      field_key: key.trim() || slugify(label),
      description: desc.trim() || null,
      unit: unit.trim() || null,
      is_required: required,
      readonly,
      default_value: defaultValue.trim() || null,
      formula: isComputed ? (formula.trim() || null) : null,
      select_options: isSelect ? selectOptions.split("\n").map(l => l.trim()).filter(Boolean) : [],
      decimal_places: isNumeric && decimalPlaces ? parseInt(decimalPlaces, 10) : null,
      min_value: isNumeric && minV ? parseFloat(minV) : null,
      max_value: isNumeric && maxV ? parseFloat(maxV) : null,
    }),
    onSuccess: () => { toast.success("Gespeichert"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isGlobalRef ? "Feld-Ansicht (globales Feld)" : "Feld bearbeiten"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {isGlobalRef && (
            <div className="rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
              Dieses Feld referenziert das globale Feld{" "}
              <span className="font-mono text-foreground">{field.binding_path ?? field.field_key}</span>.
              Die Definition wird zentral in der Feldbibliothek gepflegt — hier werden nur Ansicht und
              Verhalten im Formular (Pflicht, Read-only, Standardwert) festgelegt.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bezeichnung</Label><Input value={label} disabled={isGlobalRef} onChange={e => setLabel(e.target.value)} /></div>
            <div><Label>Schlüssel</Label><Input value={key} disabled={isGlobalRef} onChange={e => setKey(e.target.value)} /></div>
          </div>
          <div><Label>Beschreibung</Label><Textarea value={desc} disabled={isGlobalRef} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Einheit</Label><Input value={unit} disabled={isGlobalRef} onChange={e => setUnit(e.target.value)} placeholder="z.B. mm, °C" /></div>

            <div className="flex items-end gap-2"><Switch checked={required} onCheckedChange={setRequired} /><Label>Pflicht</Label></div>
            <div className="flex items-end gap-2"><Switch checked={readonly} onCheckedChange={setReadonly} /><Label>Read-only</Label></div>
          </div>
          {!isComputed && <div><Label>Standardwert</Label><Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} /></div>}
          {isNumeric && (
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Min</Label><Input value={minV} onChange={e => setMinV(e.target.value)} type="number" /></div>
              <div><Label>Max</Label><Input value={maxV} onChange={e => setMaxV(e.target.value)} type="number" /></div>
              <div><Label>Nachkommast.</Label><Input value={decimalPlaces} onChange={e => setDecimalPlaces(e.target.value)} type="number" /></div>
            </div>
          )}
          {isSelect && (
            <div>
              <Label>Optionen (eine je Zeile)</Label>
              <Textarea value={selectOptions} disabled={isGlobalRef} onChange={e => setSelectOptions(e.target.value)} rows={5} />
            </div>
          )}
          {isComputed && (
            <div>
              <Label>Formel</Label>
              <Textarea value={formula} disabled={isGlobalRef} onChange={e => setFormula(e.target.value)} rows={3} placeholder="z.B. ROUND((laenge * breite) / 100, 2)" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Verfügbare Funktionen: SUM, AVERAGE, MIN, MAX, ROUND, ABS, IF. Referenzen: `feld_key`.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => saveMut.mutate()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Global Form Library ----------------
function FormPreviewTab({ form }: { form: FormDefinition }) {
  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });
  const layout = normalizeLayout((form as any).layout);
  return (
    <div className="border rounded p-4 bg-background">
      <FormLayoutRenderer layout={layout} fields={fields} />
    </div>
  );
}

function GlobalFormLibrary() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["form-definitions", "all"],
    queryFn: () => api.formDefinitions.list(),
  });

  const createMut = useMutation({
    mutationFn: () => api.formDefinitions.create({ name: newName.trim(), scope: "global" }),
    onSuccess: (f) => {
      toast.success("Formular angelegt");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["form-definitions"] });
      setSelectedFormId(f.id);
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.formDefinitions.remove(id),
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["form-definitions"] });
      setSelectedFormId(null);
    },
    onError: (e: any) => toast.error(e.message || "Löschen fehlgeschlagen"),
  });

  const selectedForm = forms.find(f => f.id === selectedFormId) ?? null;

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Globale Formulare</CardTitle>
          <p className="text-xs text-muted-foreground">Wiederverwendbar über alle Prozessvorlagen hinweg.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Neuer Formularname" />
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {isLoading && <div className="text-xs text-muted-foreground">Lade…</div>}
          {!isLoading && forms.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center border rounded">Noch keine globalen Formulare.</div>}
          <div className="space-y-1">
            {forms.map(f => (
              <div key={f.id} className={`flex items-center gap-1 rounded px-2 py-2 cursor-pointer ${selectedFormId === f.id ? "bg-primary/10" : "hover:bg-muted"}`} onClick={() => setSelectedFormId(f.id)}>
                <span className="flex-1 text-sm truncate">{f.name}</span>
                <Badge variant="outline" className="text-xs">{f.scope === "global" ? "global" : "Vorlage"}</Badge>
                <Badge variant="outline" className="text-xs">v{f.version}</Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); if (confirm(`Formular „${f.name}" löschen?`)) removeMut.mutate(f.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="col-span-8">
        {selectedForm ? (
          <Card>
            <CardHeader><CardTitle className="text-sm">{selectedForm.name}</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="fields">
                <TabsList>
                  <TabsTrigger value="fields">Felder</TabsTrigger>
                  <TabsTrigger value="layout">Formular-Designer</TabsTrigger>
                  <TabsTrigger value="roles">Rollenansichten</TabsTrigger>
                  <TabsTrigger value="preview">Vorschau</TabsTrigger>
                </TabsList>
                <TabsContent value="fields" className="mt-3">
                  <FormFieldsEditor form={selectedForm} />
                </TabsContent>
                <TabsContent value="layout" className="mt-3">
                  <FormLayoutDesigner form={selectedForm} canManage={true} />
                </TabsContent>
                <TabsContent value="roles" className="mt-3">
                  <RoleViewsDesigner form={selectedForm} canManage={true} />
                </TabsContent>
                <TabsContent value="preview" className="mt-3">
                  <FormPreviewTab form={selectedForm} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground text-center">Bitte ein Formular links auswählen oder anlegen.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
