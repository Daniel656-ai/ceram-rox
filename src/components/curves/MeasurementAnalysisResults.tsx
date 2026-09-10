import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import BjhChartsPanel from "./BjhChartsPanel";
import CurveViewer from "./CurveViewer";
import {
  ANALYSIS_LABELS, detectAnalysisKind, sortByAnalysisOrder, type AnalysisKind,
} from "@/lib/curves/analysisTypes";
import type { MeasurementRawDataset } from "@/lib/api/measurementRawData";

/**
 * Fertige Ergebnisdarstellung importierter Messdaten.
 *
 * Der Auftraggeber muss kein Diagramm erstellen: Aus dem gespeicherten
 * Rohdatensatz wird der Auswertungstyp erkannt und die dafür bereits
 * definierten Diagramme werden direkt angezeigt – untereinander in der festen
 * Reihenfolge BJH → STA → DIL. Es entsteht keine zweite Diagrammlogik: BJH
 * nutzt die Definitionen des BJH-Importprofils (`bjhCharts.ts`), STA/DIL die
 * gespeicherte Signalzuordnung des Messtechnikers.
 */

function AnalysisSection({ head, kind }: { head: MeasurementRawDataset; kind: AnalysisKind }) {
  const { data: dataset, error } = useQuery({
    queryKey: ["measurement-raw-dataset", head.id],
    queryFn: () => api.measurementRawData.loadDataset(head.id),
    retry: false,
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["measurement-curve-evaluations", head.id],
    queryFn: () => api.measurementRawData.listEvaluations(head.id),
  });

  const defaults = useMemo(() => {
    const m = head.signal_mapping;
    if (!m) return undefined;
    return { xKey: m.x_key ?? undefined, yKeys: m.y_keys ?? [], y2Key: m.y2_key ?? null };
  }, [head]);

  if (error) {
    return (
      <p className="text-xs text-destructive flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" /> {(error as Error).message}
      </p>
    );
  }
  if (!dataset || dataset.rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{ANALYSIS_LABELS[kind]}</h3>
        <Badge variant="outline">{head.source_file_name ?? "Messdatei"}</Badge>
        {head.instrument && <span className="text-xs text-muted-foreground">{head.instrument}</span>}
        <span className="text-xs text-muted-foreground">{head.point_count} Messpunkte</span>
      </div>

      {evaluations.length > 0 && (
        <div className="rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Kennwert</th>
                <th className="text-left p-2">Kurve</th>
                <th className="text-left p-2">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">{e.method_label ?? e.method}</td>
                  <td className="p-2">{e.y_channel} über {e.x_channel}</td>
                  <td className="p-2 font-mono">
                    {e.value ?? "—"}{e.unit ? ` ${e.unit}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {kind === "BJH"
        ? <BjhChartsPanel dataset={dataset} />
        : <CurveViewer dataset={dataset} defaults={defaults} />}
    </section>
  );
}

export default function MeasurementAnalysisResults({
  datasets,
}: {
  datasets: MeasurementRawDataset[];
}) {
  // Nur tatsächlich vorhandene Auswertungen, in fester fachlicher Reihenfolge.
  const ordered = useMemo(
    () => sortByAnalysisOrder(datasets).map((d) => ({ head: d, kind: detectAnalysisKind(d) })),
    [datasets]
  );

  if (ordered.length === 0) return null;

  return (
    <div className="space-y-8">
      {ordered.map(({ head, kind }) => (
        <AnalysisSection key={head.id} head={head} kind={kind} />
      ))}
    </div>
  );
}
