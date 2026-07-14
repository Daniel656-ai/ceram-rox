import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ClipboardList, Lock } from "lucide-react";
import { flattenSharedData } from "@/lib/reportBindings";

/**
 * Laufzettel — chronologische, schreibgeschützte Sicht auf einen Auftrag.
 * Datenquelle: order_instances.shared_data + order_step_runs.
 * Wird komplett aus vorhandenen Daten generiert (kein separater Datentopf).
 */
export function OrderRunSheet({ orderInstanceId }: { orderInstanceId: string }) {
  const { data: instance, isLoading: li } = useQuery({
    queryKey: ["order-instance", orderInstanceId],
    queryFn: () => api.orderInstances.get(orderInstanceId),
    enabled: !!orderInstanceId,
  });
  const { data: runs = [], isLoading: lr } = useQuery({
    queryKey: ["order-step-runs", orderInstanceId],
    queryFn: () => api.orderStepRuns.listForOrder(orderInstanceId),
    enabled: !!orderInstanceId,
  });

  const runsByKey = useMemo(() => {
    const m = new Map<string, (typeof runs)[number]>();
    for (const r of runs) m.set(r.step_key, r);
    return m;
  }, [runs]);

  const rows = useMemo(() => flattenSharedData((instance?.shared_data ?? {}) as any), [instance]);

  if (li || lr) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Laufzettel wird geladen…
        </CardContent>
      </Card>
    );
  }
  if (!instance) return null;

  const locked = !!instance.locked_at;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Laufzettel
            {locked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Gesperrt
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Generiert aus geteilten Auftragsdaten und Prozessschritten. Nur-Lese-Ansicht.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Noch keine Daten erfasst.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schritt</TableHead>
                  <TableHead>Feld</TableHead>
                  <TableHead>Wert</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Abgeschlossen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const run = runsByKey.get(r.stepKey);
                  const stepName = (run?.step_snapshot as any)?.name ?? r.stepKey;
                  return (
                    <TableRow key={`${r.stepKey}-${r.fieldKey}-${i}`}>
                      <TableCell className="font-medium">{stepName}</TableCell>
                      <TableCell className="font-mono text-xs">{r.fieldKey || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {r.value == null || r.value === ""
                          ? "—"
                          : typeof r.value === "object"
                          ? JSON.stringify(r.value)
                          : String(r.value)}
                      </TableCell>
                      <TableCell>
                        {run ? <Badge variant="outline">{run.status}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {run?.completed_at ? new Date(run.completed_at).toLocaleString("de-DE") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prozessprotokoll</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Chronologie aller Prozessschritte.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Keine Schritte vorhanden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Schritt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gestartet</TableHead>
                  <TableHead>Beendet</TableHead>
                  <TableHead>Zeit (Min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.order_index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {(r.step_snapshot as any)?.name ?? r.step_key}
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {r.opened_at ? new Date(r.opened_at).toLocaleString("de-DE") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.completed_at ? new Date(r.completed_at).toLocaleString("de-DE") : "—"}
                    </TableCell>
                    <TableCell>{r.auto_time_minutes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
