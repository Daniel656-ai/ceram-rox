import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useReplaceMeasurementResults } from "@/hooks/useResultCorrections";
import {
  buildReplaceResultsPayload,
  parseResultInput,
  type ReplaceResultEntry,
} from "@/lib/results/replaceResults";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });

export interface ReplaceResultsContext {
  measurementId: string;
  measurementNumber?: string;
  serviceName: string;
  sampleNumber: string;
  orderNumber?: string;
}

interface EditRow {
  key: string;
  /** Bestehende Ergebniszeile (bei Ergänzungen null). */
  existingId: string | null;
  resultName: string;
  instanceKey: string | null;
  instanceLabel: string | null;
  displayLabel: string | null;
  unit: string | null;
  /** Rohwert des Eingabefelds (Zahl oder Text). */
  input: string;
  /** Bisheriger Zustand zur Änderungserkennung. */
  currentValue: number | null;
  currentText: string | null;
  /** Neue Zeile: Name/Einheit editierbar. */
  isNew: boolean;
}

function formatExisting(value: number | null, text: string | null): string {
  if (value !== null && value !== undefined) return String(value).replace(".", ",");
  return text ?? "";
}

/**
 * Nachträgliche Änderung und Ergänzung aller Ergebnisse einer Dienstleistung.
 * Jede tatsächliche Wertänderung und Ergänzung wird serverseitig mit
 * Pflichtbegründung in der Änderungshistorie dokumentiert; unveränderte
 * Werte bleiben unangetastet. Wiederholte Übermittlung derselben Operation
 * ist idempotent.
 */
export default function ReplaceResultsDialog({
  open,
  onOpenChange,
  context,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context: ReplaceResultsContext | null;
}) {
  const [rows, setRows] = useState<EditRow[]>([]);
  const [reason, setReason] = useState("");
  const replace = useReplaceMeasurementResults();

  const { data: existing = [], isLoading } = useQuery({
    queryKey: ["measurement-results", context?.measurementId],
    queryFn: () => api.measurementResults.list(context!.measurementId) as Promise<any[]>,
    enabled: open && !!context?.measurementId,
  });

  useEffect(() => {
    if (!open || !context || isLoading) return;
    setRows(
      (existing as any[]).map((r) => ({
        key: r.id as string,
        existingId: r.id as string,
        resultName: r.result_name as string,
        instanceKey: (r.instance_key as string | null) ?? null,
        instanceLabel: (r.instance_label as string | null) ?? null,
        displayLabel: (r.display_label as string | null) ?? null,
        unit: (r.unit as string | null) ?? null,
        input: formatExisting(r.value as number | null, r.text_value as string | null),
        currentValue: (r.value as number | null) ?? null,
        currentText: (r.text_value as string | null) ?? null,
        isNew: false,
      }))
    );
    setReason("");
    // Bewusst nur beim Öffnen hydrieren, nicht bei jeder Abfrage-Aktualisierung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context?.measurementId, isLoading]);

  const changedEntries = useMemo(() => {
    const entries: ReplaceResultEntry[] = [];
    for (const row of rows) {
      const parsed = parseResultInput(row.input);
      if (row.isNew) {
        if (!row.resultName.trim() || !parsed) continue;
        entries.push({
          result_name: row.resultName,
          unit: row.unit,
          display_label: row.resultName,
          ...parsed,
        });
        continue;
      }
      if (!parsed) continue; // geleerte Zeile: unverändert lassen
      const nextValue = "value" in parsed ? parsed.value : null;
      const nextText = "text_value" in parsed ? parsed.text_value : null;
      const unchanged = nextValue === row.currentValue && nextText === row.currentText;
      if (unchanged) continue;
      entries.push({
        result_name: row.resultName,
        instance_key: row.instanceKey,
        instance_label: row.instanceLabel,
        display_label: row.displayLabel,
        unit: row.unit,
        ...parsed,
      });
    }
    return entries;
  }, [rows]);

  const reasonOk = reason.trim().length > 0;

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        key: `new-${prev.length}-${Date.now()}`,
        existingId: null,
        resultName: "",
        instanceKey: null,
        instanceLabel: null,
        displayLabel: null,
        unit: null,
        input: "",
        currentValue: null,
        currentText: null,
        isNew: true,
      },
    ]);

  const updateRow = (key: string, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: string) =>
    setRows((prev) => prev.filter((r) => r.key !== key || !r.isNew));

  const submit = async () => {
    if (!context || !reasonOk || changedEntries.length === 0) return;
    try {
      const payload = buildReplaceResultsPayload({
        orderMeasurementId: context.measurementId,
        operationId: crypto.randomUUID(),
        reason,
        results: changedEntries,
      });
      const summary = await replace.mutateAsync(payload);
      toast.success("Ergebnisse gespeichert", {
        description: `${summary.added_count} ergänzt, ${summary.updated_count} geändert, ${summary.unchanged_count} unverändert. Alle Änderungen wurden in der Historie dokumentiert.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Speichern nicht möglich", { description: err?.message });
    }
  };

  if (!context) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ergebnisse ändern / ergänzen</DialogTitle>
          <DialogDescription>
            {context.serviceName} · Probe <span className="font-mono">{context.sampleNumber}</span>
            {context.measurementNumber ? (
              <>
                {" "}· Analyse <span className="font-mono">{context.measurementNumber}</span>
              </>
            ) : null}
            . Jede Wertänderung und Ergänzung wird mit Begründung in der
            Änderungshistorie dokumentiert. Zahlen (auch „0“) und Texte wie
            „n.b.“ oder „&lt; 0.1“ sind zulässig.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Ergebnisse werden geladen…</p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parameter</TableHead>
                  <TableHead className="w-40">Wert</TableHead>
                  <TableHead className="w-24">Einheit</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      {row.isNew ? (
                        <Input
                          value={row.resultName}
                          onChange={(e) => updateRow(row.key, { resultName: e.target.value })}
                          placeholder="Parametername"
                          className="h-8"
                        />
                      ) : (
                        <span>
                          {row.displayLabel ?? row.resultName}
                          {row.instanceLabel ? (
                            <span className="text-muted-foreground"> · {row.instanceLabel}</span>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.input}
                        onChange={(e) => updateRow(row.key, { input: e.target.value })}
                        placeholder="z. B. 12,5 oder n.b."
                        className="h-8 font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      {row.isNew ? (
                        <Input
                          value={row.unit ?? ""}
                          onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        <span className="text-muted-foreground">{row.unit ?? ""}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.isNew && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeRow(row.key)}
                          aria-label="Zeile entfernen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      Keine Ergebnisse vorhanden – fehlende Ergebnisse können ergänzt werden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Ergebnis ergänzen
          </Button>
          <span className="text-xs text-muted-foreground">
            {changedEntries.length} Änderung{changedEntries.length === 1 ? "" : "en"} vorgemerkt
          </span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="replace-reason">
            Begründung der Änderung <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="replace-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="z. B. Ersetzung durch korrigierte Auswertung der Messdatei."
          />
          {!reasonOk && (
            <p className="text-xs text-muted-foreground">
              Ohne Begründung können die Änderungen nicht gespeichert werden.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={submit}
            disabled={!reasonOk || changedEntries.length === 0 || replace.isPending}
          >
            Änderungen speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
