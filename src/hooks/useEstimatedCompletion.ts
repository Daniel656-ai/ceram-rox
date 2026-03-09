import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Fetches all open/in-progress measurement orders with their measurements,
 * then calculates an ETA per sample based on:
 *   1. Priority (higher priority = earlier processing)
 *   2. Creation date (FIFO within same priority)
 *   3. Sum of processing durations ahead in queue + own duration
 *
 * Returns a Map<sampleId, Date> with the estimated completion date.
 */

interface OrderWithMeasurements {
  id: string;
  sample_id: string | null;
  priority: string; // order_priority enum
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_orders")
        .select("id, sample_id, priority, created_at, status, order_measurements(id, status, processing_time_hours, planned_hours)")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as OrderWithMeasurements[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const etaMap = useMemo(() => {
    const map = new Map<string, Date>();
    if (!orders.length) return map;

    // Filter orders that have a sample linked
    const sampleOrders = orders
      .filter(o => o.sample_id)
      .map(o => {
        // Sum remaining hours for this order (only open/in_progress measurements)
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
      const workingDays = Math.ceil(cumulativeHours / HOURS_PER_DAY);

      // Calculate ETA by adding working days (skip weekends)
      const eta = new Date(now);
      let daysAdded = 0;
      while (daysAdded < workingDays) {
        eta.setDate(eta.getDate() + 1);
        const day = eta.getDay();
        if (day !== 0 && day !== 6) daysAdded++;
      }

      // If sample already has an ETA, keep the later one (multiple orders)
      const existing = map.get(order.sampleId);
      if (!existing || eta > existing) {
        map.set(order.sampleId, eta);
      }
    }

    return map;
  }, [orders]);

  return etaMap;
}
