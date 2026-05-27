import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { countWorkingHours } from "@/lib/austrian-holidays";

export type TimePeriod = "week" | "month" | "quarter" | "year";

function getDateRange(period: TimePeriod, reference = new Date()) {
  switch (period) {
    case "week": return { start: startOfWeek(reference, { weekStartsOn: 1 }), end: endOfWeek(reference, { weekStartsOn: 1 }) };
    case "month": return { start: startOfMonth(reference), end: endOfMonth(reference) };
    case "quarter": return { start: startOfQuarter(reference), end: endOfQuarter(reference) };
    case "year": return { start: startOfYear(reference), end: endOfYear(reference) };
  }
}

function getWorkingHours(start: Date, end: Date, downtimeHours: number): number {
  const totalHours = countWorkingHours(start, end);
  return Math.max(1, totalHours - downtimeHours);
}

export function useWorkstationUtilization(period: TimePeriod) {
  return useQuery({
    queryKey: ["workstation-utilization", period],
    queryFn: async () => {
      const { start, end } = getDateRange(period);
      const [workstations, measurements, downtimes] = await Promise.all([
        api.utilization.activeWorkstations() as Promise<any[]>,
        api.utilization.measurementsInRange(start.toISOString(), end.toISOString()) as Promise<any[]>,
        api.utilization.downtimesInRange(start.toISOString(), end.toISOString()) as Promise<any[]>,
      ]);

      return (workstations || []).map((ws: any) => {
        const wsMeasurements = (measurements || []).filter((m: any) => m.workstation_id === ws.id);
        const totalDurationHours = wsMeasurements.reduce((sum: number, m: any) => {
          const duration = m.actual_duration_hours ?? m.measurement_services?.standard_duration_hours ?? 0;
          return sum + Number(duration);
        }, 0);

        const wsDowntimes = (downtimes || []).filter((d: any) => d.workstation_id === ws.id);
        const downtimeHours = wsDowntimes.reduce((sum: number, d: any) => {
          const dtStart = new Date(Math.max(new Date(d.start_at).getTime(), start.getTime()));
          const dtEnd = new Date(Math.min(new Date(d.end_at).getTime(), end.getTime()));
          return sum + Math.max(0, (dtEnd.getTime() - dtStart.getTime()) / (1000 * 60 * 60));
        }, 0);

        const availableHours = getWorkingHours(start, end, downtimeHours);
        const utilization = Math.min(100, (totalDurationHours / availableHours) * 100);

        return {
          id: ws.id,
          name: ws.name,
          totalDurationHours,
          availableHours,
          downtimeHours,
          utilization: Math.round(utilization * 10) / 10,
          measurementCount: wsMeasurements.length,
        };
      });
    },
  });
}

export function useUpdateMeasurementDuration() {
  // No-op: handled via useUpdateMeasurementStatus
}
