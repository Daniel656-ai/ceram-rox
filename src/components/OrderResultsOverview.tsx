import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildOrderResultGroups, type RawMeasurementRow } from "@/lib/orderResultsAggregation";

function fmt(n: number | null) {
  if (n === null) return "–";
  return new Intl.NumberFormat("de-AT", { maximumFractionDigits: 4 }).format(n);
}

/**
 * Aggregierte Ergebnisübersicht eines Auftrags über alle zugeordneten Proben.
 * Zeigt ausschließlich offizielle Ergebnisse, gruppiert nach Dienstleistungs-ID.
 */
export default function OrderResultsOverview({ orderId }: { orderId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["order-results-overview", orderId],
    queryFn: () => api.orderSamples.resultsOverview(orderId) as Promise<RawMeasurementRow[]>,
    enabled: !!orderId,
  });

  const groups = buildOrderResultGroups(rows as RawMeasurementRow[]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Ergebnisse werden geladen…</p>;
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Ergebnisse</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Für diesen Auftrag liegen noch keine offiziellen Ergebnisse vor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Card key={g.serviceId}>
          <CardHeader><CardTitle className="text-base">{g.serviceName}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vorgesehene Probe</TableHead>
                  <TableHead>Gemessene Probe</TableHead>
                  {g.columns.map((c) => (
                    <TableHead key={c.key} className="text-right">
                      {c.label}{c.unit ? ` (${c.unit})` : ""}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map((r) => (
                  <TableRow key={r.measurementId}>
                    <TableCell className="font-mono text-xs">
                      {r.originalSampleNumber ?? r.sampleNumber}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs mr-2">{r.sampleNumber}</span>
                      {r.sampleName}
                      {r.isReplacement && (
                        <span className="ml-2 text-xs text-muted-foreground">(Ersatzprobe)</span>
                      )}
                    </TableCell>
                    {g.columns.map((c) => {
                      const cell = r.cells[c.key];
                      return (
                        <TableCell key={c.key} className="text-right tabular-nums">
                          {cell ? (cell.value !== null ? fmt(cell.value) : cell.text || "–") : "offen"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={2}>Mittelwert aller Proben</TableCell>
                  {g.columns.map((c) => {
                    const agg = g.averages[c.key];
                    return (
                      <TableCell key={c.key} className="text-right tabular-nums">
                        {fmt(agg.average)}
                        {agg.count > 0 && agg.count < agg.total && (
                          <div className="text-xs font-normal text-muted-foreground">
                            aus {agg.count} von {agg.total} Proben
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
