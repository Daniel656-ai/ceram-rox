/**
 * „m³-Beprobungsaufträge – Proben-Nachprüfung" (nur Master).
 * Vorschau liest ausschließlich; geschrieben wird erst nach Bestätigung über die
 * atomare Server-Funktion je Auftrag. Gleiche Probenlogik wie die Neuanlage.
 */
import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { readM3Constants } from "@/lib/m3List/constants";
import { deriveM3Values } from "@/lib/m3List/derive";
import { M3_ROWS_KEY } from "@/lib/m3List/template";
import { resolveTestMarkingRows } from "@/lib/m3List/testMarking";
import { planM3Samples } from "@/lib/m3List/sampleNumber";
import { analyzeM3Retrofit, type RetrofitAnalysis } from "@/lib/m3List/retrofit";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Entry { orderId: string; orderNumber: string; releaseLabel: string; articleNumber: string; existing: number; analysis: RetrofitAnalysis }

async function loadPreview(): Promise<Entry[]> {
  const [docs, globalFields] = await Promise.all([api.m3Retrofit.listCandidates(), api.globalFields.list()]);
  const constants = readM3Constants(globalFields as never[]).constants;
  const out: Entry[] = [];
  for (const d of docs) {
    const o = d.measurement_orders;
    if (!o) continue;
    const release = d.based_on_release_id ? ((await api.productionReleases.get(d.based_on_release_id)) as Record<string, unknown>) : null;
    const stored = (d.form_values ?? {}) as Record<string, unknown>;
    const derived = deriveM3Values({ release, orderNumber: o.order_number, stored, constants });
    const rows = (Array.isArray(derived.values[M3_ROWS_KEY]) ? derived.values[M3_ROWS_KEY] : []) as Record<string, unknown>[];
    const marking = resolveTestMarkingRows(stored, rows);
    const articleNumber = release?.article_number ?? derived.values.article_number;
    let numbers: string[] = [];
    try { numbers = planM3Samples(articleNumber, rows, marking).map((p) => p.sampleNumber); } catch { /* analysis reports it */ }
    const linkedSamples = (o.order_samples ?? []).map((x: any) => x.samples).filter(Boolean);
    const analysis = analyzeM3Retrofit({
      orderId: o.id, orderStatus: o.status, articleNumber, rows, marking, linkedSamples,
      samplesByNumber: await api.m3Retrofit.samplesByNumbers(numbers),
      measurements: (o.order_measurements ?? []).map((m: any) => ({
        id: m.id, service_id: m.service_id, sample_id: m.sample_id, status: m.status,
        service_name: m.measurement_services?.service_name, has_results: (m.measurement_results ?? []).length > 0,
      })),
    });
    out.push({
      orderId: o.id, orderNumber: o.order_number ?? "–", releaseLabel: String(derived.values.release_label ?? release?.release_number ?? "–"),
      articleNumber: String(articleNumber ?? "–"), existing: linkedSamples.length, analysis,
    });
  }
  return out.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
}

const STATUS: Record<RetrofitAnalysis["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  possible: { label: "Nachrüstung möglich", variant: "default" },
  review: { label: "Prüfung erforderlich", variant: "destructive" },
  complete: { label: "vollständig", variant: "secondary" },
};

export default function M3SampleRetrofitPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<string[] | null>(null);
  const { data = [], isFetching, refetch, isFetched } = useQuery({ queryKey: ["m3-retrofit-preview"], queryFn: loadPreview, enabled: false });
  const possible = data.filter((e) => e.analysis.status === "possible");

  const run = async () => {
    setRunning(true);
    const sum = { created: 0, linked: 0, assigned: 0, new_tasks: 0 }; const errors: string[] = [];
    for (const e of possible) {
      try {
        const r = await api.m3Retrofit.execute(e.orderId, e.analysis.plan);
        sum.created += r.created; sum.linked += r.linked; sum.assigned += r.assigned; sum.new_tasks += r.new_tasks;
      } catch (err) { errors.push(`${e.orderNumber}: ${err instanceof Error ? err.message : String(err)}`); }
    }
    setReport([
      `Geprüfte Aufträge: ${data.length}`,
      `Vollständig: ${data.filter((e) => e.analysis.status === "complete").length}`,
      `Neu angelegte Proben: ${sum.created}`,
      `Ergänzte Verknüpfungen: ${sum.linked + sum.assigned} (davon Aufgaben zugeordnet: ${sum.assigned}) · neue Aufgaben: ${sum.new_tasks}`,
      `Übersprungen / nicht eindeutig: ${data.filter((e) => e.analysis.status === "review").length}`,
      `Fehler: ${errors.length}`, ...errors,
    ]);
    setRunning(false); setConfirm(false);
    await qc.invalidateQueries({ queryKey: ["orders"] });
    await refetch();
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">m³-Beprobungsaufträge – Proben-Nachprüfung</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "Prüfe…" : "Vorschau laden"}</Button>
          <Button onClick={() => setConfirm(true)} disabled={!possible.length || running}>Nachrüstung starten ({possible.length})</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Die Vorschau ändert keine Daten. Aufträge mit „Prüfung erforderlich“ werden nicht automatisch geändert.</p>
        {report && <div className="rounded-md border p-3 text-sm space-y-0.5">{report.map((l, i) => <div key={i}>{l}</div>)}</div>}
        {isFetched && (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Auftrag</TableHead><TableHead>Fertigungsfreigabe</TableHead><TableHead>Artikelnummer</TableHead>
              <TableHead>Vorhanden</TableHead><TableHead>Fehlend</TableHead><TableHead>Nachzurüsten</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((e) => (
                <Fragment key={e.orderId}>
                  <TableRow key={e.orderId} className="cursor-pointer" onClick={() => setOpen(open === e.orderId ? null : e.orderId)}>
                    <TableCell className="font-mono">{e.orderNumber}</TableCell>
                    <TableCell>{e.releaseLabel}</TableCell>
                    <TableCell className="font-mono">{e.articleNumber}</TableCell>
                    <TableCell>{e.existing}</TableCell>
                    <TableCell>{e.analysis.rows.filter((r) => r.state === "missing").length}</TableCell>
                    <TableCell className="font-mono text-xs">{e.analysis.rows.filter((r) => r.state === "missing").map((r) => r.sampleNumber).join(", ") || "–"}</TableCell>
                    <TableCell><Badge variant={STATUS[e.analysis.status].variant}>{STATUS[e.analysis.status].label}</Badge></TableCell>
                  </TableRow>
                  {open === e.orderId && (
                    <TableRow key={e.orderId + "-d"}><TableCell colSpan={7} className="bg-muted/40 text-xs space-y-1">
                      {e.analysis.reasons.map((r, i) => <div key={i} className="text-destructive">{r}</div>)}
                      {e.analysis.rows.map((r) => (
                        <div key={r.sampleNumber}>
                          Zeile {r.rowIndex + 1} · Element {r.elementNumber} → <span className="font-mono">{r.sampleNumber}</span> ·{" "}
                          {{ exists: "vorhanden", missing: "fehlt", link: "vorhanden, Verknüpfung fehlt", conflict: "Konflikt" }[r.state]}
                          {r.services.length ? ` · Dienstleistungen: ${r.services.join(", ")}` : ""}
                        </div>
                      ))}
                    </TableCell></TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nachrüstung starten?</AlertDialogTitle>
            <AlertDialogDescription>
              Für {possible.length} Auftrag/Aufträge werden ausschließlich fehlende Proben angelegt und eindeutig zuordenbare Verknüpfungen ergänzt. Vorhandene Proben und Ergebnisse bleiben unverändert. Jeder Auftrag wird vollständig oder gar nicht geändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={running} onClick={(ev) => { ev.preventDefault(); run(); }}>{running ? "Läuft…" : "Bestätigen"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
