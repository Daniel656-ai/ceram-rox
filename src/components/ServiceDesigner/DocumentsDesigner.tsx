import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ServiceDocumentTemplate,
  DocumentKind,
  DocumentFormat,
} from "@/lib/api/serviceDocumentTemplates";
import type { ServiceDataField } from "@/lib/api/serviceDesigner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, FileText, Mail, Tag, Award, Eye, Copy, Layers,
} from "lucide-react";

const KIND_OPTIONS: { value: DocumentKind; label: string; icon: any }[] = [
  { value: "report", label: "Bericht", icon: FileText },
  { value: "email", label: "E-Mail", icon: Mail },
  { value: "label", label: "Etikett", icon: Tag },
  { value: "certificate", label: "Zertifikat", icon: Award },
];

const FORMAT_OPTIONS: { value: DocumentFormat; label: string }[] = [
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Klartext" },
];

const PAPER_OPTIONS = ["A4", "A5", "Letter", "Label 100×60", "Label 50×30"];

function sampleValueFor(f: ServiceDataField): string {
  switch (f.field_type) {
    case "number":
    case "decimal":
    case "percent":
      return f.min_value != null ? String(f.min_value) : "42";
    case "boolean": return "Ja";
    case "date": return new Date().toLocaleDateString("de-DE");
    case "time": return "08:30";
    case "datetime": return new Date().toLocaleString("de-DE");
    case "select":
    case "multiselect": {
      const o = (f.select_options || [])[0];
      if (!o) return "Option";
      return typeof o === "string" ? o : o.label;
    }
    default: return `Beispiel ${f.display_name}`;
  }
}

export function renderTemplate(content: string, fields: ServiceDataField[]): string {
  const map = new Map<string, string>();
  for (const f of fields) map.set(f.field_key, sampleValueFor(f));
  return content.replace(/\{\{?\s*([a-z0-9_]+)\s*\}?\}/gi, (_, key) =>
    map.get(key) ?? `‹${key}›`
  );
}

export default function DocumentsDesigner({
  serviceId, canManage,
}: { serviceId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["service-doc-templates", serviceId],
    queryFn: () => api.serviceDocumentTemplates.listForService(serviceId),
  });
  const { data: fields = [] } = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => api.serviceDataFields.listForService(serviceId),
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ["service-blocks", "document_snippet"],
    queryFn: () => api.serviceBlocks.list("document_snippet"),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ServiceDocumentTemplate>>({});
  const [confirmDelete, setConfirmDelete] = useState<ServiceDocumentTemplate | null>(null);

  useEffect(() => {
    if (!selectedId && templates.length > 0) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    if (selected) setDraft({ ...selected });
    else setDraft({});
  }, [selected]);

  const createTpl = useMutation({
    mutationFn: () =>
      api.serviceDocumentTemplates.create({
        service_id: serviceId,
        name: "Neue Vorlage",
        kind: "report",
        format: "html",
        content: "<h1>{{display_name}}</h1>\n<p>Auftragsnummer: {{auftragsnummer}}</p>",
        sort_order: templates.length,
      }),
    onSuccess: (row) => {
      toast.success("Vorlage angelegt");
      qc.invalidateQueries({ queryKey: ["service-doc-templates", serviceId] });
      setSelectedId(row.id);
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const saveTpl = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Keine Vorlage ausgewählt");
      return api.serviceDocumentTemplates.update(selected.id, {
        name: draft.name ?? selected.name,
        description: draft.description ?? null,
        kind: (draft.kind ?? selected.kind) as DocumentKind,
        format: (draft.format ?? selected.format) as DocumentFormat,
        content: draft.content ?? "",
        paper: draft.paper ?? selected.paper,
        orientation: (draft.orientation ?? selected.orientation) as any,
        header_html: draft.header_html ?? null,
        footer_html: draft.footer_html ?? null,
        enabled: draft.enabled ?? selected.enabled,
      });
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["service-doc-templates", serviceId] });
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const deleteTpl = useMutation({
    mutationFn: (id: string) => api.serviceDocumentTemplates.delete(id),
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["service-doc-templates", serviceId] });
      setSelectedId(null);
    },
    onError: (e: any) => toast.error("Fehler", { description: e.message }),
  });

  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    setDraft((d) => ({ ...d, content: (d.content ?? "") + token }));
  };

  const insertBlock = (snippet: string) => {
    setDraft((d) => ({ ...d, content: (d.content ?? "") + "\n" + snippet }));
  };

  const preview = useMemo(
    () => renderTemplate(draft.content ?? "", fields),
    [draft.content, fields]
  );

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Sidebar */}
      <Card className="col-span-12 md:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Vorlagen</CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => createTpl.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> Neu
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Lade …</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded p-3 text-center">
              Noch keine Dokumentvorlagen.
            </div>
          ) : (
            templates.map((t) => {
              const Icon = KIND_OPTIONS.find((k) => k.value === t.kind)?.icon ?? FileText;
              return (
                <button
                  key={t.id}
                  className={`w-full text-left px-2 py-2 rounded-md text-sm flex items-center gap-2 ${selectedId === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{t.name}</span>
                  {!t.enabled && <Badge variant="outline" className="text-[10px]">aus</Badge>}
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="col-span-12 md:col-span-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Editor</span>
            {canManage && selected && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(selected)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Löschen
                </Button>
                <Button size="sm" onClick={() => saveTpl.mutate()} disabled={saveTpl.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Speichern
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded p-6 text-center">
              Wähle links eine Vorlage oder lege eine neue an.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={draft.name ?? ""}
                    disabled={!canManage}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Typ</Label>
                  <Select
                    value={draft.kind ?? "report"}
                    disabled={!canManage}
                    onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as DocumentKind }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Format</Label>
                  <Select
                    value={draft.format ?? "html"}
                    disabled={!canManage}
                    onValueChange={(v) => setDraft((d) => ({ ...d, format: v as DocumentFormat }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Papier</Label>
                  <Select
                    value={draft.paper ?? "A4"}
                    disabled={!canManage}
                    onValueChange={(v) => setDraft((d) => ({ ...d, paper: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAPER_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                <Input
                  value={draft.description ?? ""}
                  disabled={!canManage}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Inhalt (Platzhalter <code>&#123;&#123;feld_key&#125;&#125;</code>)</Label>
                <Textarea
                  rows={14}
                  className="font-mono text-xs"
                  value={draft.content ?? ""}
                  disabled={!canManage}
                  onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Kopfbereich (optional)</Label>
                  <Textarea
                    rows={3}
                    className="font-mono text-xs"
                    value={draft.header_html ?? ""}
                    disabled={!canManage}
                    onChange={(e) => setDraft((d) => ({ ...d, header_html: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fußbereich (optional)</Label>
                  <Textarea
                    rows={3}
                    className="font-mono text-xs"
                    value={draft.footer_html ?? ""}
                    disabled={!canManage}
                    onChange={(e) => setDraft((d) => ({ ...d, footer_html: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={draft.enabled ?? true}
                  disabled={!canManage}
                  onCheckedChange={(c) => setDraft((d) => ({ ...d, enabled: c }))}
                />
                <span className="text-xs text-muted-foreground">
                  {draft.enabled ?? true ? "Aktiv" : "Inaktiv"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right rail: placeholders + blocks + preview */}
      <div className="col-span-12 md:col-span-3 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Copy className="h-4 w-4" /> Platzhalter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {fields.length === 0 ? (
              <div className="text-xs text-muted-foreground">Noch keine Datenfelder.</div>
            ) : fields.filter((f) => !f.archived).map((f) => (
              <button
                key={f.id}
                onClick={() => canManage && selected && insertPlaceholder(f.field_key)}
                disabled={!canManage || !selected}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted disabled:opacity-50"
              >
                <div className="font-medium truncate">{f.display_name}</div>
                <code className="text-[10px] text-muted-foreground">{`{{${f.field_key}}}`}</code>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Bausteine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-48 overflow-y-auto">
            {blocks.length === 0 ? (
              <div className="text-xs text-muted-foreground">Keine Dokumentbausteine in der Bibliothek.</div>
            ) : blocks.map((b) => (
              <button
                key={b.id}
                onClick={() => canManage && selected && insertBlock(b.content?.snippet ?? "")}
                disabled={!canManage || !selected}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted disabled:opacity-50"
                title={b.description ?? ""}
              >
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{b.category}</div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Live preview */}
      {selected && (
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" /> Live-Vorschau (mit Beispielwerten)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded-md bg-white text-black p-6 min-h-[200px] overflow-auto"
              style={{ maxWidth: draft.paper?.startsWith("Label") ? 400 : undefined }}
              dangerouslySetInnerHTML={{
                __html:
                  (draft.header_html ? `<div style="border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:12px">${renderTemplate(draft.header_html, fields)}</div>` : "") +
                  (draft.format === "text"
                    ? `<pre style="white-space:pre-wrap;font-family:inherit">${preview.replace(/</g, "&lt;")}</pre>`
                    : preview) +
                  (draft.footer_html ? `<div style="border-top:1px solid #eee;padding-top:8px;margin-top:12px;color:#666;font-size:12px">${renderTemplate(draft.footer_html, fields)}</div>` : ""),
              }}
            />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{confirmDelete?.name}" wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) deleteTpl.mutate(confirmDelete.id); setConfirmDelete(null); }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
