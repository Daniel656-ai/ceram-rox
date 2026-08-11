import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProcessTemplate } from "@/lib/api/processTemplates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Heading1, Type, Table as TableIcon, Image as ImageIcon, QrCode, Barcode,
  Minus, PenTool, Trash2, Plus, Repeat, FileImage, GripVertical, Tag as TagIcon,
  PanelTop, PanelBottom, Save, Eye, Code2, EyeOff,
} from "lucide-react";
import { replaceTokens, resolvePath, SAMPLE_SNAPSHOT, formatPlaceholderValue } from "@/lib/reportPlaceholders";
import ReportFieldPicker from "./ReportFieldPicker";
import { useReportFieldCatalog } from "@/hooks/useReportFieldCatalog";
import {
  resolveReportPath, formatReportValue, sampleValueFor,
  type ReportFieldGroup, type ReportFieldItem, type ReportNumberFormat,
} from "@/lib/reportFieldCatalog";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---------- Block-Schema ----------
export type ReportBlock =
  | { id: string; type: "heading"; text: string; level: 1 | 2 | 3 }
  | { id: string; type: "text"; content: string }
  | {
      id: string; type: "field";
      /** Pfad in der bestehenden Datenquelle, z.B. "customer_form.v2o5". */
      path: string;
      /** Anzeigename – frei überschreibbar. */
      label: string;
      /** Herkunft (nur Anzeige). */
      sourceLabel?: string;
      format?: ReportNumberFormat;
      unit?: string | null;
      showUnit?: boolean;
      hideIfEmpty?: boolean;
      hidden?: boolean;
      inline?: boolean;
    }
  | { id: string; type: "table"; title?: string; columns: { header: string; value: string }[]; rows: string[][] }
  | { id: string; type: "repeater"; title?: string; sourcePath: string; columns: { header: string; path: string }[] }
  | { id: string; type: "image"; dataUrl?: string; caption?: string; widthPercent?: number }
  | { id: string; type: "logo" }
  | { id: string; type: "qr"; content: string; label?: string }
  | { id: string; type: "barcode"; content: string; label?: string }
  | { id: string; type: "pagebreak" }
  | { id: string; type: "signature"; label: string };

export interface ReportTemplate {
  header?: string;
  footer?: string;
  orientation?: "portrait" | "landscape";
  blocks: ReportBlock[];
}

const EMPTY: ReportTemplate = { header: "", footer: "Seite {{Version}} · {{Firma}}", orientation: "portrait", blocks: [] };

function uid() { return Math.random().toString(36).slice(2, 10); }

const BLOCK_LIBRARY: { type: Exclude<ReportBlock["type"], "field">; label: string; icon: any; make: () => ReportBlock }[] = [
  { type: "heading", label: "Überschrift", icon: Heading1, make: () => ({ id: uid(), type: "heading", text: "Neue Überschrift", level: 2 }) },
  { type: "text", label: "Text / Absatz", icon: Type, make: () => ({ id: uid(), type: "text", content: "Text mit {{Auftragsnummer}} und {{Kunde}}." }) },
  { type: "table", label: "Tabelle (statisch)", icon: TableIcon, make: () => ({ id: uid(), type: "table", title: "Tabelle", columns: [{ header: "Feld", value: "" }, { header: "Wert", value: "" }], rows: [["", ""]] }) },
  { type: "repeater", label: "Repeater (dynamisch)", icon: Repeat, make: () => ({ id: uid(), type: "repeater", title: "Messwerte", sourcePath: "measurement_result", columns: [{ header: "Messung", path: "measurement" }, { header: "Ergebnis", path: "result_name" }, { header: "Wert", path: "value" }, { header: "Einheit", path: "unit" }] }) },
  { type: "image", label: "Bild", icon: ImageIcon, make: () => ({ id: uid(), type: "image", widthPercent: 60 }) },
  { type: "logo", label: "Firmenlogo", icon: FileImage, make: () => ({ id: uid(), type: "logo" }) },
  { type: "qr", label: "QR-Code", icon: QrCode, make: () => ({ id: uid(), type: "qr", content: "{{Auftragsnummer}}", label: "" }) },
  { type: "barcode", label: "Barcode", icon: Barcode, make: () => ({ id: uid(), type: "barcode", content: "{{Auftragsnummer}}", label: "" }) },
  { type: "pagebreak", label: "Seitenumbruch", icon: Minus, make: () => ({ id: uid(), type: "pagebreak" }) },
  { type: "signature", label: "Unterschrift", icon: PenTool, make: () => ({ id: uid(), type: "signature", label: "Unterschrift" }) },
];

const FORMAT_OPTIONS: { value: ReportNumberFormat; label: string }[] = [
  { value: "auto", label: "Automatisch" },
  { value: "0", label: "Ganzzahl (0)" },
  { value: "0.0", label: "1 Nachkommastelle (0,0)" },
  { value: "0.00", label: "2 Nachkommastellen (0,00)" },
  { value: "0.000", label: "3 Nachkommastellen (0,000)" },
  { value: "date", label: "Datum" },
  { value: "datetime", label: "Datum & Uhrzeit" },
  { value: "time", label: "Uhrzeit" },
];

function makeFieldBlock(item: ReportFieldItem): ReportBlock {
  if (item.kind === "repeater") {
    const cols = (item.subfields ?? []).map((s) => ({ header: s.label, path: s.key }));
    return {
      id: uid(), type: "repeater", title: item.label, sourcePath: item.path,
      columns: cols.length ? cols : [{ header: "Wert", path: "value" }],
    };
  }
  return {
    id: uid(), type: "field", path: item.path, label: item.label,
    sourceLabel: item.sourceLabel, format: "auto", unit: item.unit ?? null,
    showUnit: !!item.unit, hideIfEmpty: false, hidden: false, inline: true,
  };
}


// ---------- Designer-Komponente ----------
export default function ReportTemplateDesigner({ template }: { template: ProcessTemplate }) {
  const initial: ReportTemplate = ((template.metadata as any)?.report_template as ReportTemplate | undefined) ?? EMPTY;
  const [doc, setDoc] = useState<ReportTemplate>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.blocks[0]?.id ?? null);
  const [mode, setMode] = useState<"design" | "preview">("design");

  const save = useMutation({
    mutationFn: () => api.processTemplates.update(template.id, {
      metadata: { ...(template.metadata ?? {}), report_template: doc } as any,
    } as any),
    onSuccess: () => toast.success("Berichtsvorlage gespeichert"),
    onError: (e: any) => toast.error(e.message || "Speichern fehlgeschlagen"),
  });

  const selected = doc.blocks.find(b => b.id === selectedId) ?? null;

  const { data: catalog = [], isLoading: catalogLoading } = useReportFieldCatalog(template.id);
  const repeaterOptions = useMemo(
    () => catalog.flatMap(g => g.items.filter(i => i.kind === "repeater")),
    [catalog]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const addBlock = (type: Exclude<ReportBlock["type"], "field">) => {
    const factory = BLOCK_LIBRARY.find(b => b.type === type)!;
    const nb = factory.make();
    setDoc(d => ({ ...d, blocks: [...d.blocks, nb] }));
    setSelectedId(nb.id);
  };
  const updateBlock = (id: string, patch: Partial<ReportBlock>) => {
    setDoc(d => ({ ...d, blocks: d.blocks.map(b => b.id === id ? { ...b, ...patch } as ReportBlock : b) }));
  };
  const removeBlock = (id: string) => {
    setDoc(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDoc(d => {
      const from = d.blocks.findIndex(b => b.id === active.id);
      const to = d.blocks.findIndex(b => b.id === over.id);
      if (from < 0 || to < 0) return d;
      return { ...d, blocks: arrayMove(d.blocks, from, to) };
    });
  };
  const insertFieldBlock = (item: ReportFieldItem) => {
    const nb = makeFieldBlock(item);
    setDoc(d => {
      const idx = d.blocks.findIndex(b => b.id === selectedId);
      const blocks = [...d.blocks];
      blocks.splice(idx >= 0 ? idx + 1 : blocks.length, 0, nb);
      return { ...d, blocks };
    });
    setSelectedId(nb.id);
  };
  const insertToken = (item: ReportFieldItem) => {
    if (!selected || (selected.type !== "text" && selected.type !== "heading" && selected.type !== "qr" && selected.type !== "barcode")) {
      toast.info("Bitte zuerst einen Text-, Überschrift-, QR- oder Barcode-Baustein auswählen");
      return;
    }
    insertTokenIntoBlock(selected, `{{${item.path}}}`, (p) => updateBlock(selected.id, p));
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <ReportFieldPicker
            groups={catalog}
            isLoading={catalogLoading}
            onInsertField={insertFieldBlock}
            onInsertToken={insertToken}
          />
          <Separator orientation="vertical" className="h-6" />
          {BLOCK_LIBRARY.map(({ type, label, icon: Icon }) => (
            <Button key={type} size="sm" variant="outline" onClick={() => addBlock(type)}>
              <Icon className="h-3.5 w-3.5 mr-1" />{label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant={mode === "design" ? "default" : "outline"} onClick={() => setMode("design")}>
              <Code2 className="h-3.5 w-3.5 mr-1" />Design
            </Button>
            <Button size="sm" variant={mode === "preview" ? "default" : "outline"} onClick={() => setMode("preview")}>
              <Eye className="h-3.5 w-3.5 mr-1" />Vorschau
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" />Speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      {mode === "design" ? (
        <div className="grid grid-cols-12 gap-3">
          {/* Kopf / Fuß / Ausrichtung */}
          <Card className="col-span-12">
            <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><PanelTop className="h-3 w-3" />Seitenkopf</Label>
                <Input value={doc.header ?? ""} onChange={(e) => setDoc(d => ({ ...d, header: e.target.value }))} placeholder="Optionaler Kopftext (Platzhalter erlaubt)" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><PanelBottom className="h-3 w-3" />Seitenfuß</Label>
                <Input value={doc.footer ?? ""} onChange={(e) => setDoc(d => ({ ...d, footer: e.target.value }))} placeholder="z.B. Seite {{Version}} · {{Firma}}" />
              </div>
              <div>
                <Label className="text-xs">Ausrichtung</Label>
                <Select value={doc.orientation ?? "portrait"} onValueChange={(v: any) => setDoc(d => ({ ...d, orientation: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Hochformat</SelectItem>
                    <SelectItem value="landscape">Querformat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Blockliste (frei sortierbar) */}
          <Card className="col-span-12 md:col-span-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bausteine</CardTitle>
              <p className="text-[11px] text-muted-foreground">Reihenfolge per Drag &amp; Drop frei anpassbar.</p>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {doc.blocks.length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  Noch keine Bausteine. Fügen Sie oben Felder oder Bausteine hinzu.
                </div>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={doc.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {doc.blocks.map((b, i) => (
                    <SortableBlockRow
                      key={b.id}
                      block={b}
                      index={i}
                      selected={selectedId === b.id}
                      onSelect={() => setSelectedId(b.id)}
                      onRemove={() => removeBlock(b.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>

          {/* Inspector */}
          <Card className="col-span-12 md:col-span-7">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Eigenschaften</CardTitle>
              <ReportFieldPicker
                groups={catalog}
                isLoading={catalogLoading}
                onInsertField={insertFieldBlock}
                onInsertToken={insertToken}
              />
            </CardHeader>
            <CardContent className="p-3">
              {!selected ? (
                <div className="text-sm text-muted-foreground">Kein Baustein ausgewählt.</div>
              ) : (
                <BlockInspector
                  block={selected}
                  onChange={(p) => updateBlock(selected.id, p)}
                  catalog={catalog}
                  repeaterOptions={repeaterOptions}
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <PreviewCanvas doc={doc} catalog={catalog} />
      )}
    </div>

  );
}

// ---------- Sortierbare Zeile ----------
function SortableBlockRow({
  block, index, selected, onSelect, onRemove,
}: { block: ReportBlock; index: number; selected: boolean; onSelect: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 p-2 rounded border ${selected ? "border-primary bg-accent/40" : "border-border"}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground p-1"
        {...attributes}
        {...listeners}
        aria-label="Baustein verschieben"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button className="flex-1 text-left text-sm min-w-0" onClick={onSelect}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{index + 1}</Badge>
          <span className="font-medium">{blockLabel(block)}</span>
          {block.type === "field" && block.hidden && <EyeOff className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">{blockSummary(block)}</div>
      </button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------- Baustein-Helper ----------
function blockLabel(b: ReportBlock): string {
  switch (b.type) {
    case "heading": return `Überschrift H${b.level}`;
    case "text": return "Absatz";
    case "field": return `Feld · ${b.label}`;
    case "table": return "Tabelle";
    case "repeater": return "Repeater";
    case "image": return "Bild";
    case "logo": return "Firmenlogo";
    case "qr": return "QR-Code";
    case "barcode": return "Barcode";
    case "pagebreak": return "Seitenumbruch";
    case "signature": return "Unterschrift";
  }
}
function blockSummary(b: ReportBlock): string {
  switch (b.type) {
    case "heading": return b.text;
    case "text": return b.content.slice(0, 80);
    case "field": return `${b.sourceLabel ? b.sourceLabel + " · " : ""}${b.path}`;
    case "table": return `${b.columns.length} Spalten · ${b.rows.length} Zeilen`;
    case "repeater": return `Quelle: ${b.sourcePath}`;
    case "image": return b.dataUrl ? "Bild eingebettet" : "Kein Bild";
    case "qr":
    case "barcode": return b.content;
    default: return "";
  }
}

function insertTokenIntoBlock(b: ReportBlock, token: string, patch: (p: Partial<ReportBlock>) => void) {
  if (b.type === "text") patch({ content: (b.content ?? "") + " " + token } as any);
  else if (b.type === "heading") patch({ text: (b.text ?? "") + " " + token } as any);
  else if (b.type === "qr" || b.type === "barcode") patch({ content: token } as any);
  else toast.info("Für diesen Baustein direkt in den Feldern einfügen");
}

// ---------- Inspector pro Block ----------
function BlockInspector({ block, onChange, catalog, repeaterOptions }: {
  block: ReportBlock;
  onChange: (p: Partial<ReportBlock>) => void;
  catalog: ReportFieldGroup[];
  repeaterOptions: ReportFieldItem[];
}) {
  switch (block.type) {
    case "field":
      return <FieldBlockInspector block={block} onChange={onChange} catalog={catalog} />;
    case "heading":
      return (
        <div className="space-y-2">
          <div>

            <Label className="text-xs">Text</Label>
            <Input value={block.text} onChange={(e) => onChange({ text: e.target.value } as any)} />
          </div>
          <div>
            <Label className="text-xs">Ebene</Label>
            <Select value={String(block.level)} onValueChange={(v) => onChange({ level: Number(v) as any } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">H1</SelectItem>
                <SelectItem value="2">H2</SelectItem>
                <SelectItem value="3">H3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    case "text":
      return (
        <div>
          <Label className="text-xs">Inhalt (Platzhalter via {"{{...}}"} erlaubt)</Label>
          <Textarea rows={6} value={block.content} onChange={(e) => onChange({ content: e.target.value } as any)} />
        </div>
      );
    case "table": {
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Titel</Label>
            <Input value={block.title ?? ""} onChange={(e) => onChange({ title: e.target.value } as any)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Spalten</Label>
            {block.columns.map((c, i) => (
              <div key={i} className="flex gap-1">
                <Input value={c.header} placeholder="Kopf" onChange={(e) => {
                  const cols = [...block.columns]; cols[i] = { ...c, header: e.target.value }; onChange({ columns: cols } as any);
                }} />
                <Button variant="ghost" size="icon" onClick={() => {
                  const cols = block.columns.filter((_, j) => j !== i);
                  const rows = block.rows.map(r => r.filter((_, j) => j !== i));
                  onChange({ columns: cols, rows } as any);
                }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => {
              const cols = [...block.columns, { header: `Spalte ${block.columns.length + 1}`, value: "" }];
              const rows = block.rows.map(r => [...r, ""]);
              onChange({ columns: cols, rows } as any);
            }}><Plus className="h-3.5 w-3.5 mr-1" />Spalte</Button>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label className="text-xs">Zeilen</Label>
            {block.rows.map((row, ri) => (
              <div key={ri} className="flex gap-1">
                {row.map((cell, ci) => (
                  <Input key={ci} value={cell} placeholder={block.columns[ci]?.header ?? ""} onChange={(e) => {
                    const rows = block.rows.map((r, j) => j === ri ? r.map((c, k) => k === ci ? e.target.value : c) : r);
                    onChange({ rows } as any);
                  }} />
                ))}
                <Button variant="ghost" size="icon" onClick={() => onChange({ rows: block.rows.filter((_, j) => j !== ri) } as any)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => onChange({ rows: [...block.rows, block.columns.map(() => "")] } as any)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Zeile
            </Button>
          </div>
        </div>
      );
    }
    case "repeater":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Titel</Label>
            <Input value={block.title ?? ""} onChange={(e) => onChange({ title: e.target.value } as any)} />
          </div>
          <div>
            <Label className="text-xs">Repeater / Datenquelle (aus den vorhandenen Formularen)</Label>
            <Select
              value={block.sourcePath}
              onValueChange={(v) => {
                const opt = repeaterOptions.find(o => o.path === v);
                const cols = (opt?.subfields ?? []).map(s => ({ header: s.label, path: s.key }));
                onChange({ sourcePath: v, ...(cols.length ? { columns: cols } : {}) } as any);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Repeater wählen" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {repeaterOptions.map((o) => (
                  <SelectItem key={o.path} value={o.path}>{o.label} · {o.sourceLabel}</SelectItem>
                ))}
                {!repeaterOptions.some(o => o.path === block.sourcePath) && block.sourcePath && (
                  <SelectItem value={block.sourcePath}>{block.sourcePath}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Spalten werden aus den Unterfeldern des gewählten Repeaters übernommen und können danach frei angepasst werden.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Spalten (Pfad im Zeilenobjekt, z.B. „value", „result_name", „material")</Label>
            {block.columns.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                <Input value={c.header} placeholder="Kopf" onChange={(e) => {
                  const cols = [...block.columns]; cols[i] = { ...c, header: e.target.value }; onChange({ columns: cols } as any);
                }} />
                <Input value={c.path} placeholder="Feldpfad" onChange={(e) => {
                  const cols = [...block.columns]; cols[i] = { ...c, path: e.target.value }; onChange({ columns: cols } as any);
                }} />
                <Button variant="ghost" size="icon" onClick={() => onChange({ columns: block.columns.filter((_, j) => j !== i) } as any)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => onChange({ columns: [...block.columns, { header: "Neu", path: "" }] } as any)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Spalte
            </Button>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Bild hochladen</Label>
            <Input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const dataUrl = await new Promise<string>((res, rej) => {
                const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f);
              });
              onChange({ dataUrl } as any);
            }} />
          </div>
          <div>
            <Label className="text-xs">Beschriftung</Label>
            <Input value={block.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value } as any)} />
          </div>
          <div>
            <Label className="text-xs">Breite (%)</Label>
            <Input type="number" min={10} max={100} value={block.widthPercent ?? 60} onChange={(e) => onChange({ widthPercent: Number(e.target.value) } as any)} />
          </div>
        </div>
      );
    case "logo":
      return <div className="text-sm text-muted-foreground">Fügt das in den Firmeneinstellungen hinterlegte Logo ein.</div>;
    case "qr":
    case "barcode":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Inhalt (Platzhalter erlaubt)</Label>
            <Input value={block.content} onChange={(e) => onChange({ content: e.target.value } as any)} />
          </div>
          <div>
            <Label className="text-xs">Beschriftung</Label>
            <Input value={block.label ?? ""} onChange={(e) => onChange({ label: e.target.value } as any)} />
          </div>
        </div>
      );
    case "signature":
      return (
        <div>
          <Label className="text-xs">Beschriftung</Label>
          <Input value={block.label} onChange={(e) => onChange({ label: e.target.value } as any)} />
        </div>
      );
    case "pagebreak":
      return <div className="text-sm text-muted-foreground">Fügt beim Rendern einen harten Seitenumbruch ein.</div>;
  }
}

// ---------- Inspector für Feld-Bausteine ----------
function FieldBlockInspector({ block, onChange, catalog }: {
  block: Extract<ReportBlock, { type: "field" }>;
  onChange: (p: Partial<ReportBlock>) => void;
  catalog: ReportFieldGroup[];
}) {
  const group = catalog.find(g => g.items.some(i => i.path === block.path));
  const item = group?.items.find(i => i.path === block.path);
  const groupItems = group?.items.filter(i => i.kind !== "repeater") ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TagIcon className="h-3.5 w-3.5" />
        <span className="font-mono">{block.path}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Datenquelle</Label>
          <Select
            value={group?.key ?? "__unknown__"}
            onValueChange={(gk) => {
              const g = catalog.find(x => x.key === gk);
              const first = g?.items.find(i => i.kind !== "repeater");
              if (first) onChange({ path: first.path, label: first.label, sourceLabel: first.sourceLabel, unit: first.unit ?? null } as any);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Datenquelle" /></SelectTrigger>
            <SelectContent className="max-h-80">
              {catalog.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
              {!group && <SelectItem value="__unknown__">Freier Pfad</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Feld</Label>
          <Select
            value={block.path}
            onValueChange={(p) => {
              const it = groupItems.find(i => i.path === p);
              onChange({ path: p, label: it?.label ?? block.label, sourceLabel: it?.sourceLabel, unit: it?.unit ?? block.unit } as any);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Feld" /></SelectTrigger>
            <SelectContent className="max-h-80">
              {groupItems.map(i => <SelectItem key={i.path} value={i.path}>{i.label}</SelectItem>)}
              {!item && <SelectItem value={block.path}>{block.path}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Bezeichnung / Label</Label>
        <Input value={block.label} onChange={(e) => onChange({ label: e.target.value } as any)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Formatierung</Label>
          <Select value={block.format ?? "auto"} onValueChange={(v) => onChange({ format: v as ReportNumberFormat } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Einheit</Label>
          <Input value={block.unit ?? ""} placeholder="z.B. %" onChange={(e) => onChange({ unit: e.target.value } as any)} />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Einheit anzeigen</Label>
          <Switch checked={block.showUnit !== false} onCheckedChange={(c) => onChange({ showUnit: c } as any)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Ausblenden, wenn leer</Label>
          <Switch checked={!!block.hideIfEmpty} onCheckedChange={(c) => onChange({ hideIfEmpty: c } as any)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Sichtbar im Bericht</Label>
          <Switch checked={!block.hidden} onCheckedChange={(c) => onChange({ hidden: !c } as any)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Label und Wert in einer Zeile</Label>
          <Switch checked={block.inline !== false} onCheckedChange={(c) => onChange({ inline: c } as any)} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Die Reihenfolge wird über Drag &amp; Drop in der Bausteinliste festgelegt.
      </p>
    </div>
  );
}

// ---------- Live-Vorschau ----------
function PreviewCanvas({ doc, catalog }: { doc: ReportTemplate; catalog: ReportFieldGroup[] }) {
  const snapshot = useMemo(() => buildPreviewSnapshot(catalog), [catalog]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          Live-Vorschau (Beispieldaten)
          <Badge variant="outline">{doc.orientation ?? "portrait"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto bg-white text-black shadow border rounded p-8 max-w-[800px] min-h-[600px]"
             style={{ aspectRatio: doc.orientation === "landscape" ? "297/210" : "210/297" }}>
          {doc.header && (
            <div className="text-xs text-gray-500 border-b pb-2 mb-4">{replaceTokens(doc.header, snapshot)}</div>
          )}
          <div className="space-y-3">
            {doc.blocks.map((b) => <BlockPreview key={b.id} block={b} snapshot={snapshot} />)}
          </div>
          {doc.footer && (
            <div className="text-xs text-gray-500 border-t pt-2 mt-6">{replaceTokens(doc.footer, snapshot)}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Beispieldaten: bestehender Demo-Snapshot + Beispielwerte für alle Katalogfelder. */
function buildPreviewSnapshot(catalog: ReportFieldGroup[]): any {
  const snap = JSON.parse(JSON.stringify(SAMPLE_SNAPSHOT));
  for (const g of catalog) {
    for (const item of g.items) {
      if (resolveReportPath(snap, item.path) != null) continue;
      const value = item.kind === "repeater"
        ? [
            Object.fromEntries((item.subfields ?? []).map((s, i) => [s.key, i === 0 ? "Beispiel A" : String(i + 1)])),
            Object.fromEntries((item.subfields ?? []).map((s, i) => [s.key, i === 0 ? "Beispiel B" : String(i + 2)])),
          ]
        : sampleValueFor(item);
      setPath(snap, item.path, value);
    }
  }
  return snap;
}

function setPath(obj: any, path: string, value: unknown) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}


function BlockPreview({ block, snapshot }: { block: ReportBlock; snapshot: any }) {
  switch (block.type) {
    case "heading": {
      const Tag = (`h${block.level}` as any);
      const cls = block.level === 1 ? "text-2xl font-bold" : block.level === 2 ? "text-xl font-semibold" : "text-base font-semibold";
      return <Tag className={cls}>{replaceTokens(block.text, snapshot)}</Tag>;
    }
    case "text":
      return <p className="text-sm whitespace-pre-wrap">{replaceTokens(block.content, snapshot)}</p>;
    case "field": {
      if (block.hidden) return null;
      const raw = resolveReportPath(snapshot, block.path);
      const text = formatReportValue(raw, {
        format: block.format,
        unit: block.unit,
        showUnit: block.showUnit !== false,
      });
      if (block.hideIfEmpty && !text) return null;
      return block.inline === false ? (
        <div className="text-sm">
          <div className="text-xs text-gray-500">{block.label}</div>
          <div className="font-medium">{text || "—"}</div>
        </div>
      ) : (
        <div className="text-sm flex gap-2">
          <span className="text-gray-600">{block.label}:</span>
          <span className="font-medium">{text || "—"}</span>
        </div>
      );
    }

    case "table":
      return (
        <div>
          {block.title && <div className="font-semibold text-sm mb-1">{block.title}</div>}
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-100">
              {block.columns.map((c, i) => <th key={i} className="border p-1 text-left">{c.header}</th>)}
            </tr></thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => <td key={ci} className="border p-1">{replaceTokens(cell, snapshot)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "repeater": {
      const rows = (resolveReportPath(snapshot, block.sourcePath) as any[]) ?? [];
      return (
        <div>
          {block.title && <div className="font-semibold text-sm mb-1">{block.title}</div>}
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-100">
              {block.columns.map((c, i) => <th key={i} className="border p-1 text-left">{c.header}</th>)}
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={block.columns.length} className="border p-2 text-center text-gray-400">— keine Daten —</td></tr>}
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {block.columns.map((c, ci) => (
                    <td key={ci} className="border p-1">{formatPlaceholderValue(resolvePath(row, c.path))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "image":
      return (
        <figure className="text-center">
          {block.dataUrl
            ? <img src={block.dataUrl} alt={block.caption ?? ""} style={{ width: `${block.widthPercent ?? 60}%` }} className="inline-block" />
            : <div className="border border-dashed border-gray-300 p-6 text-gray-400 text-sm">[Bild-Platzhalter]</div>}
          {block.caption && <figcaption className="text-xs text-gray-500 mt-1">{block.caption}</figcaption>}
        </figure>
      );
    case "logo":
      return <div className="text-sm text-gray-500 italic">[Firmenlogo]</div>;
    case "qr":
      return (
        <div className="inline-block text-center">
          <img alt="QR" src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(replaceTokens(block.content, snapshot))}`} />
          {block.label && <div className="text-xs mt-1">{block.label}</div>}
        </div>
      );
    case "barcode":
      return (
        <div className="inline-block text-center">
          <img alt="Barcode" src={`https://barcodeapi.org/api/128/${encodeURIComponent(replaceTokens(block.content, snapshot))}`} className="h-12" />
          {block.label && <div className="text-xs mt-1">{block.label}</div>}
        </div>
      );
    case "pagebreak":
      return <div className="border-t-2 border-dashed border-gray-400 my-4 text-center text-xs text-gray-400">— Seitenumbruch —</div>;
    case "signature":
      return (
        <div className="mt-8 inline-block">
          <div className="border-t border-gray-800 w-56"></div>
          <div className="text-xs mt-1 text-gray-600">{block.label}</div>
        </div>
      );
  }
}
