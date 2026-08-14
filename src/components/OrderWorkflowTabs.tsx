import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PilotPlantProcessPanel } from "@/components/pilotplant/PilotPlantProcessPanel";
import OrderSamplesTab from "@/components/order/OrderSamplesTab";
import OrderWorkflowTab from "@/components/order/OrderWorkflowTab";
import OrderClosureTab from "@/components/order/OrderClosureTab";

/**
 * Einheitliche Auftragsansicht für Auftraggeber und Messdienstleister.
 *
 * - Proben   → physische Proben, Status, Lagerort, Ersatzproben, Historie
 * - Workflow → Dienstleistungen, Aufgaben, Fortschritt, Änderungsverlauf
 * - Abschluss→ offizielle Ergebnisse, Ergebnisformulare, Ergebnisbericht
 *
 * Unterschiede zwischen den Rollen entstehen ausschließlich über Berechtigungen.
 */
export function OrderWorkflowTabs({
  order,
  isRequesterView = false,
  canEditSamples = false,
  canBookReplacement = false,
  processSlot,
}: {
  order: any;
  isRequesterView?: boolean;
  canEditSamples?: boolean;
  canBookReplacement?: boolean;
  processSlot?: ReactNode;
}) {
  const { t } = useTranslation(["orders", "common"]);
  const kind: string = order?.order_kind || "labor";
  const showPP = kind === "pilot_plant";

  return (
    <Card>
      <CardContent className="pt-4">
        <Tabs defaultValue="samples" className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="samples">{t("orders:tabs.samples")}</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="closure">{t("orders:tabs.closure")}</TabsTrigger>
            {showPP && <TabsTrigger value="pilot_plant">{t("orders:tabs.pilot_plant")}</TabsTrigger>}
          </TabsList>

          <TabsContent value="samples">
            <OrderSamplesTab
              orderId={order.id}
              projectId={order.project_id}
              canEdit={canEditSamples}
              canBookReplacement={canBookReplacement}
            />
          </TabsContent>

          <TabsContent value="workflow">
            <OrderWorkflowTab
              order={order}
              isRequesterView={isRequesterView}
              processSlot={processSlot}
            />
          </TabsContent>

          <TabsContent value="closure">
            <OrderClosureTab order={order} />
          </TabsContent>

          {showPP && (
            <TabsContent value="pilot_plant">
              <PilotPlantProcessPanel order={order} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
