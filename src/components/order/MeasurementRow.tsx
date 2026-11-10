import { useQuery } from "@tanstack/react-query";
import { Copy, Layers, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ServiceBookingForm, { useServiceHasFormLayout } from "@/components/ServiceBookingForm";
import ServiceLinkedForms from "@/components/ServiceLinkedForms";

/** Position einer Auftragserstellung (Spiegel des Typs in CreateOrderPage). */
export interface MeasurementRowData {
  uid: string;
  service_id: string;
  service_name: string;
  origin?: "template" | "manual" | "rule";
  rule_source_uid?: string | null;
  rule_id?: string | null;
  selection_token?: string | null;
  source_package_id?: string | null;
  source_package_name?: string | null;
}

/**
 * Zeigt bei der Aufgabenerstellung ausschließlich das Auftraggeberformular
 * ("customer") der Dienstleistung. Existiert dafür keine Konfiguration, wird
 * KEIN Formularbereich gerendert – kein Fallback auf Messdienstleister-
 * formulare oder das alte Parametersystem.
 */
function ServiceCustomerForm({
  serviceId, formValues, onFormChange,
}: {
  serviceId: string;
  formValues: Record<string, any>;
  onFormChange: (key: string, value: any) => void;
}) {
  const { data: hasCustomer, isLoading } = useServiceHasFormLayout(serviceId, "customer");
  if (isLoading || !hasCustomer) return null;

  return (
    <div className="mt-2 pl-2 border-l-2 border-primary/30">
      <ServiceBookingForm
        serviceId={serviceId}
        roleView="customer"
        values={formValues}
        onChange={onFormChange}
        compact
      />
    </div>
  );
}

/**
 * Hinweis auf interne Arbeitsschritte, die beim Buchen dieser Dienstleistung
 * automatisch mit erzeugt werden. Der Auftraggeber muss sie nicht auswählen.
 */
function RequiredStepsHint({ serviceId }: { serviceId: string }) {
  const { data: required = [] } = useQuery({
    queryKey: ["service-required-services", serviceId],
    queryFn: () => api.serviceDependencies.requiredServices(serviceId),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  });
  if (required.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground mt-1">
      Automatisch enthaltene Arbeitsschritte:{" "}
      {required.map((r) => r.service_name).join(", ")}
    </p>
  );
}

/**
 * Eine gebuchte Dienstleistung des Auftrags samt ihrem Auftraggeberformular.
 * Identische Darstellung für Positionen aus der Auswahl und für zusätzlich
 * gebuchte Dienstleistungen – es gibt nur eine Datenhaltung.
 */
export default function MeasurementRow({
  m, index, t, formValues, onFormChange, onDuplicate, onRemove,
}: {
  m: MeasurementRowData;
  index: number;
  t: (key: string, opts?: any) => string;
  formValues: Record<string, any>;
  onFormChange: (key: string, value: any) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-3 border rounded-md space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">#{index + 1}</span>
            <span>{m.service_name}</span>
            {m.source_package_name ? (
              <Badge variant="secondary" className="font-normal">
                <Layers className="h-3 w-3 mr-1" /> {m.source_package_name}
              </Badge>
            ) : m.origin === "rule" ? (
              <Badge variant="secondary" className="font-normal">durch Regel ausgelöst</Badge>
            ) : m.origin === "template" ? (
              <Badge variant="secondary" className="font-normal">aus Auswahl</Badge>
            ) : (
              <Badge variant="outline" className="font-normal">manuell</Badge>
            )}
          </p>
          <RequiredStepsHint serviceId={m.service_id} />
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} title={t("orders:duplicate", { defaultValue: "Duplizieren" })}><Copy className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <ServiceCustomerForm serviceId={m.service_id} formValues={formValues} onFormChange={onFormChange} />
      <ServiceLinkedForms
        serviceId={m.service_id}
        context="customer"
        values={formValues}
        onChange={onFormChange}
      />
    </div>
  );
}
