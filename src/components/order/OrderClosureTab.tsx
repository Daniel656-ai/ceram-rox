import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import OrderResultsOverview from "@/components/OrderResultsOverview";
import CompletedResultForm from "@/components/CompletedResultForm";
import OrderReportTab from "@/components/OrderReportTab";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

/**
 * Tab „Abschluss“: offizielle Ergebnisse, Ergebnisformulare (Rollenansicht
 * „Ergebnis“ des globalen Formulars) und – sofern verknüpft – der
 * Ergebnisbericht. Für Auftraggeber und Messdienstleister identisch,
 * Unterschiede ergeben sich ausschließlich aus den Berechtigungen.
 */
export default function OrderClosureTab({ order }: { order: any }) {
  const { role } = useAuth();
  const { hasPermission } = usePermissions();
  const canGenerateReport = role === "master" || hasPermission("reports.generate");

  const measurements: any[] = order.order_measurements || [];
  const completed = measurements.filter((m) => m.status === "completed");
  const isClosed = order?.workflow_status === "abgeschlossen" || order?.status === "completed";

  const { data: report } = useQuery({
    queryKey: ["order-report-exists", order.id],
    queryFn: () => api.orderReports.getOrCreateForOrder(order.id),
    enabled: !!order.id,
  });

  const { data: reportVersions = [] } = useQuery({
    queryKey: ["order-report-versions", report?.id],
    queryFn: () => api.orderReports.listVersions(report!.id),
    enabled: !!report?.id,
  });

  const showReport = reportVersions.length > 0 || canGenerateReport;

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Abschlussstatus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            {order.workflow_status && <WorkflowStatusBadge status={order.workflow_status} />}
            <span className="text-muted-foreground">
              {completed.length} von {measurements.length} Aufgaben erledigt
            </span>
          </div>
          {isClosed ? (
            <div className="border rounded-md p-3 bg-green-500/5 border-green-500/40 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <span>
                Auftrag vollständig abgeschlossen und schreibgeschützt. Korrekturen erfolgen über
                einen Korrekturauftrag oder eine Nachmessung.
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Der Auftrag ist noch in Bearbeitung. Einzelne erledigte Dienstleistungen oder
              vorhandene offizielle Ergebnisse bedeuten nicht, dass der gesamte Auftrag
              abgeschlossen ist.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Offizielle Ergebnisse</CardTitle>
          <p className="text-xs text-muted-foreground">
            Es werden ausschließlich Werte angezeigt, die ausdrücklich als offizielles Ergebnis
            freigegeben wurden – inklusive Probenbezug und tatsächlich gemessener Probe.
          </p>
        </CardHeader>
        <CardContent>
          <OrderResultsOverview orderId={order.id} />
        </CardContent>
      </Card>

      {completed.map((m) => (
        <CompletedResultForm
          key={m.id}
          measurementId={m.id}
          serviceId={m.service_id}
          measurementNumber={m.measurement_number}
          serviceName={m.measurement_services?.service_name}
        />
      ))}

      {showReport && <OrderReportTab orderId={order.id} />}
    </div>
  );
}
