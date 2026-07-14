import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcessRuntimePanel } from "./ProcessRuntimePanel";
import { OrderRunSheet } from "./OrderRunSheet";

/**
 * Phase 6: Zusammenführung von Prozess-Runtime und Laufzettel/Protokoll
 * in einer einzigen Tab-Ansicht. Bindet an `order_instances`.
 */
export function ProcessOrderTabs({
  legacyOrderId,
  orderInstanceId,
}: {
  legacyOrderId: string;
  orderInstanceId?: string;
}) {
  const { data: instance } = useQuery({
    queryKey: ["order-instance", orderInstanceId ?? legacyOrderId],
    queryFn: () =>
      orderInstanceId
        ? api.orderInstances.get(orderInstanceId)
        : api.orderInstances.getByLegacyOrderId(legacyOrderId),
    enabled: !!(orderInstanceId || legacyOrderId),
  });

  const instanceId = instance?.id;

  return (
    <Tabs defaultValue="process" className="w-full">
      <TabsList>
        <TabsTrigger value="process">Prozess</TabsTrigger>
        <TabsTrigger value="runsheet" disabled={!instanceId}>Laufzettel</TabsTrigger>
      </TabsList>
      <TabsContent value="process" className="mt-4">
        <ProcessRuntimePanel legacyOrderId={legacyOrderId} orderInstanceId={orderInstanceId} />
      </TabsContent>
      <TabsContent value="runsheet" className="mt-4">
        {instanceId && <OrderRunSheet orderInstanceId={instanceId} />}
      </TabsContent>
    </Tabs>
  );
}
