import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ServiceBookingForm from "@/components/ServiceBookingForm";
import OrderUploadedFiles from "@/components/OrderUploadedFiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock } from "lucide-react";
import type { FormRoleView } from "@/lib/api/serviceFormLayouts";

interface Props {
  measurementId: string;
  serviceId?: string | null;
  measurementNumber?: string | null;
  serviceName?: string | null;
}

/**
 * Read-only view of the "Ergebnisformular" a technician filled in for a
 * completed measurement. Uses the exact same rendering engine as the
 * technician view (ServiceBookingForm), just strictly non-editable.
 */
export default function CompletedResultForm({
  measurementId,
  serviceId,
  measurementNumber,
  serviceName,
}: Props) {
  const { data: results = [] } = useQuery({
    queryKey: ["measurement-results", measurementId],
    queryFn: () => api.measurementResults.list(measurementId),
    enabled: !!measurementId,
  });

  const [roleView, setRoleView] = useState<FormRoleView>("employee");

  const { data: employeeLayout } = useQuery({
    queryKey: ["service-form-layout", serviceId, "employee"],
    queryFn: () => api.serviceFormLayouts.get(serviceId!, "employee"),
    enabled: !!serviceId,
  });
  const { data: customerLayout } = useQuery({
    queryKey: ["service-form-layout", serviceId, "customer"],
    queryFn: () => api.serviceFormLayouts.get(serviceId!, "customer"),
    enabled: !!serviceId,
  });

  useEffect(() => {
    const employeeHas = !!employeeLayout?.layout?.sections?.length;
    const customerHas = !!customerLayout?.layout?.sections?.length;
    setRoleView(!employeeHas && customerHas ? "customer" : "employee");
  }, [employeeLayout, customerLayout]);

  const activeLayout = roleView === "employee" ? employeeLayout : customerLayout;
  const hasForm = !!activeLayout?.layout?.sections?.length;

  // Same de-serialisation as the technician view uses when resuming a draft.
  const values = useMemo(() => {
    const out: Record<string, any> = {};
    for (const r of results as any[]) {
      const key = r.result_name;
      if (!key) continue;
      if (r.value != null) out[key] = String(r.value);
      else if (r.remarks != null) {
        try {
          out[key] = JSON.parse(r.remarks);
        } catch {
          out[key] = r.remarks;
        }
      }
    }
    return out;
  }, [results]);

  if (!serviceId || !hasForm) return null;

  return (
    <Card className="border-green-600/30">
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Ergebnisformular
          {serviceName && <span className="font-normal text-muted-foreground">– {serviceName}</span>}
          {measurementNumber && (
            <Badge variant="outline" className="font-mono text-[10px]">{measurementNumber}</Badge>
          )}
          <Badge variant="secondary" className="text-[10px] gap-1 ml-auto">
            <Lock className="h-3 w-3" /> schreibgeschützt
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ServiceBookingForm
          serviceId={serviceId}
          roleView={roleView}
          values={values}
          onChange={() => {}}
          readOnly
        />
        <OrderUploadedFiles measurementId={measurementId} canDelete={false} />
      </CardContent>
    </Card>
  );
}
