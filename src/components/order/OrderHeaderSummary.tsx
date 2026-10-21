import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";
import { orderIdentity } from "@/lib/orders/orderIdentity";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("orders");
  const identity = orderIdentity(order);
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
        <Item label={identity.hasExperimentNumber ? t("pp.experiment_number") : t("order_number")}>
          <span className="font-mono break-words">
            {identity.number || order.projects?.project_number || "–"}
          </span>
          {identity.hasExperimentNumber && <div className="text-xs text-muted-foreground break-words">{t("technical_number", { number: identity.technicalNumber })}</div>}
          {identity.missingExperimentNumber && <div className="text-xs text-muted-foreground">{t("without_experiment_number")}</div>}
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
