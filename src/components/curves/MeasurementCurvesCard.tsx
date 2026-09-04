import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart } from "lucide-react";
import CurveViewer from "./CurveViewer";
import CurvePointEvaluations from "./CurvePointEvaluations";

interface Props {
  measurementId: string;
  /** Wird beibehalten, hat in der Messtechnik-Ansicht keine Wirkung mehr. */
  readOnly?: boolean;
}

/**
 * Kontrollansicht der gespeicherten Rohdaten einer Messung.
 *
 * Der Messtechniker prüft hier nur, ob die Rohdaten vollständig übernommen und
 * die Signale richtig zugeordnet sind. Diagrammerstellung und Auswertung
 * erfolgen später durch den Auftragsersteller im Auftrag.
 */
export default function MeasurementCurvesCard({ measurementId }: Props) {
  const [activeId, setActiveId] = useState<string>("");

  const { data: datasets = [] } = useQuery({
    queryKey: ["measurement-raw-datasets", measurementId],
    queryFn: () => api.measurementRawData.listByMeasurement(measurementId),
    enabled: !!measurementId,
  });

  const currentId = activeId || datasets[0]?.id || "";
  const head = datasets.find((d) => d.id === currentId) ?? null;

  const { data: dataset, error } = useQuery({
    queryKey: ["measurement-raw-dataset", currentId],
    queryFn: () => api.measurementRawData.loadDataset(currentId),
    enabled: !!currentId,
    retry: false,
  });

  /** Gespeicherte Signalzuordnung wieder herstellen. */
  const defaults = head?.signal_mapping
    ? { xKey: head.signal_mapping.x_key ?? undefined, yKeys: head.signal_mapping.y_keys ?? [], y2Key: head.signal_mapping.y2_key ?? null }
    : undefined;

  const { data: evaluations = [] } = useQuery({
    queryKey: ["measurement-curve-evaluations", currentId],
    queryFn: () => api.measurementRawData.listEvaluations(currentId),
    enabled: !!currentId,
  });

  /** Gespeicherte Auswertungspunkte im Graphen sichtbar machen. */
  const markers = useMemo(() => {
    const byGroup = new Map<string, { x: number; values: { yKey: string; value: number | null }[] }>();
    for (const e of evaluations) {
      if (e.kind !== "point") continue;
      const key = e.group_id ?? e.id;
      const g = byGroup.get(key) ?? { x: Number(e.x_at ?? e.x_from), values: [] };
      g.values.push({ yKey: e.y_channel, value: e.value == null ? null : Number(e.value) });
      byGroup.set(key, g);
    }
    return [...byGroup.values()];
  }, [evaluations]);

  if (datasets.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LineChart className="h-4 w-4" /> Importierte Messkurven
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {datasets.length > 1 && (
          <Select value={currentId} onValueChange={(v) => setActiveId(v)}>
            <SelectTrigger className="h-8 max-w-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {datasets.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.source_file_name ?? "Messdatei"}
                  {d.instance_label ? ` · ${d.instance_label}` : ""}
                  {d.measurement_type ? ` · ${d.measurement_type}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {head && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{head.source_file_name ?? "Messdatei"}</Badge>
            {head.instrument && <span>{head.instrument}</span>}
            <span>{head.point_count} Messpunkte</span>
            <span>{new Date(head.created_at).toLocaleString("de-AT")}</span>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">{(error as Error).message}</p>
        )}

        {dataset && dataset.rows.length > 0 && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Kontrolle der gespeicherten Rohdaten und Signalzuordnung. Die Auswertung
              erfolgt später im Auftrag durch den Auftragsersteller.
            </p>
            <CurveViewer dataset={dataset} defaults={defaults} markers={markers} />
            <CurvePointEvaluations
              datasetId={currentId}
              dataset={dataset}
              xKey={defaults?.xKey ?? dataset.channels[0]?.key ?? ""}
              yKeys={defaults?.yKeys ?? []}
              records={evaluations}
              readOnly
              onChanged={() => {}}
            />
          </>
        )}

        {evaluations.some((e) => e.kind !== "point") && (
          <div className="rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Auswertung</th>
                  <th className="text-left p-2">Kurve</th>
                  <th className="text-left p-2">Bereich</th>
                  <th className="text-left p-2">Ergebnis</th>
                  <th className="text-left p-2">Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.filter((e) => e.kind !== "point").map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{e.method_label ?? e.method}</td>
                    <td className="p-2">{e.y_channel} über {e.x_channel}</td>
                    <td className="p-2">{e.x_from}–{e.x_to}{e.x_unit ? ` ${e.x_unit}` : ""}</td>
                    <td className="p-2 font-mono">
                      {e.value ?? "—"}{e.unit ? ` ${e.unit}` : ""}
                      {e.measurement_result_id && <Badge variant="secondary" className="ml-2">offiziell</Badge>}
                    </td>
                    <td className="p-2">{new Date(e.created_at).toLocaleString("de-AT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
