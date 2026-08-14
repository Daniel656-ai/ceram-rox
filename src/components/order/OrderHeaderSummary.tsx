import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";

/**
 * Kompakter Auftragskopf – immer sichtbar oberhalb der Tabs.
 * Enthält nur die Orientierungsinformationen, keine Detaildaten der Tabs.
 */
export default function OrderHeaderSummary({
  order,
  creatorName,
}: {
  order: any;
  creatorName?: string;
}) {
  const measurements: any[] = order.order_measurements || [];
  const done = measurements.filter((m) => m.status === "completed").length;
  const progress = measurements.length ? Math.round((done / measurements.length) * 100) : 0;

  const { data: links = [] } = useQuery({
    queryKey: ["order-samples", order.id],
    queryFn: () => api.orderSamples.list(order.id) as Promise<any[]>,
    enabled: !!order.id,
  });

  const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );

  return (
    <Card>
      <CardContent className="pt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Item label="Auftragsnummer">
          <span className="font-mono">
            {order.order_number || order.projects?.project_number || "–"}
          </span>
        </Item>
        <Item label="Bezeichnung">
          {order.projects?.project_name || "–"}
        </Item>
        <Item label="Auftraggeber">{creatorName || "–"}</Item>
        <Item label="Gesamtstatus">
          <div className="flex flex-wrap gap-1">
            <StatusBadge status={order.status} />
            {order.workflow_status && <WorkflowStatusBadge status={order.workflow_status} />}
          </div>
        </Item>
        <Item label="Erstellt am">
          {new Date(order.created_at).toLocaleDateString("de-AT")}
        </Item>
        <Item label="Proben">{links.length}</Item>
        <div className="md:col-span-3 lg:col-span-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Fortschritt der Dienstleistungen</span>
            <span>
              {done} / {measurements.length} erledigt
            </span>
          </div>
          <Progress value={progress} />
        </div>
      </CardContent>
    </Card>
  );
}
