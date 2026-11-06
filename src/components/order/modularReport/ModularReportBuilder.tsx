import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, FileDown, Save, FolderOpen, LayoutList } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { docT } from "@/lib/customerDocumentation/i18n";
import type { RawMeasurementRow } from "@/lib/orderResultsAggregation";
import type { OrderReport } from "@/lib/api/orderReports";
import {
  moveModule, sanitizeDraft, updateModule, sanitizeLayout,
  type ModuleConfig, type OrderReportDraft, type ReportLanguage, type ReportLayout,
} from "@/lib/modularReport/config";
import { buildReport } from "@/lib/modularReport/build";
import { exportReportPdf } from "@/lib/modularReport/pdf";
import { loadTemplates } from "@/lib/modularReport/templates";
import { ReportPreview } from "./ReportPreview";
import { TemplateManagerDialog } from "./TemplateManagerDialog";

const moduleName = (key: string) => String(docT("de")(`modular_report.modules.${key}`));

export function ModularReportBuilder({ order, report, canSave }: { order: any; report: OrderReport; canSave: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState<OrderReportDraft>(() => sanitizeDraft((report.draft_overrides as any)?.modular_report));
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [templates, setTemplates] = useState(() => loadTemplates(user?.id));

  useEffect(() => {
    setDraft(sanitizeDraft((report.draft_overrides as any)?.modular_report));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);
  useEffect(() => setTemplates(loadTemplates(user?.id)), [user?.id]);

  // Gleiche Quelle/Cache wie „Offizielle Ergebnisse“ – immer der aktuelle Auftrag.
  const { data: resultRows = [], isLoading } = useQuery({
    queryKey: ["order-results-overview", order.id],
    queryFn: () => api.orderSamples.resultsOverview(order.id) as Promise<RawMeasurementRow[]>,
    enabled: !!order.id,
  });

  const rendered = useMemo(
    () => buildReport({ order, resultRows: resultRows as RawMeasurementRow[], draft }),
    [order, resultRows, draft]
  );

  const change = (next: OrderReportDraft) => { setDraft(next); setDirty(true); };
  const setLayout = (layout: ReportLayout) => change({ ...draft, layout });
  const patchModule = (key: ModuleConfig["key"], patch: Partial<Omit<ModuleConfig, "key">>) =>
    setLayout(updateModule(draft.layout, key, patch));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = draft.layout.modules.map((m) => m.key as string);
    setLayout(moveModule(draft.layout, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };

  const save = useMutation({
    mutationFn: () => api.orderReports.saveModularDraft(report.id, draft),
    onSuccess: () => {
      setDirty(false);
      toast.success("Berichtsentwurf gespeichert");
      qc.invalidateQueries({ queryKey: ["order-report", order.id] });
    },
    onError: (e: any) => toast.error("Entwurf konnte nicht gespeichert werden", { description: e.message }),
  });

  const [exporting, setExporting] = useState(false);
  const exportPdf = async () => {
    setExporting(true);
    try {
      const safeNo = String(order.order_number ?? "auftrag").replace(/[^\w.-]+/g, "_");
      await exportReportPdf(rendered, `Ergebnisbericht_${safeNo}_${draft.lang.toUpperCase()}.pdf`);
    } catch (e: any) {
      toast.error("PDF konnte nicht erzeugt werden", { description: e?.message ?? String(e) });
    } finally {
      setExporting(false);
    }
  };

  const applyTemplate = (layout: ReportLayout) => {
    // Nur Struktur/Standardtexte übernehmen; auftragsspezifische Texte bleiben
    // die des aktuellen Auftrags, Daten werden ohnehin neu geladen.
    change({ ...draft, layout: sanitizeLayout(layout) });
    toast.success("Vorlage geladen");
  };

  const hidden = draft.layout.modules.filter((m) => !m.visible);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutList className="h-4 w-4" /> Modularer Ergebnisbericht
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Aus den aktuellen Daten dieses Auftrags zusammengestellt; Ergebnisse ausschließlich offiziell. PDF wird direkt im Programm erzeugt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setTplOpen(true)}>
              <FolderOpen className="h-4 w-4 mr-1" /> Persönliche Vorlagen
            </Button>
            {canSave && (
              <Button variant="outline" size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Speichere …" : "Entwurf speichern"}
              </Button>
            )}
            <Button size="sm" onClick={exportPdf} disabled={exporting || isLoading}>
              <FileDown className="h-4 w-4 mr-1" /> {exporting ? "Erzeuge …" : "PDF erzeugen"}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Berichtssprache</Label>
            <Select value={draft.lang} onValueChange={(v) => change({ ...draft, lang: v as ReportLanguage })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mr-title">Berichtstitel</Label>
            <Input id="mr-title" value={draft.reportTitle} placeholder={String(docT(draft.lang)("modular_report.default_title"))}
              onChange={(e) => change({ ...draft, reportTitle: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mr-author">Bearbeiter (optional)</Label>
            <Input id="mr-author" value={draft.author} onChange={(e) => change({ ...draft, author: e.target.value })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium">Module (Reihenfolge = PDF-Reihenfolge)</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={draft.layout.modules.filter((m) => m.visible).map((m) => m.key)} strategy={verticalListSortingStrategy}>
              {draft.layout.modules.filter((m) => m.visible).map((m) => (
                <ModuleRow key={m.key} m={m} lang={draft.lang} expanded={open === m.key}
                  onToggle={() => setOpen(open === m.key ? null : m.key)}
                  onPatch={(p) => patchModule(m.key, p)}
                  orderText={draft.orderTexts[m.key] ?? ""}
                  onOrderText={(v) => change({ ...draft, orderTexts: { ...draft.orderTexts, [m.key]: v } })} />
              ))}
            </SortableContext>
          </DndContext>
          {hidden.length > 0 && (
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <div className="text-xs text-muted-foreground">Ausgeblendete Module – zum Hinzufügen anklicken:</div>
              <div className="flex flex-wrap gap-2">
                {hidden.map((m) => (
                  <Button key={m.key} variant="secondary" size="sm" onClick={() => patchModule(m.key, { visible: true })}>
                    + {moduleName(m.key)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Vorschau</div>
          {isLoading ? <p className="text-sm text-muted-foreground">Daten werden geladen …</p> : <ReportPreview report={rendered} />}
        </div>
      </CardContent>
      <TemplateManagerDialog open={tplOpen} onOpenChange={setTplOpen} userId={user?.id ?? null}
        templates={templates} setTemplates={setTemplates} currentLayout={draft.layout} onApply={applyTemplate} />
    </Card>
  );
}

function ModuleRow({ m, lang, expanded, onToggle, onPatch, orderText, onOrderText }: {
  m: ModuleConfig; lang: ReportLanguage; expanded: boolean; onToggle: () => void;
  onPatch: (p: Partial<Omit<ModuleConfig, "key">>) => void; orderText: string; onOrderText: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.key });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const defaultHeading = (l: ReportLanguage) => String(docT(l)(`modular_report.modules.${m.key}`));
  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-card">
      <div className="flex items-center gap-2 p-2">
        <button type="button" className="cursor-grab text-muted-foreground" aria-label="Modul verschieben" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm font-medium" onClick={onToggle}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {(m.heading[lang] || "").trim() || defaultHeading(lang)}
        </button>
        <Switch checked={m.visible} onCheckedChange={(v) => onPatch({ visible: v })} aria-label="Modul anzeigen" />
      </div>
      {expanded && (
        <div className="space-y-3 border-t p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["de", "en"] as const).map((l) => (
              <div key={l} className="space-y-1">
                <Label className="text-xs">Überschrift {l.toUpperCase()}</Label>
                <Input value={m.heading[l]} placeholder={defaultHeading(l)}
                  onChange={(e) => onPatch({ heading: { ...m.heading, [l]: e.target.value } })} />
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["de", "en"] as const).map((l) => (
              <div key={l} className="space-y-1">
                <Label className="text-xs">Standardtext {l.toUpperCase()} (in Vorlage speicherbar)</Label>
                <Textarea rows={3} value={m.standardText[l]}
                  onChange={(e) => onPatch({ standardText: { ...m.standardText, [l]: e.target.value } })} />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Auftragsspezifischer Text (nur dieser Auftrag)</Label>
            <Textarea rows={3} value={orderText} onChange={(e) => onOrderText(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Wird unverändert in der eingegebenen Sprache ausgegeben – keine automatische Übersetzung.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
