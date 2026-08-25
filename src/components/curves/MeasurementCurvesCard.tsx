import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart } from "lucide-react";
import CurveViewer, { type CurveSelection } from "./CurveViewer";
import CurveEvaluationPanel from "./CurveEvaluationPanel";

interface Props {
  measurementId: string;
  /** Ohne Bearbeitungsrecht sind nur Ansicht und Berechnung möglich. */
  readOnly?: boolean;
}

/**
 * Zeigt die zu einer Messung gespeicherten Rohdaten (Messkurven) wieder an und
 * erlaubt erneute Auswertungen. Es entsteht keine zweite Datenhaltung – die
 * Daten stammen aus den beim Import gespeicherten Datensätzen.
 */
export default function MeasurementCurvesCard({ measurementId, readOnly }: Props) {
  const [activeId, setActiveId] = useState<string>("");
  const [selection, setSelection] = useState<CurveSelection | null>(null);

  const { data: datasets = [] } = useQuery({
    queryKey: ["measurement-raw-datasets", measurementId],
    queryFn: () => api.measurementRawData.listByMeasurement(measurementId),
    enabled: !!measurementId,
  });

  const currentId = activeId || datasets[0]?.id || "";
  const head = datasets.find((d) => d.id === currentId) ?? null;

  const { data: dataset } = useQuery({
    queryKey: ["measurement-raw-dataset", currentId],
    queryFn: () => api.measurementRawData.loadDataset(currentId),
    enabled: !!currentId,
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["measurement-curve-evaluations", currentId],
    queryFn: () => api.measurementRawData.listEvaluations(currentId),
    enabled: !!currentId,
  });

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
          <Select value={currentId} onValueChange={(v) => { setActiveId(v); setSelection(null); }}>
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

        {dataset && dataset.rows.length > 0 && (
          <>
            <CurveViewer dataset={dataset} onSelectionChange={setSelection} />
            {!readOnly && <CurveEvaluationPanel dataset={dataset} selection={selection} />}
          </>
        )}

        {evaluations.length > 0 && (
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
                {evaluations.map((e) => (
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
