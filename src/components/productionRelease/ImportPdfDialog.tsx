import { useRef, useState } from "react";
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
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function isPdf(f: File) {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
}

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
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null); setValues({}); setTests([]); setChanges([]); setAnalysis(null);
    setFileError(null); setDragActive(false); dragDepth.current = 0;
    if (inputRef.current) inputRef.current.value = "";
  };


  const analyze = async (f: File) => {
    setBusy(true);
    try {
      const res = await analyzeReleaseDocument({ file: f, fileName: f.name, source: "pdf_upload" });
      setAnalysis(res);
      setValues(res.rawValues);
      setTests(res.testParameters);
      setChanges(res.changes);
      if (!res.coverage.complete) {
        const msg =
          `Fertigungsfreigabe konnte nicht vollständig verarbeitet werden. Das Dokument überschreitet die technische Verarbeitungsgrenze. ` +
          `Datei: ${res.coverage.fileName}; Größe: ${(res.coverage.fileBytes / 1024 / 1024).toFixed(2)} MB; ` +
          `Seiten: ${res.coverage.totalPages}; verarbeitet bis Seite ${res.coverage.processedUntilPage}; ` +
          `nicht verarbeitet: Seite(n) ${res.coverage.failedPages.join(", ")}; ` +
          `Fehlercode: ${res.coverage.errors.map((e) => e.code).join(", ") || "UNBEKANNT"}.`;
        setFileError(msg);
        toast.error(msg, { duration: 15000 });
      }
      const auto = res.changes.filter((c) => c.auto).length;
      const open = res.changes.length - auto;
      toast.success(
        res.isRevision
          ? `Revision erkannt – ${auto} Änderung(en) eindeutig, ${open} zur Prüfung.`
          : `${Object.keys(res.rawValues).length} Felder und ${res.testParameters.length} Prüfwerte erkannt.`
      );
    } catch (e) {
      // Der Text der Ausnahme enthält bereits den Einleitungssatz, sobald die
      // blockweise Verarbeitung fehlschlägt – nicht doppelt voranstellen.
      const detail = e instanceof Error ? e.message : "Unbekannte Ursache.";
      const prefix = "Fertigungsfreigabe konnte nicht verarbeitet werden.";
      const msg = detail.startsWith(prefix) ? detail : `${prefix} ${detail}`;
      setFileError(msg);
      toast.error(msg, { duration: 12000 });
    } finally {
      setBusy(false);
    }
  };

  /** Einziger Weg für Auswahl UND Drag & Drop. */
  const acceptFiles = (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (busy || saving) {
      toast.info("Es läuft bereits eine Analyse – bitte kurz warten.");
      return;
    }
    const pdfs = files.filter(isPdf);
    if (!pdfs.length) {
      setFileError("Nur PDF-Dateien können importiert werden.");
      toast.error("Nur PDF-Dateien können importiert werden.");
      return;
    }
    const f = pdfs[0];
    if (files.length > 1) {
      toast.info(`Mehrere Dateien erkannt – „${f.name}“ wird verwendet.`);
    }
    if (f.size === 0) {
      setFileError("Die Datei ist leer.");
      toast.error("Die Datei ist leer.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError("Die Datei ist größer als 50 MB.");
      toast.error("Die Datei ist größer als 50 MB.");
      return;
    }
    setFileError(null);
    setFile(f);
    setAnalysis(null); setValues({}); setTests([]); setChanges([]);
    void analyze(f);
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
      toast.error(
        `Fertigungsfreigabe konnte nicht verarbeitet werden. ${
          e instanceof Error ? e.message : "Fehler beim Speichern der erkannten Daten."
        }`,
        { duration: 12000 }
      );
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
          role="button"
          tabIndex={0}
          aria-label="PDF hierher ziehen oder auswählen"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); }
          }}
          onDragEnter={(e) => {
            e.preventDefault(); e.stopPropagation();
            dragDepth.current += 1;
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault(); e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
            if (!dragActive) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault(); e.stopPropagation();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation();
            dragDepth.current = 0;
            setDragActive(false);
            acceptFiles(e.dataTransfer?.files);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
            dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:bg-muted/40"
          }`}
        >
          <UploadCloud className={`h-6 w-6 ${dragActive ? "text-primary" : "text-muted-foreground"}`} />
          <p className="text-sm font-medium">
            {dragActive ? "PDF hier ablegen" : "PDF hierher ziehen oder klicken, um eine Datei auszuwählen"}
          </p>
          <p className="text-xs text-muted-foreground">
            Nur PDF, max. 50 MB. Das Original-PDF wird unverändert gespeichert.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              acceptFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {file && (
            <div className="mt-1 flex items-center gap-2 text-sm">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{file.name}</span>
              <span className="text-muted-foreground">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
              {busy ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> wird analysiert
                </Badge>
              ) : analysis ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  analysiert
                </Badge>
              ) : null}
            </div>
          )}
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {file && !busy && !analysis && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={(e) => { e.stopPropagation(); void analyze(file); }}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Erneut analysieren
            </Button>
          )}
        </div>


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

            <Alert variant={analysis.coverage.complete ? "default" : "destructive"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {analysis.coverage.complete
                  ? `Vollständig verarbeitet: alle ${analysis.coverage.totalPages} Seite(n)`
                  : "Fertigungsfreigabe konnte nicht vollständig verarbeitet werden. Das Dokument überschreitet die technische Verarbeitungsgrenze."}
              </AlertTitle>
              <AlertDescription className="text-sm">
                Datei: <span className="font-medium">{analysis.coverage.fileName}</span> ·{" "}
                {(analysis.coverage.fileBytes / 1024 / 1024).toFixed(2)} MB · Seiten:{" "}
                {analysis.coverage.totalPages} · verarbeitet in {analysis.coverage.blocks} Block(en) ·
                verarbeitet bis Seite {analysis.coverage.processedUntilPage}.
                {!analysis.coverage.complete && (
                  <>
                    {" "}Nicht verarbeitet: Seite(n) {analysis.coverage.failedPages.join(", ")}. Fehlercode:{" "}
                    <span className="font-mono">
                      {analysis.coverage.errors.map((e) => e.code).join(", ") || "UNBEKANNT"}
                    </span>
                    . Der Import wird als „Prüfung erforderlich“ gespeichert – nicht als vollständige
                    Fertigungsfreigabe.
                  </>
                )}
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
