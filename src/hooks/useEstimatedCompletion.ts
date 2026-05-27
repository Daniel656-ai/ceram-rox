import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { addWorkingDays } from "@/lib/austrian-holidays";

/**
 * Fetches all open/in-progress measurement orders with their measurements,
 * then calculates an ETA per sample based on:
 *   1. Priority (higher priority = earlier processing)
 *   2. Creation date (FIFO within same priority)
 *   3. Sum of processing durations ahead in queue + own duration
 *
 * Returns a Map<sampleId, Date> with the estimated completion date.
 * Uses Austrian working days (Mon-Fri, excluding public holidays).
 */

interface OrderWithMeasurements {
  id: string;
  sample_id: string | null;
  priority: string;
  created_at: string;
  status: string;
  order_measurements: {
    id: string;
    status: string;
    processing_time_hours: number;
    planned_hours: number | null;
  }[];
}

function priorityToNumber(p: string): number {
  switch (p) {
    case "hoechste": return 2;
    case "wichtig": return 1;
    default: return 0;
  }
}

export function useEstimatedCompletion() {
  const { user } = useAuth();

  const { data: orders = [] } = useQuery({
    queryKey: ["eta-orders"],
    queryFn: async () => (await api.orders.listOpenForETA()) as unknown as OrderWithMeasurements[],
    enabled: !!user,
    staleTime: 30_000,
  });

  const etaMap = useMemo(() => {
    const map = new Map<string, Date>();
    if (!orders.length) return map;

    const sampleOrders = orders
      .filter(o => o.sample_id)
      .map(o => {
        const remainingHours = o.order_measurements
          .filter(m => m.status !== "completed")
          .reduce((sum, m) => sum + (m.planned_hours ?? m.processing_time_hours ?? 0), 0);

        return {
          orderId: o.id,
          sampleId: o.sample_id!,
          priority: priorityToNumber(o.priority),
          createdAt: new Date(o.created_at).getTime(),
          remainingHours,
          status: o.status,
        };
      });

    // Sort: highest priority first, then oldest first (FIFO)
    sampleOrders.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });

    // Assume 8 working hours per day, cumulate processing time
    const HOURS_PER_DAY = 8;
    let cumulativeHours = 0;
    const now = new Date();

    for (const order of sampleOrders) {
      cumulativeHours += order.remainingHours;
      const workingDaysNeeded = Math.ceil(cumulativeHours / HOURS_PER_DAY);

      // Use Austrian working days calculation (skips weekends + holidays)
      const eta = addWorkingDays(now, workingDaysNeeded);

      const existing = map.get(order.sampleId);
      if (!existing || eta > existing) {
        map.set(order.sampleId, eta);
      }
    }

    return map;
  }, [orders]);

  return etaMap;
}
