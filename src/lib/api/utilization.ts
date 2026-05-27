import { dbClient } from "./client";
import { unwrap } from "./_helpers";

export const utilization = {
  activeWorkstations: () =>
    unwrap(dbClient.from("workstations").select("id, name").eq("status", "active")),

  measurementsInRange: (startIso: string, endIso: string) =>
    unwrap(
      dbClient
        .from("order_measurements")
        .select("workstation_id, actual_duration_hours, measurement_services(standard_duration_hours)")
        .not("workstation_id", "is", null)
        .gte("updated_at", startIso)
        .lte("updated_at", endIso)
    ),

  downtimesInRange: (startIso: string, endIso: string) =>
    unwrap(
      dbClient
        .from("workstation_downtimes")
        .select("workstation_id, start_at, end_at")
        .gte("end_at", startIso)
        .lte("start_at", endIso)
    ),
};
