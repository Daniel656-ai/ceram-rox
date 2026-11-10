import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MeasurementRow, { type MeasurementRowData } from "@/components/order/MeasurementRow";
import ServiceFormStatusBadge from "@/components/order/ServiceFormStatusBadge";

/**
 * Dynamischer Dienstleistungsbereich der Pilot-Plant-Auftragserstellung:
 * jede Position ein anklickbarer Reiter mit Bearbeitungsstatus. Die
 * Formularinhalte bleiben gemountet (forceMount) – ein Reiterwechsel verliert
 * weder Eingaben noch Berechnungen oder Formularzustände; die Wertehaltung
 * liegt zentral in `measurementFormValues` der Seite.
 */
export default function ServiceTabsCard({
  measurements,
  activeUid,
  onActivate,
  formValues,
  onFormChange,
  onDuplicate,
  onRemove,
  t,
}: {
  measurements: MeasurementRowData[];
  activeUid: string | null;
  onActivate: (uid: string) => void;
  formValues: Record<string, Record<string, any>>;
  onFormChange: (uid: string, key: string, value: any) => void;
  onDuplicate: (uid: string) => void;
  onRemove: (uid: string) => void;
  t: (key: string, opts?: any) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("orders:serviceTabs.title", { defaultValue: "Dienstleistungen" })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {measurements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("orders:serviceTabs.empty", {
              defaultValue: "Wählen Sie links eine Dienstleistung aus – ihr Formular erscheint hier.",
            })}
          </p>
        ) : (
          <Tabs value={activeUid ?? measurements[0].uid} onValueChange={onActivate}>
            <TabsList className="flex-wrap h-auto justify-start">
              {measurements.map((m) => (
                <TabsTrigger key={m.uid} value={m.uid} className="max-w-[220px]">
                  <span className="truncate">{m.service_name}</span>
                  <ServiceFormStatusBadge serviceId={m.service_id} values={formValues[m.uid] || {}} />
                </TabsTrigger>
              ))}
            </TabsList>
            {measurements.map((m, idx) => (
              <TabsContent
                key={m.uid}
                value={m.uid}
                forceMount
                className="data-[state=inactive]:hidden mt-3"
              >
                <MeasurementRow
                  m={m}
                  index={idx}
                  t={t}
                  formValues={formValues[m.uid] || {}}
                  onFormChange={(key, value) => onFormChange(m.uid, key, value)}
                  onDuplicate={() => onDuplicate(m.uid)}
                  onRemove={() => onRemove(m.uid)}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
