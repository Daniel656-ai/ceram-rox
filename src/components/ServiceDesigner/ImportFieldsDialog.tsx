import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ServiceFieldType } from "@/lib/api/serviceDesigner";
import type { FormLayoutData } from "@/lib/api/serviceFormLayouts";

type DetectedType = ServiceFieldType;

interface ColumnAnalysis {
  header: string;
  samples: string[];
  uniqueValues: string[];
  suggestedType: DetectedType;
  hasCommaList: boolean;
  maxLength: number;
}

interface ColumnMapping {
  include: boolean;
  header: string;
  displayName: string;
  fieldKey: string;
  fieldType: DetectedType;
  isRequired: boolean;
  unit: string;
  selectOptions: string[];
  samples: string[];
}

const TYPE_OPTIONS: { value: DetectedType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "longtext", label: "Mehrzeiliger Text" },
  { value: "number", label: "Ganzzahl" },
  { value: "decimal", label: "Dezimalzahl" },
  { value: "percent", label: "Prozent" },
  { value: "date", label: "Datum" },
  { value: "datetime", label: "Datum & Uhrzeit" },
  { value: "time", label: "Uhrzeit" },
  { value: "boolean", label: "Ja / Nein" },
  { value: "select", label: "Auswahl (Dropdown)" },
  { value: "multiselect", label: "Mehrfachauswahl" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function isInteger(v: string) { return /^-?\d+$/.test(v.trim()); }
function isDecimal(v: string) { return /^-?\d+([.,]\d+)?$/.test(v.trim()) && !isInteger(v); }
function isPercent(v: string) { return /^-?\d+([.,]\d+)?\s*%$/.test(v.trim()); }
function isDate(v: string) {
  const t = v.trim();
  if (!t) return false;
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(t) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(t);
}
function isDateTime(v: string) {
  return /\d{1,2}:\d{2}/.test(v) && isDate(v.split(/[ T]/)[0] ?? "");
}
function isTime(v: string) { return /^\d{1,2}:\d{2}(:\d{2})?$/.test(v.trim()); }
function isBoolean(v: string) {
  return ["ja", "nein", "yes", "no", "true", "false", "1", "0", "x", ""].includes(v.trim().toLowerCase());
}

function analyzeColumn(header: string, values: string[]): ColumnAnalysis {
  const nonEmpty = values.map((v) => String(v ?? "").trim()).filter((v) => v !== "");
  const samples = nonEmpty.slice(0, 5);
  const unique = Array.from(new Set(nonEmpty));
  const maxLength = nonEmpty.reduce((m, v) => Math.max(m, v.length), 0);
  const hasCommaList = nonEmpty.some((v) => v.includes(",") && v.split(",").length >= 2 && v.split(",").every((p) => p.trim().length < 30));

  let suggested: DetectedType = "text";

  if (nonEmpty.length === 0) {
    suggested = "text";
  } else if (nonEmpty.every(isBoolean) && unique.length <= 3) {
    suggested = "boolean";
  } else if (nonEmpty.every(isPercent)) {
    suggested = "percent";
  } else if (nonEmpty.every(isInteger)) {
    suggested = "number";
  } else if (nonEmpty.every((v) => isInteger(v) || isDecimal(v))) {
    suggested = "decimal";
  } else if (nonEmpty.every(isDateTime)) {
    suggested = "datetime";
  } else if (nonEmpty.every(isDate)) {
    suggested = "date";
  } else if (nonEmpty.every(isTime)) {
    suggested = "time";
  } else if (hasCommaList && unique.length / nonEmpty.length > 0.3) {
    suggested = "multiselect";
  } else if (unique.length <= Math.max(8, Math.floor(nonEmpty.length / 3)) && unique.length < nonEmpty.length && maxLength <= 40) {
    suggested = "select";
  } else if (maxLength > 80) {
    suggested = "longtext";
  } else {
    suggested = "text";
  }

  return { header, samples, uniqueValues: unique, suggestedType: suggested, hasCommaList, maxLength };
}

function extractSelectOptions(a: ColumnAnalysis, type: DetectedType): string[] {
  if (type === "select") return a.uniqueValues.slice(0, 50);
  if (type === "multiselect") {
    const set = new Set<string>();
    a.uniqueValues.forEach((v) => v.split(",").map((p) => p.trim()).filter(Boolean).forEach((p) => set.add(p)));
    return Array.from(set).slice(0, 50);
  }
  return [];
}

export default function ImportFieldsDialog({
  serviceId,
  existingKeys,
  onClose,
  onImported,
}: {
  serviceId: string;
  existingKeys: string[];
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [analyses, setAnalyses] = useState<ColumnAnalysis[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [category, setCategory] = useState("Import");
  const [generateLayout, setGenerateLayout] = useState(true);
  const [importing, setImporting] = useState(false);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
        if (raw.length === 0) {
          toast.error("Datei enthält keine Daten");
          return;
        }
        const headers = Object.keys(raw[0]);
        const analyses = headers.map((h) =>
          analyzeColumn(h, raw.map((r) => String(r[h] ?? "")))
        );
        const mappings: ColumnMapping[] = analyses.map((a) => {
          const baseKey = slugify(a.header) || "feld";
          let key = baseKey;
          let i = 2;
          while (existingKeys.includes(key)) key = `${baseKey}_${i++}`;
          return {
            include: true,
            header: a.header,
            displayName: a.header,
            fieldKey: key,
            fieldType: a.suggestedType,
            isRequired: false,
            unit: "",
            selectOptions: extractSelectOptions(a, a.suggestedType),
            samples: a.samples,
          };
        });
        setFileName(file.name);
        setRows(raw);
        setAnalyses(analyses);
        setMappings(mappings);
        setStep(2);
      } catch (err: any) {
        toast.error("Datei konnte nicht gelesen werden", { description: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function updateMapping(idx: number, patch: Partial<ColumnMapping>) {
    setMappings((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      if (patch.fieldType && patch.fieldType !== next[idx].fieldType) {
        merged.selectOptions = extractSelectOptions(analyses[idx], patch.fieldType);
      }
      next[idx] = merged;
      return next;
    });
  }

  async function runImport() {
    const selected = mappings.filter((m) => m.include);
    if (selected.length === 0) {
      toast.error("Mindestens ein Feld auswählen");
      return;
    }
    const keys = selected.map((m) => m.fieldKey);
    if (new Set(keys).size !== keys.length) {
      toast.error("Doppelte Schlüssel — bitte eindeutige interne Schlüssel vergeben");
      return;
    }
    setImporting(true);
    try {
      const created: { id: string; key: string }[] = [];
      let sort = 0;
      for (const m of selected) {
        const f = await api.serviceDataFields.create({
          service_id: serviceId,
          field_key: m.fieldKey,
          display_name: m.displayName,
          field_type: m.fieldType,
          category,
          unit: m.unit || null,
          is_required: m.isRequired,
          select_options: m.selectOptions,
          sort_order: sort++,
        } as any);
        created.push({ id: f.id, key: m.fieldKey });
      }

      if (generateLayout) {
        const existing = await api.serviceFormLayouts.get(serviceId, "employee");
        const layout: FormLayoutData = existing?.layout ?? { sections: [] };
        layout.sections = [
          ...layout.sections,
          {
            id: `imp_${Date.now()}`,
            title: `Import: ${fileName || "Felder"}`,
            description: `Automatisch generiert aus ${fileName}`,
            fields: created.map((c, i) => ({
              id: `r_${Date.now()}_${i}`,
              field_id: c.id,
              width: 6 as const,
            })),
          },
        ];
        await api.serviceFormLayouts.upsert(serviceId, "employee", layout);
      }

      toast.success(`${created.length} Felder importiert`);
      onImported();
      onClose();
    } catch (e: any) {
      toast.error("Import fehlgeschlagen", { description: e.message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Felder aus Excel/CSV importieren · Schritt {step} / 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/40"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">Excel- oder CSV-Datei wählen</p>
              <p className="text-sm text-muted-foreground">.xlsx, .xls, .csv — Drag & Drop oder klicken</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Die erste Zeile muss die Spaltenüberschriften enthalten. Aus diesen werden Feldnamen und Datentypen vorgeschlagen.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground"> · {rows.length} Datensätze · {analyses.length} Spalten</span>
              </div>
            </div>

            <div className="border rounded-md max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12">Import</TableHead>
                    <TableHead>Spalte</TableHead>
                    <TableHead>Anzeigename</TableHead>
                    <TableHead>Schlüssel</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Einheit</TableHead>
                    <TableHead className="text-center">Pflicht</TableHead>
                    <TableHead>Beispiele</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m, i) => (
                    <TableRow key={i} className={!m.include ? "opacity-50" : ""}>
                      <TableCell>
                        <Switch checked={m.include} onCheckedChange={(c) => updateMapping(i, { include: c })} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.header}</TableCell>
                      <TableCell>
                        <Input className="h-8" value={m.displayName} onChange={(e) => updateMapping(i, { displayName: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 font-mono text-xs" value={m.fieldKey} onChange={(e) => updateMapping(i, { fieldKey: slugify(e.target.value) })} />
                      </TableCell>
                      <TableCell>
                        <Select value={m.fieldType} onValueChange={(v) => updateMapping(i, { fieldType: v as DetectedType })}>
                          <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-20" value={m.unit} onChange={(e) => updateMapping(i, { unit: e.target.value })} placeholder="—" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={m.isRequired} onCheckedChange={(c) => updateMapping(i, { isRequired: c })} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={m.samples.join(" | ")}>
                        {m.samples.join(", ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Kategorie für alle Felder</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm self-end pb-1">
                <Switch checked={generateLayout} onCheckedChange={setGenerateLayout} />
                Formular-Layout (Mitarbeiteransicht) automatisch erweitern
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Datenvorschau (erste 5 Zeilen):</p>
            <div className="border rounded-md overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {mappings.filter((m) => m.include).map((m) => (
                      <TableHead key={m.fieldKey}>
                        <div className="font-medium">{m.displayName}</div>
                        <Badge variant="outline" className="text-[10px] mt-1">{m.fieldType}</Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {mappings.filter((m) => m.include).map((m) => (
                        <TableCell key={m.fieldKey} className="text-sm">{String(row[m.header] ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-sm">
              Es werden <strong>{mappings.filter((m) => m.include).length}</strong> Felder in Kategorie „{category}" angelegt
              {generateLayout && " und ein Formular-Abschnitt in der Mitarbeiteransicht erstellt"}.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as any)} disabled={importing}>
              <ArrowLeft className="h-4 w-4 mr-1" />Zurück
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={importing}>Abbrechen</Button>
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={mappings.filter((m) => m.include).length === 0}>
              Weiter <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={runImport} disabled={importing}>
              <Upload className="h-4 w-4 mr-1" />{importing ? "Importiere …" : "Importieren"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
