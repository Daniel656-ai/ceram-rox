import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { GlobalField, GlobalObject } from "@/lib/api/globalModel";
import { bindingPathFor, globalTypeToFormFieldType } from "@/lib/api/globalModel";
import type { ImportAnalysis, ImportedField } from "@/lib/api/formImport";
import { normalizeLabel } from "@/lib/api/formImport";
import { createNode, emptyLayout, type FormLayoutTree, type LayoutNode } from "@/lib/api/formDefinitionLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Sparkles, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

const ACCEPT = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg";
const NEW_GLOBAL = "__new__";

type Decision = { key: string; globalFieldId: string | typeof NEW_GLOBAL | "__skip__"; newObjectId: string };

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    r.readAsDataURL(file);
  });

const isExcel = (f: File) => /\.(xlsx|xls|csv)$/i.test(f.name);

async function excelToText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((n) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false });
    return `### Tabellenblatt: ${n}\n${csv}`;
  }).join("\n\n");
}

/**
 * Phase 5: KI-gestützter Formularimport (Excel, PDF, PNG, JPG).
 * Erzeugt ein neues Formular mit Layout, Feldern und Bindung an globale Felder.
 * Bestehende Formulare werden nie verändert.
 */
export default function FormImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: (form: FormDefinition) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [formName, setFormName] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<false | "analyze" | "apply">(false);

  const { data: objects = [] } = useQuery({ queryKey: ["global-objects"], queryFn: () => api.globalObjects.list() });
  const { data: gFields = [] } = useQuery({ queryKey: ["global-fields"], queryFn: () => api.globalFields.list() });
  const { data: learned = [] } = useQuery({ queryKey: ["form-import-mappings"], queryFn: () => api.formImport.mappings.list() });

  const objectById = useMemo(() => new Map(objects.map((o: GlobalObject) => [o.id, o])), [objects]);
  const pathOf = (f: GlobalField) => bindingPathFor(objectById.get(f.object_id)?.object_key ?? "global", f.field_key);
  const fieldByPath = useMemo(() => new Map(gFields.map((f: GlobalField) => [pathOf(f), f])), [gFields, objectById]);
  const learnedByLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of learned) if (l.binding_path) m.set(l.normalized_label, l.binding_path);
    return m;
  }, [learned]);

  const allFields = useMemo(
    () => (analysis?.sections ?? []).flatMap((s, si) => s.fields.map((f, fi) => ({ ...f, key: `${si}:${fi}`, section: s.title }))),
    [analysis]
  );

  const reset = () => {
    setFile(null); setAnalysis(null); setDecisions({}); setFormName(""); setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const runAnalysis = async (f: File) => {
    setBusy("analyze");
    try {
      const catalog = gFields.map((g: GlobalField) => ({
        id: g.id, binding_path: pathOf(g), display_name: g.display_name, data_type: g.data_type, unit: g.unit,
      }));
      const learnedPayload = learned
        .filter((l) => !!l.binding_path)
        .map((l) => ({ label: l.source_label, binding_path: l.binding_path as string }));

      const payload: any = {
        file_name: f.name,
        mime_type: f.type || (isExcel(f) ? "application/vnd.ms-excel" : ""),
        global_fields: catalog,
        learned_mappings: learnedPayload,
      };
      if (isExcel(f)) payload.sheet_text = await excelToText(f);
      else payload.file_data = await readAsDataUrl(f);

      const result = await api.formImport.analyze(payload);
      setAnalysis(result);
      setFormName(result.form_name);

      // Vorbelegung: Lernwissen schlägt KI-Vorschlag
      const next: Record<string, Decision> = {};
      result.sections.forEach((s, si) =>
        s.fields.forEach((fl, fi) => {
          const key = `${si}:${fi}`;
          const learnedPath = learnedByLabel.get(normalizeLabel(fl.label));
          const path = learnedPath ?? fl.match_binding_path ?? "";
          const match = path ? fieldByPath.get(path) : undefined;
          next[key] = {
            key,
            globalFieldId: match ? match.id : NEW_GLOBAL,
            newObjectId: objects.find((o) => o.object_key === fl.suggested_object_key)?.id ?? objects[0]?.id ?? "",
          };
        })
      );
      setDecisions(next);
      toast.success(`${result.sections.length} Abschnitte erkannt`);
    } catch (e: any) {
      toast.error(e?.message || "Analyse fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!analysis) return;
    setBusy("apply");
    try {
      const form = await api.formDefinitions.create({
        name: formName.trim() || analysis.form_name,
        scope: "global",
        description: `KI-Import aus ${file?.name ?? "Datei"}`,
      });

      const nodes: LayoutNode[] = [];
      let sortOrder = 0;
      let newGlobals = 0;

      for (let si = 0; si < analysis.sections.length; si++) {
        const sec = analysis.sections[si];
        const sectionNode = createNode("section", { title: sec.title, description: sec.description ?? undefined }) as any;
        const children: LayoutNode[] = [];

        // Wiederholbereich (Tabelle) -> Repeater-Feld mit Kindfeldern
        let repeaterParentId: string | null = null;
        if (sec.repeater) {
          const rep = await api.formFields.create({
            form_id: form.id,
            field_key: `${normalizeLabel(sec.title) || "tabelle"}_liste`,
            display_name: sec.title,
            field_type: "repeater",
            sort_order: sortOrder++,
            metadata: { repeater: { item_label: "Zeile", add_label: "Zeile hinzufügen" } },
          } as any);
          repeaterParentId = rep.id;
          children.push(createNode("field", { field_id: rep.id } as any));
        }

        for (let fi = 0; fi < sec.fields.length; fi++) {
          const df = sec.fields[fi];
          const dec = decisions[`${si}:${fi}`];
          if (!dec || dec.globalFieldId === "__skip__") continue;

          let global: GlobalField | undefined;
          if (dec.globalFieldId === NEW_GLOBAL) {
            if (dec.newObjectId) {
              global = await api.globalFields.create({
                object_id: dec.newObjectId,
                field_key: df.field_key || normalizeLabel(df.label),
                display_name: df.label,
                data_type: (["text","longtext","number","decimal","percent","date","time","datetime","boolean","select","multiselect","file","image"].includes(df.field_type)
                  ? df.field_type : "text") as any,
                unit: df.unit,
                select_options: df.select_options,
                data_source: "manual",
              } as any);
              newGlobals++;
            }
          } else {
            global = gFields.find((g: GlobalField) => g.id === dec.globalFieldId);
          }

          const bindingPath = global
            ? bindingPathFor(objectById.get(global.object_id)?.object_key ?? "global", global.field_key)
            : null;

          const created = await api.formFields.create({
            form_id: form.id,
            field_key: global?.field_key ?? df.field_key ?? normalizeLabel(df.label),
            display_name: global?.display_name ?? df.label,
            field_type: (global ? globalTypeToFormFieldType(global.data_type) : df.field_type === "handwriting" ? "handwriting" : df.field_type) as any,
            unit: df.unit ?? global?.unit ?? null,
            is_required: df.required,
            select_options: df.select_options?.length ? df.select_options : (global?.select_options ?? []),
            global_field_id: global?.id ?? null,
            binding_path: bindingPath,
            parent_field_id: repeaterParentId,
            sort_order: sortOrder++,
          } as any);

          if (!repeaterParentId) children.push(createNode("field", { field_id: created.id } as any));

          // Lernfunktion: bestätigte Zuordnung merken
          if (global && bindingPath) {
            await api.formImport.mappings.confirm({
              source_label: df.label,
              global_field_id: global.id,
              binding_path: bindingPath,
              unit: df.unit,
            }).catch(() => undefined);
          }
        }

        if (sec.columns > 1 && !sec.repeater) {
          const cols = createNode("columns", { columnCount: sec.columns } as any) as any;
          children.forEach((c, i) => cols.children[i % sec.columns].children.push(c));
          sectionNode.children = [cols];
        } else {
          sectionNode.children = children;
        }
        nodes.push(sectionNode);
      }

      const layout: FormLayoutTree = { ...emptyLayout(), nodes };
      await api.formDefinitions.update(form.id, { layout } as any);
      await api.formImport.runs.log({
        form_id: form.id,
        file_name: file?.name ?? "unbekannt",
        file_type: file?.type || "unbekannt",
        analysis: analysis as unknown as Record<string, unknown>,
        field_count: allFields.length,
        new_global_field_count: newGlobals,
      }).catch(() => undefined);

      qc.invalidateQueries({ queryKey: ["form-definitions"] });
      qc.invalidateQueries({ queryKey: ["global-fields"] });
      qc.invalidateQueries({ queryKey: ["form-import-mappings"] });
      toast.success(`Formular importiert · ${allFields.length} Felder, ${newGlobals} neue globale Felder`);
      onImported?.({ ...form, layout: layout as unknown as Record<string, unknown> } as FormDefinition);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Import fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Formular importieren
          </DialogTitle>
          <DialogDescription>
            Excel, PDF, PNG oder JPG hochladen – die KI erkennt Layout, Abschnitte, Tabellen,
            Einheiten und Eingabefelder und ordnet sie den globalen Feldern zu.
          </DialogDescription>
        </DialogHeader>

        {!analysis && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); runAnalysis(f); }
              }}
            />
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/40"
              onClick={() => fileRef.current?.click()}
            >
              {busy === "analyze" ? (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Formular wird analysiert …
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Datei auswählen</p>
                  <p className="text-xs text-muted-foreground">Excel (.xlsx/.xls/.csv), PDF, PNG, JPG</p>
                </div>
              )}
            </div>
          </div>
        )}

        {analysis && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-64">
                <Label className="text-xs">Formularname</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <Badge variant="outline">{analysis.sections.length} Abschnitte</Badge>
              <Badge variant="outline">{allFields.length} Felder</Badge>
            </div>

            <ScrollArea className="h-[46vh] border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Abschnitt</TableHead>
                    <TableHead>Erkannte Beschriftung</TableHead>
                    <TableHead className="w-24">Typ</TableHead>
                    <TableHead className="w-20">Einheit</TableHead>
                    <TableHead className="w-[22rem]">Zuordnung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFields.map((f: ImportedField & { key: string; section: string }) => {
                    const dec = decisions[f.key];
                    return (
                      <TableRow key={f.key}>
                        <TableCell className="text-xs text-muted-foreground">{f.section}</TableCell>
                        <TableCell className="text-xs">
                          {f.label}
                          {f.required && <span className="text-destructive"> *</span>}
                          {f.match_binding_path && (
                            <span className="block font-mono text-[10px] text-muted-foreground">
                              KI: {f.match_binding_path} ({Math.round((f.match_confidence ?? 0) * 100)}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{f.field_type}</TableCell>
                        <TableCell className="text-xs">{f.unit ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Select
                              value={dec?.globalFieldId ?? NEW_GLOBAL}
                              onValueChange={(v) =>
                                setDecisions((p) => ({ ...p, [f.key]: { ...(p[f.key] ?? { key: f.key, newObjectId: objects[0]?.id ?? "" }), globalFieldId: v as any } }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-72">
                                <SelectItem value={NEW_GLOBAL}>➕ Neues globales Feld anlegen</SelectItem>
                                <SelectItem value="__skip__">Feld überspringen</SelectItem>
                                {gFields.map((g: GlobalField) => (
                                  <SelectItem key={g.id} value={g.id}>{pathOf(g)} · {g.display_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {dec?.globalFieldId === NEW_GLOBAL && (
                              <Select
                                value={dec?.newObjectId || ""}
                                onValueChange={(v) => setDecisions((p) => ({ ...p, [f.key]: { ...p[f.key], newObjectId: v } }))}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Objekt" /></SelectTrigger>
                                <SelectContent>
                                  {objects.map((o) => <SelectItem key={o.id} value={o.id}>{o.display_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {analysis.sections.some((s) => s.repeater) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Repeat className="h-3.5 w-3.5" /> Erkannte Tabellen werden als Wiederholbereiche angelegt.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={busy === "apply"}>Andere Datei</Button>
              <Button onClick={apply} disabled={busy === "apply"}>
                {busy === "apply" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Formular erstellen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
