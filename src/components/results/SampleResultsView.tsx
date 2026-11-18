import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FlaskConical, History, ClipboardList, PanelRightOpen, PencilLine, X, MoreHorizontal, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { prepareDisplayResults, splitInternalResults, type ImportProtocol } from "@/lib/results/internalResults";
import CompletedResultForm from "@/components/CompletedResultForm";
import RequesterConditionsPanel from "@/components/results/RequesterConditionsPanel";
import CorrectionHistoryDialog from "@/components/results/CorrectionHistoryDialog";
import ResultCorrectionDialog, { type CorrectionContext } from "@/components/results/ResultCorrectionDialog";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { resultLabel, type ResultRecord } from "@/hooks/useResultsDatabase";
import { useCanCorrectResults } from "@/hooks/useResultCorrections";
import {
  formatSampleDate,
  groupResultsByInstance,
  isOfficialResult,
  type SampleGroup,
  type SampleMeasurementRecord,
  type SampleResultValue,
} from "@/lib/results/sampleResultsAggregation";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });

/** Lesbare, verlustfreie Darstellung komplexer JSON-Werte (z. B. Repeater-Einträge). */
function fmtJsonValue(parsed: unknown): string {
  const entry = (obj: Record<string, unknown>) =>
    Object.entries(obj)
      .filter(([k]) => !k.startsWith("__"))
      .map(([k, v]) => `${k}: ${typeof v === "object" && v !== null ? fmtJsonValue(v) : String(v)}`)
      .join(", ");
  if (Array.isArray(parsed))
    return parsed
      .map((item, i) => {
        const inner = typeof item === "object" && item !== null && !Array.isArray(item)
          ? entry(item as Record<string, unknown>)
          : String(item);
        return parsed.length > 1 ? `Eintrag ${i + 1} – ${inner}` : inner;
      })
      .join(" | ");
  if (typeof parsed === "object" && parsed !== null) return entry(parsed as Record<string, unknown>);
  return String(parsed);
}

function fmtValue(r: SampleResultValue): string {
  if (r.value !== null && r.value !== undefined) return nf.format(r.value);
  if (r.remarks) {
    try {
      return fmtJsonValue(JSON.parse(r.remarks));
    } catch {
      return r.remarks;
    }
  }
  return "–";
}

/**
 * Vollständige Messwerttabelle einer Analyse: jeder gespeicherte Wert genau
 * einmal, Durchläufe (Messdatenblock/Repeater) als eigene Abschnitte.
 * Offizielle Ergebnisse sind deutlich hervorgehoben.
 */
export function SampleMeasurementResultsTable({
  measurement,
  onCorrect,
}: {
  measurement: SampleMeasurementRecord;
  onCorrect?: (ctx: CorrectionContext) => void;
}) {
  const canCorrect = useCanCorrectResults();
  // Interne Einträge (Importprotokoll) sind keine Messwerte: nicht in der Tabelle.
  const { visible, protocols } = useMemo(() => prepareDisplayResults(measurement.results), [measurement.results]);
  const instances = useMemo(() => groupResultsByInstance(visible), [visible]);

  return (
    <div className="space-y-3">
      {instances.map((inst) => (
        <div key={inst.instanceKey || "__base"} className="space-y-1">
          {inst.instanceKey && (
            <p className="text-xs font-medium text-muted-foreground">
              Durchlauf: <span className="text-foreground">{inst.instanceLabel || inst.instanceKey}</span>
            </p>
          )}
          <HorizontalScrollArea className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left font-medium">Parameter</th>
                  <th className="p-2 text-right font-medium">Wert</th>
                  <th className="p-2 text-left font-medium">Einheit</th>
                  <th className="p-2 text-left font-medium">Status</th>
                  <th className="p-2 text-left font-medium">Gemessen am</th>
                  {onCorrect && <th className="p-2" />}
                </tr>
              </thead>
              <tbody>
                {inst.results.map((r) => {
                  const official = isOfficialResult(r);
                  return (
                    <tr
                      key={r.id}
                      className={official ? "border-t bg-primary/5" : "border-t"}
                    >
                      <td className={`p-2 ${official ? "font-semibold" : ""}`}>{resultLabel(r)}</td>
                      <td className={`p-2 text-right font-mono ${official ? "font-semibold" : ""}`}>
                        {fmtValue(r)}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{r.unit || "–"}</td>
                      <td className="p-2">
                        {official ? (
                          <Badge variant="default" className="text-[10px]">Offiziell</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Vorläufig / Intern</Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{formatSampleDate(r.measured_at)}</td>
                      {onCorrect && (
                        <td className="p-2 text-right">
                          {canCorrect && !(r as { derived?: boolean }).derived && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`Ergebnis ${resultLabel(r)} korrigieren`}
                              onClick={() =>
                                onCorrect({
                                  resultId: r.id,
                                  parameterLabel: resultLabel(r),
                                  unit: r.unit,
                                  currentValue: r.value,
                                  currentText: r.value === null ? fmtValue(r) : null,
                                  sampleNumber: measurement.sampleNumber,
                                  sampleName: measurement.sampleName,
                                  orderNumber: measurement.orderDisplayNumber || measurement.orderNumber,
                                  serviceName: measurement.serviceName,
                                  analysisLabel: inst.instanceLabel
                                    ? `${measurement.measurementNumber} · ${inst.instanceLabel}`
                                    : measurement.measurementNumber,
                                })
                              }
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </HorizontalScrollArea>
        </div>
      ))}
      {protocols.map((p, i) => (
        <ImportProtocolInfo key={i} protocol={p} />
      ))}
    </div>
  );
}

/** Kompakte Importinfo mit aufklappbaren Details (statt technischem Rohtext). */
export function ImportProtocolInfo({ protocol: p }: { protocol: ImportProtocol }) {
  const [open, setOpen] = useState(false);
  const date = p.importedAt ? formatSampleDate(p.importedAt) : null;
  const rows: Array<[string, string]> = [];
  if (p.profile) rows.push(["Profil", p.profile]);
  if (p.sample) rows.push(["Probe in der Datei", p.sample]);
  if (p.source) rows.push(["Quelle", p.source]);
  if (p.count !== null) rows.push(["Übernommene Werte", String(p.count)]);
  if (p.unassignedCount > 0) rows.push(["Nicht zugeordnete Werte", String(p.unassignedCount)]);
  if (p.hasCurves) rows.push(["Kurven", "vorhanden (siehe Rohdaten & Kurven)"]);
  if (p.rawDatasetId) rows.push(["Rohdaten-ID", p.rawDatasetId]);
  for (const m of p.metadata) rows.push([m.label, m.value]);
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Info className="h-3.5 w-3.5" />
        <span>
          Importiert{date ? ` am ${date}` : ""}
          {p.source ? ` aus ${p.source}` : ""}
          {p.profile ? ` (${p.profile})` : ""}
        </span>
      </button>
      {open && rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
          {rows.map(([k, v], i) => (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Ebene 2: alle Messungen einer Probe im fachlichen Zusammenhang.
 * Formularlayout (Formulardesigner) ist maßgeblich; die vollständige
 * Messwerttabelle darunter garantiert verlustfreie Darstellung inklusive
 * historischer Messungen ohne Formularlayout (Fallback).
 */
export default function SampleResultsView({
  group,
  onBack,
  backLabel = "Zurück",
  onClose,
  onOpenInspector,
}: {
  group: SampleGroup;
  /** Optional: Rücksprung (z. B. zur Ergebnisübersicht des Auftrags). */
  onBack?: () => void;
  backLabel?: string;
  /** Schließt die Seitenleiste. */
  onClose?: () => void;
  onOpenInspector: (measurement: SampleMeasurementRecord) => void;
}) {
  const [conditionsRecord, setConditionsRecord] = useState<ResultRecord | null>(null);
  const [historyFor, setHistoryFor] = useState<SampleMeasurementRecord | null>(null);
  const [correction, setCorrection] = useState<CorrectionContext | null>(null);
  // Analysen starten eingeklappt (nur Kopfzeile); bei genau einer Analyse gleich offen.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(group.measurements.length === 1 ? [group.measurements[0].measurementId] : []),
  );
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toConditionsRecord = (m: SampleMeasurementRecord): ResultRecord =>
    ({
      measurementId: m.measurementId,
      measurementNumber: m.measurementNumber,
      orderId: m.orderId,
      orderNumber: m.orderNumber,
      orderIdentity: { number: m.orderDisplayNumber },
      orderType: m.orderType,
      projectNumber: m.projectNumber,
      projectName: m.projectName,
      sampleId: m.sampleId,
      sampleNumber: m.sampleNumber,
      sampleName: m.sampleName,
      originalSampleNumber: m.originalSampleNumber,
      serviceId: m.serviceId,
      serviceName: m.serviceName,
      serviceCategory: m.serviceCategory,
      assignedToId: m.assignedToId,
      assignedToName: m.assignedToName,
      createdById: m.createdById,
      createdByName: m.createdByName,
      status: m.status,
      completedAt: m.completedAt,
      createdAt: m.createdAt,
      actualDurationHours: null,
      standardDurationHours: 0,
      inputParameters: {},
      outputResults: m.results,
      remarks: m.remarks,
      instanceKey: null,
      instanceLabel: null,
      orderSharedFormData: m.orderSharedFormData,
    } as unknown as ResultRecord);

  return (
    <div className="space-y-4">
      {(onBack || onClose) && (
        <div className="flex items-center justify-between gap-3">
          {onBack ? (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
            </Button>
          ) : <span />}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Seitenleiste schließen" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Probe <span className="font-mono">{group.sampleNumber || "–"}</span>
            {group.sampleName && <span className="font-normal text-muted-foreground">· {group.sampleName}</span>}
            {group.originalSampleNumber && (
              <Badge variant="outline" className="text-[10px]">
                Ersatzprobe für {group.originalSampleNumber}
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Projekt: {group.projectNames.join(", ") || "–"} · Auftrag:{" "}
            <span className="font-mono">{group.orderDisplayNumbers.join(", ") || "–"}</span> ·{" "}
            {group.measurements.length} Analysen · {group.officialCount} offizielle und{" "}
            {group.interimCount} vorläufige Messwerte
          </p>
        </CardHeader>
      </Card>

      {group.measurements.map((m) => {
        // Interne Einträge (Importprotokoll) zählen nicht als Messwerte.
        const real = splitInternalResults(m.results).visible;
        const officialCount = real.filter(isOfficialResult).length;
        const interimCount = real.length - officialCount;
        const isOpen = expanded.has(m.measurementId);
        return (
          <Card key={m.measurementId}>
            <CardHeader className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
                  onClick={() => toggleExpanded(m.measurementId)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <CardTitle className="text-base">{m.serviceName || "Messung"}</CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px]">{m.measurementNumber}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{m.status}</Badge>
                  <Badge variant="default" className="text-[10px]">{officialCount} offiziell</Badge>
                  {interimCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{interimCount} vorläufig</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Auftrag <span className="font-mono">{m.orderDisplayNumber || m.orderNumber}</span>
                    {m.assignedToName ? ` · ${m.assignedToName}` : ""}
                    {m.completedAt ? ` · ${formatSampleDate(m.completedAt)}` : ""}
                  </span>
                </button>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenInspector(m)}>
                    <PanelRightOpen className="mr-1 h-3.5 w-3.5" /> Details
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Weitere Aktionen">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setConditionsRecord(toConditionsRecord(m))}>
                        <ClipboardList className="mr-2 h-4 w-4" /> Auftraggeber-Vorgaben
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistoryFor(m)}>
                        <History className="mr-2 h-4 w-4" /> Änderungshistorie
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent>
                {/* Standard: kompakte, vollständige Wertetabelle. Das Original-Formular
                    (Formulardesigner, schreibgeschützt) wird nur auf Klick geladen. */}
                <Tabs defaultValue="values">
                  <TabsList>
                    <TabsTrigger value="values">Werte</TabsTrigger>
                    <TabsTrigger value="form">Formular</TabsTrigger>
                  </TabsList>
                  <TabsContent value="values" className="mt-3">
                    <SampleMeasurementResultsTable measurement={m} onCorrect={setCorrection} />
                  </TabsContent>
                  <TabsContent value="form" className="mt-3">
                    <CompletedResultForm
                      measurementId={m.measurementId}
                      serviceId={m.serviceId}
                      measurementNumber={m.measurementNumber}
                      serviceName={m.serviceName}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            )}
          </Card>
        );
      })}

      <RequesterConditionsPanel record={conditionsRecord} onClose={() => setConditionsRecord(null)} />
      <CorrectionHistoryDialog
        open={!!historyFor}
        onOpenChange={(o) => !o && setHistoryFor(null)}
        measurementId={historyFor?.measurementId ?? ""}
        measurementNumber={historyFor?.measurementNumber}
      />
      <ResultCorrectionDialog
        open={!!correction}
        onOpenChange={(o) => !o && setCorrection(null)}
        context={correction}
      />
    </div>
  );
}
