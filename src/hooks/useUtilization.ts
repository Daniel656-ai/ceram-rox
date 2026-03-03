import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

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
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  // ~5 working days per 7, 8h per day
  const workingDays = Math.floor(days * 5 / 7);
  return Math.max(1, workingDays * 8 - downtimeHours);
}

export function useWorkstationUtilization(period: TimePeriod) {
  return useQuery({
    queryKey: ["workstation-utilization", period],
    queryFn: async () => {
      const { start, end } = getDateRange(period);

      // Get all active workstations
      const { data: workstations, error: wsErr } = await supabase
        .from("workstations")
        .select("id, name")
        .eq("status", "active");
      if (wsErr) throw wsErr;

      // Get all completed measurements in the period with durations
      const { data: measurements, error: mErr } = await supabase
        .from("order_measurements")
        .select("workstation_id, actual_duration_hours, measurement_services(standard_duration_hours)")
        .not("workstation_id", "is", null)
        .gte("updated_at", start.toISOString())
        .lte("updated_at", end.toISOString());
      if (mErr) throw mErr;

      // Get downtimes in the period
      const { data: downtimes, error: dtErr } = await supabase
        .from("workstation_downtimes")
        .select("workstation_id, start_at, end_at")
        .gte("end_at", start.toISOString())
        .lte("start_at", end.toISOString());
      if (dtErr) throw dtErr;

      return (workstations || []).map(ws => {
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
  // This is handled via the existing useUpdateMeasurementStatus or a dedicated mutation
}
