import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, AlertTriangle, History, UploadCloud } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  RELEASE_FIELDS, RELEASE_FIELD_GROUPS, TEST_SECTION_LABEL, TEST_PARAMETER_LABEL,
  coerceFieldValue, RELEASE_FIELD_BY_KEY,
} from "@/lib/productionRelease/fields";
import {
  analyzeReleaseDocument, commitReleaseImport,
  type ReleaseAnalysis, type DetectedChange,
} from "@/lib/productionRelease/importPipeline";
import { useReleaseSettings } from "@/hooks/useProductionReleases";
import type { ProductionReleaseTestParameter } from "@/lib/api/productionReleases";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (args: {
    releaseId: string;
    isRevision: boolean;
    revisionNumber: number;
    pendingCount: number;
  }) => void;
}

const DETECTION_LABEL: Record<string, string> = {
  strikethrough: "alter Wert durchgestrichen",
  red: "neuer Wert rot",
  combined: "durchgestrichen + rot",
  text: "Textvergleich",
  unknown: "unklar",
};

const CONFIDENCE_LABEL: Record<string, string> = { high: "hoch", medium: "mittel", low: "niedrig" };

/**
 * PDF → strukturierte Fertigungsfreigabe (Neuanlage ODER Revision).
 * Bewusst mit Prüfschritt: analysieren → anzeigen → korrigieren → übernehmen.
 */
export function ImportPdfDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth();
  const { data: settings } = useReleaseSettings();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<ReleaseAnalysis | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<ProductionReleaseTestParameter[]>([]);
  const [changes, setChanges] = useState<DetectedChange[]>([]);

  const reset = () => {
    setFile(null); setValues({}); setTests([]); setChanges([]); setAnalysis(null);
  };

  const analyze = async (f: File) => {
    setBusy(true);
    try {
      const res = await analyzeReleaseDocument({ file: f, fileName: f.name, source: "pdf_upload" });
      setAnalysis(res);
      setValues(res.rawValues);
      setTests(res.testParameters);
      setChanges(res.changes);
      const auto = res.changes.filter((c) => c.auto).length;
      const open = res.changes.length - auto;
      toast.success(
        res.isRevision
          ? `Revision erkannt – ${auto} Änderung(en) eindeutig, ${open} zur Prüfung.`
          : `${Object.keys(res.rawValues).length} Felder und ${res.testParameters.length} Prüfwerte erkannt.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyse fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (!RELEASE_FIELD_BY_KEY[k]) continue;
        const coerced = coerceFieldValue(k, v);
        if (coerced !== null && coerced !== undefined && coerced !== "") out[k] = coerced;
      }
      const res = await commitReleaseImport({
        analysis,
        values: out,
        testParameters: tests,
        changes,
        userId: user?.id ?? null,
        defaultFormDefinitionId: settings?.default_form_definition_id ?? null,
      });
      onImported({
        releaseId: res.releaseId,
        isRevision: res.isRevision,
        revisionNumber: res.revisionNumber,
        pendingCount: res.pendingCount,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const filled = RELEASE_FIELDS.filter((f) => values[f.key] !== undefined);
  const autoChanges = changes.filter((c) => c.auto);
  const pendingChanges = changes.filter((c) => !c.auto);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fertigungsfreigabe aus PDF importieren</DialogTitle>
          <DialogDescription>
            Das Dokument wird ausgelesen (Text, Position, Farbe, Durchstreichungen, bei Bedarf OCR).
            ROX erkennt, ob es sich um eine neue Fertigungsfreigabe oder um eine Revision handelt.
            Vor dem Speichern können alle Werte korrigiert werden.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex items-center gap-3 rounded-md border border-dashed p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f && f.type === "application/pdf") { setFile(f); setAnalysis(null); void analyze(f); }
          }}
        >
          <UploadCloud className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f); setAnalysis(null);
            }}
          />
          <Button onClick={() => file && analyze(file)} disabled={!file || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">Analysieren</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          PDF hierher ziehen oder auswählen. Das Original-PDF wird unverändert gespeichert.
        </p>

        {analysis && (
          <div className="space-y-6">
            <Alert>
              <History className="h-4 w-4" />
              <AlertTitle>
                {analysis.isRevision
                  ? `Revision einer bestehenden Fertigungsfreigabe${
                      analysis.existing?.release_number ? ` (${analysis.existing.release_number})` : ""
                    }`
                  : "Neue Fertigungsfreigabe"}
              </AlertTitle>
              <AlertDescription className="text-sm">
                {analysis.isRevision ? (
                  <>
                    Bestehende Freigabe erkannt – die bisherige Revision bleibt als Historie erhalten,
                    es wird Rev.{" "}
                    {(Number(analysis.existing?.revision_number) || 0) + 1} angelegt.
                  </>
                ) : (
                  <>Es wurde keine passende bestehende Fertigungsfreigabe gefunden.</>
                )}
                {analysis.document.release_number && (
                  <> Dokumentnummer: <span className="font-mono">{analysis.document.release_number}</span>.</>
                )}
                {analysis.document.revision_date && <> Änderungsdatum: {analysis.document.revision_date}.</>}
                {analysis.visual.pages.some((p) => p.ocrNeeded) && <> Für einzelne Seiten wurde OCR verwendet.</>}
              </AlertDescription>
            </Alert>

            {!!changes.length && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Erkannte Änderungen</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feld</TableHead>
                      <TableHead>Bisher</TableHead>
                      <TableHead>Erkannt</TableHead>
                      <TableHead>Erkennungsart</TableHead>
                      <TableHead>Sicherheit</TableHead>
                      <TableHead>Behandlung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...autoChanges, ...pendingChanges].map((c, i) => (
                      <TableRow key={`${c.field_key}-${i}`}>
                        <TableCell className="text-sm">{c.field_label}</TableCell>
                        <TableCell className="text-sm line-through text-muted-foreground">
                          {c.old_value || "–"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{c.new_value || "nicht eindeutig"}</TableCell>
                        <TableCell className="text-xs">{DETECTION_LABEL[c.detection]}</TableCell>
                        <TableCell className="text-xs">{CONFIDENCE_LABEL[c.confidence]}</TableCell>
                        <TableCell>
                          {c.auto ? (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                              automatisch
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              Prüfung erforderlich
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!!pendingChanges.length && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{pendingChanges.length} Angabe(n) benötigen eine Prüfung</AlertTitle>
                <AlertDescription className="text-sm">
                  Der Import wird trotzdem abgeschlossen. Die unsicheren Punkte erscheinen beim
                  Öffnen der Fertigungsfreigabe zur Prüfung – nichts davon wird automatisch gesetzt.
                </AlertDescription>
              </Alert>
            )}

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

            {!filled.length && !tests.length && !changes.length && (
              <p className="text-sm text-muted-foreground">
                Es konnten keine Felder zugeordnet werden. Die Fertigungsfreigabe kann trotzdem
                angelegt und manuell ausgefüllt werden.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={apply} disabled={!analysis || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            {analysis?.isRevision ? "Revision anlegen" : "Werte übernehmen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
