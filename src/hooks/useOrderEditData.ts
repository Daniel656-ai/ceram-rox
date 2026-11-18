import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Daten für den Bearbeiten-Modus: der Auftrag selbst und die Sperr-Angaben aus der Datenbank.
 * Wird absichtlich NICHT im Hintergrund neu geladen: Der Ausgangsstand (und der Zeitstempel für die
 * Prüfung auf zwischenzeitliche Änderungen) muss während der Bearbeitung gleich bleiben.
 */
export function useOrderEditData(orderId: string | undefined) {
  const common = {
    enabled: !!orderId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  } as const;
  const order = useQuery({
    queryKey: ["order-edit", orderId, "order"],
    queryFn: () => api.orders.get(orderId!),
    ...common,
  });
  const facts = useQuery({
    queryKey: ["order-edit", orderId, "facts"],
    queryFn: () => api.orders.editFacts(orderId!),
    ...common,
  });
  return {
    order: (order.data ?? null) as any,
    facts: facts.data ?? null,
    isLoading: order.isLoading || facts.isLoading,
    error: (order.error ?? facts.error) as Error | null,
  };
}
