import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/**
 * Direkte, formularunabhängige Abhängigkeiten zwischen Dienstleistungen.
 * Wird eine Dienstleistung gebucht, erzeugt der DB-Trigger automatisch
 * (idempotent) die hinterlegten vorgelagerten Dienstleistungen im Auftrag.
 */
export interface ServiceDependency {
  id: string;
  service_id: string;
  requires_service_id: string;
  order_index: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const TBL = "service_dependencies" as const;

export const serviceDependencies = {
  listForService: (serviceId: string) =>
    unwrap(
      dbClient.from(TBL as any).select("*").eq("service_id", serviceId).order("order_index")
    ) as unknown as Promise<ServiceDependency[]>,

  listAll: () =>
    unwrap(dbClient.from(TBL as any).select("*").order("order_index")) as unknown as Promise<
      ServiceDependency[]
    >,

  /** Ersetzt die Abhängigkeiten einer Dienstleistung vollständig. */
  setForService: async (serviceId: string, requiredServiceIds: string[]) => {
    await run(dbClient.from(TBL as any).delete().eq("service_id", serviceId));
    const ids = requiredServiceIds.filter((id) => id && id !== serviceId);
    if (ids.length === 0) return;
    await run(
      dbClient.from(TBL as any).insert(
        ids.map((requires_service_id, i) => ({
          service_id: serviceId,
          requires_service_id,
          order_index: i,
        })) as any
      )
    );
  },

  /** Alle (auch mehrstufig) automatisch erforderlichen internen Schritte einer Dienstleistung. */
  requiredServices: async (serviceId: string) => {
    const { data, error } = await dbClient.rpc("service_required_services" as any, {
      _service_id: serviceId,
    } as any);
    if (error) throw error;
    return (data ?? []) as Array<{ service_id: string; service_name: string }>;
  },

  /** Fehlende abhängige Aufgaben eines Auftrags nachziehen (idempotent). */
  expandOrder: async (orderId: string) => {
    const { data, error } = await dbClient.rpc("expand_order_workflows" as any, {
      _order_id: orderId,
    } as any);
    if (error) throw error;
    return (data ?? 0) as number;
  },
};
