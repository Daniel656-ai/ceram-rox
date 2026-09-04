import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { extractPdfPages } from "@/lib/productionRelease/pdfText";
import {
  RELEASE_FIELDS, RELEASE_FIELD_GROUPS, RELEASE_FIELD_BY_KEY, coerceFieldValue,
  TEST_SECTION_LABEL, TEST_PARAMETER_LABEL,
} from "@/lib/productionRelease/fields";
import type { ProductionReleaseTestParameter } from "@/lib/api/productionReleases";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (args: {
    values: Record<string, unknown>;
    testParameters: ProductionReleaseTestParameter[];
    fileName: string;
    storagePath: string | null;
    rawText: string;
  }) => void;
}

/**
 * PDF → strukturierte Fertigungsfreigabe.
 * Bewusst mit Prüfschritt: analysieren → anzeigen → korrigieren → übernehmen.
 */
export function ImportPdfDialog({ open, onOpenChange, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [rawText, setRawText] = useState("");
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<ProductionReleaseTestParameter[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const reset = () => {
    setFile(null); setValues({}); setTests([]); setRawText("");
    setStoragePath(null); setAnalyzed(false);
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const pages = await extractPdfPages(file);
      const text = pages.join("\n\n");
      setRawText(text);
      if (!text.trim()) {
        toast.error("Aus dem PDF konnte kein Text gelesen werden (evtl. ein reiner Scan).");
        return;
      }
      const res = await api.productionReleases.analyzePdfText({ fileName: file.name, pages });
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.fields)) {
        if (RELEASE_FIELD_BY_KEY[k] && v != null && String(v).trim() !== "") next[k] = String(v);
      }
      setValues(next);
      setTests(res.testParameters ?? []);
      setAnalyzed(true);

      let path: string | null = null;
      try {
        path = await api.productionReleases.uploadDocument(file);
      } catch {
        // Quelldokument optional – der Import darf daran nicht scheitern
      }
      setStoragePath(path);
      const found = Object.keys(next).length;
      toast.success(`${found} Felder und ${(res.testParameters ?? []).length} Prüfwerte erkannt.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyse fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      const coerced = coerceFieldValue(k, v);
      if (coerced !== null && coerced !== undefined && coerced !== "") out[k] = coerced;
    }
    onImported({
      values: out,
      testParameters: tests,
      fileName: file?.name ?? "",
      storagePath,
      rawText,
    });
    reset();
    onOpenChange(false);
  };

  const filled = RELEASE_FIELDS.filter((f) => values[f.key] !== undefined);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fertigungsfreigabe aus PDF importieren</DialogTitle>
          <DialogDescription>
            Das Dokument wird analysiert und die erkannten Werte werden den passenden Feldern
            zugeordnet. Vor dem Speichern können alle Werte korrigiert werden.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Input
            type="file"
            accept="application/pdf"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setAnalyzed(false); }}
          />
          <Button onClick={analyze} disabled={!file || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">Analysieren</span>
          </Button>
        </div>

        {analyzed && (
          <div className="space-y-6">
            {RELEASE_FIELD_GROUPS.map((g) => {
              const rows = filled.filter((f) => f.group === g.key);
              if (!rows.length) return null;
              return (
                <div key={g.key}>
                  <h4 className="text-sm font-semibold mb-2">{g.labelDe}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Feld</TableHead>
                        <TableHead>Erkannter Wert</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((f) => (
                        <TableRow key={f.key}>
                          <TableCell className="text-sm">
                            {f.labelDe}{f.unit ? ` (${f.unit})` : ""}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={values[f.key] ?? ""}
                              onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}

            {tests.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Prüf- und Messvorgaben (Beiblatt)</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prüfung</TableHead>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Wert</TableHead>
                      <TableHead className="w-24">Einheit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tests.map((t, i) => (
                      <TableRow key={`${t.section}-${t.parameter_key}-${i}`}>
                        <TableCell><Badge variant="outline">{TEST_SECTION_LABEL[t.section] ?? t.section}</Badge></TableCell>
                        <TableCell className="text-sm">{TEST_PARAMETER_LABEL[t.parameter_key] ?? t.parameter_key}</TableCell>
                        <TableCell>
                          <Input
                            value={t.value_text ?? ""}
                            onChange={(e) =>
                              setTests((p) => p.map((x, j) => (j === i ? { ...x, value_text: e.target.value } : x)))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={t.unit ?? ""}
                            onChange={(e) =>
                              setTests((p) => p.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!filled.length && !tests.length && (
              <p className="text-sm text-muted-foreground">
                Es konnten keine Felder zugeordnet werden. Die Fertigungsfreigabe kann trotzdem
                angelegt und manuell ausgefüllt werden.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={apply} disabled={!analyzed}>
            <FileUp className="h-4 w-4 mr-2" /> Werte übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
