import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FlaskConical, History, ClipboardList, PanelRightOpen, PencilLine } from "lucide-react";
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

function fmtValue(r: SampleResultValue): string {
  if (r.value !== null && r.value !== undefined) return nf.format(r.value);
  if (r.remarks) {
    try {
      const parsed = JSON.parse(r.remarks);
      return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
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
  const instances = useMemo(() => groupResultsByInstance(measurement.results), [measurement.results]);

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
                          {canCorrect && (
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
  onOpenInspector,
}: {
  group: SampleGroup;
  onBack: () => void;
  onOpenInspector: (measurement: SampleMeasurementRecord) => void;
}) {
  const [conditionsRecord, setConditionsRecord] = useState<ResultRecord | null>(null);
  const [historyFor, setHistoryFor] = useState<SampleMeasurementRecord | null>(null);
  const [correction, setCorrection] = useState<CorrectionContext | null>(null);

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
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurück zur Probenübersicht
        </Button>
      </div>

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
        const officialCount = m.results.filter(isOfficialResult).length;
        const interimCount = m.results.length - officialCount;
        return (
          <Card key={m.measurementId}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {m.serviceName || "Messung"}
                  <Badge variant="outline" className="font-mono text-[10px]">{m.measurementNumber}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{m.status}</Badge>
                  <Badge variant="default" className="text-[10px]">{officialCount} offiziell</Badge>
                  {interimCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{interimCount} vorläufig</Badge>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConditionsRecord(toConditionsRecord(m))}>
                    <ClipboardList className="mr-1 h-3.5 w-3.5" /> Auftraggeber-Vorgaben
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHistoryFor(m)}>
                    <History className="mr-1 h-3.5 w-3.5" /> Änderungshistorie
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenInspector(m)}>
                    <PanelRightOpen className="mr-1 h-3.5 w-3.5" /> Details
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Auftrag <span className="font-mono">{m.orderDisplayNumber || m.orderNumber}</span>
                {m.projectName ? ` · Projekt ${m.projectName}` : ""}
                {m.assignedToName ? ` · Messdienstleister ${m.assignedToName}` : ""}
                {m.completedAt ? ` · abgeschlossen am ${formatSampleDate(m.completedAt)}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fachlicher Zusammenhang: Formularlayout aus dem Formulardesigner (schreibgeschützt). */}
              <CompletedResultForm
                measurementId={m.measurementId}
                serviceId={m.serviceId}
                measurementNumber={m.measurementNumber}
                serviceName={m.serviceName}
              />
              {/* Verlustfreie Gesamtsicht aller Werte (Fallback bei historischen
                  Messungen ohne Formularlayout und offizielle Kennzeichnung). */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Alle Messwerte dieser Analyse (jeder gespeicherte Wert genau einmal)
                </p>
                <SampleMeasurementResultsTable measurement={m} onCorrect={setCorrection} />
              </div>
            </CardContent>
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
