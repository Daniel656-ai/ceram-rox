import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface WorkstationDowntime {
  id: string;
  workstation_id: string;
  downtime_type: "wartung" | "reparatur" | "sonstiges";
  status: "geplant" | "aktiv" | "abgeschlossen";
  start_at: string;
  end_at: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const downtimes = {
  list(workstationId?: string): Promise<WorkstationDowntime[]> {
    let q = dbClient.from("workstation_downtimes").select("*").order("start_at");
    if (workstationId) q = q.eq("workstation_id", workstationId);
    return unwrap(q) as Promise<WorkstationDowntime[]>;
  },
  create: (d: Partial<WorkstationDowntime> & { workstation_id: string; downtime_type: string; start_at: string; end_at: string; created_by: string }) =>
    unwrap(dbClient.from("workstation_downtimes").insert(d as any).select().single()),
  update: ({ id, ...updates }: Partial<WorkstationDowntime> & { id: string }) =>
    unwrap(dbClient.from("workstation_downtimes").update(updates as any).eq("id", id).select().single()),
  delete: (id: string) => run(dbClient.from("workstation_downtimes").delete().eq("id", id)),
  checkConflict: (workstationId: string, start: string, end: string) =>
    unwrap(dbClient.rpc("check_workstation_downtime_conflict", { _workstation_id: workstationId, _start: start, _end: end })),
};
