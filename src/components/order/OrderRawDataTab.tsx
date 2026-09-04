import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LineChart, AlertTriangle, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import CurvePointEvaluations from "@/components/curves/CurvePointEvaluations";
import { downloadText, rawDataCsv, evaluationCsv, exportEvaluationPdf } from "@/lib/curves/export";
import CurveViewer, { type CurveSelection } from "@/components/curves/CurveViewer";
import CurveEvaluationPanel from "@/components/curves/CurveEvaluationPanel";

/**
 * Auswertung der Rohdaten durch den Auftragsersteller.
 *
 * Der Messtechniker liefert ausschließlich Rohdaten samt Signalzuordnung.
 * Diagrammerstellung und fachliche Auswertung erfolgen hier – strikt getrennt
 * von den Rohdaten, die dabei nie verändert werden.
 */
export default function OrderRawDataTab({ orderId, canEvaluate }: { orderId: string; canEvaluate: boolean }) {
  const [activeId, setActiveId] = useState<string>("");
  const [selection, setSelection] = useState<CurveSelection | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const { data: datasets = [] } = useQuery({
    queryKey: ["order-raw-datasets", orderId],
    queryFn: () => api.measurementRawData.listByOrder(orderId),
    enabled: !!orderId,
  });

  const currentId = activeId || datasets[0]?.id || "";
  const head = datasets.find((d) => d.id === currentId) ?? null;

  const { data: dataset, error } = useQuery({
    queryKey: ["measurement-raw-dataset", currentId],
    queryFn: () => api.measurementRawData.loadDataset(currentId),
    enabled: !!currentId,
    retry: false,
  });

  const { data: evaluations = [], refetch: refetchEvaluations } = useQuery({
    queryKey: ["measurement-curve-evaluations", currentId],
    queryFn: () => api.measurementRawData.listEvaluations(currentId),
    enabled: !!currentId,
  });

  /** Gespeicherte Signalzuordnung des Messtechnikers als Ausgangspunkt. */
  const defaults = useMemo(() => {
    const m = head?.signal_mapping;
    if (!m) return undefined;
    return { xKey: m.x_key ?? undefined, yKeys: m.y_keys ?? [], y2Key: m.y2_key ?? null };
  }, [head]);

  /** Auswertungspunkte als Marker für den Graphen. */
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

  const baseName = (head?.source_file_name ?? "messdaten").replace(/\.[^.]+$/, "");

  const exportRaw = () => {
    if (!dataset) return;
    downloadText(
      rawDataCsv(dataset, {
        Messdatei: head?.source_file_name,
        Gerät: head?.instrument,
        Messpunkte: String(head?.point_count ?? dataset.rows.length),
      }),
      `${baseName}_rohdaten.csv`
    );
  };

  const exportEvaluationsCsv = () => {
    downloadText(
      evaluationCsv(evaluations, { Messdatei: head?.source_file_name, Gerät: head?.instrument }),
      `${baseName}_auswertung.csv`
    );
  };

  const exportEvaluationsPdf = async () => {
    try {
      await exportEvaluationPdf({
        title: `Auswertung – ${head?.source_file_name ?? "Messdaten"}`,
        subtitle: head?.instrument ?? undefined,
        records: evaluations,
        chartElement: chartRef.current,
        fileName: `${baseName}_auswertung.pdf`,
      });
    } catch (e) {
      toast.error(`Export fehlgeschlagen: ${(e as Error).message}`);
    }
  };

  if (datasets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        Für diesen Auftrag wurden noch keine Messrohdaten importiert.
      </p>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LineChart className="h-4 w-4" /> Rohdaten &amp; Auswertung
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <Select value={currentId} onValueChange={(v) => { setActiveId(v); setSelection(null); }}>
          <SelectTrigger className="h-8 max-w-2xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {datasets.map((d: any) => (
              <SelectItem key={d.id} value={d.id}>
                {d.order_measurements?.measurement_number ? `${d.order_measurements.measurement_number} · ` : ""}
                {d.source_file_name ?? "Messdatei"}
                {d.instance_label ? ` · ${d.instance_label}` : ""}
                {d.measurement_type ? ` · ${d.measurement_type}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {head && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{head.source_file_name ?? "Messdatei"}</Badge>
            {head.instrument && <span>{head.instrument}</span>}
            <span>{head.point_count} Messpunkte</span>
            <span>{new Date(head.created_at).toLocaleString("de-AT")}</span>
            {head.signal_mapping?.assigned_at && (
              <span>Signalzuordnung: {new Date(head.signal_mapping.assigned_at).toLocaleString("de-AT")}</span>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {(error as Error).message}
          </p>
        )}

        {dataset && dataset.rows.length > 0 && (
          <>
            <CurveViewer
              dataset={dataset}
              defaults={defaults}
              onSelectionChange={setSelection}
              markers={markers}
              chartRef={chartRef}
            />

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={exportRaw}>
                <Download className="h-3.5 w-3.5 mr-1" /> Rohdaten exportieren (CSV)
              </Button>
              <Button type="button" size="sm" variant="outline"
                disabled={evaluations.length === 0} onClick={exportEvaluationsCsv}>
                <Download className="h-3.5 w-3.5 mr-1" /> Auswertung exportieren (CSV)
              </Button>
              <Button type="button" size="sm" variant="outline"
                disabled={evaluations.length === 0} onClick={() => void exportEvaluationsPdf()}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Auswertung inkl. Graph (PDF)
              </Button>
            </div>

            <Tabs defaultValue="points">
              <TabsList>
                <TabsTrigger value="points">Auswertungspunkte</TabsTrigger>
                <TabsTrigger value="range">Bereichsauswertung</TabsTrigger>
              </TabsList>
              <TabsContent value="points" className="pt-3">
                <CurvePointEvaluations
                  datasetId={currentId}
                  dataset={dataset}
                  xKey={selection?.xKey ?? dataset.channels[0]?.key ?? ""}
                  yKeys={selection?.yKeys ?? []}
                  records={evaluations}
                  readOnly={!canEvaluate}
                  onChanged={() => void refetchEvaluations()}
                />
              </TabsContent>
              <TabsContent value="range" className="pt-3">
                {canEvaluate
                  ? <CurveEvaluationPanel dataset={dataset} selection={selection} />
                  : <p className="text-xs text-muted-foreground">Keine Berechtigung zur Auswertung.</p>}
              </TabsContent>
            </Tabs>
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
