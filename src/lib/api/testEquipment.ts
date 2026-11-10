import { dbClient } from "./client";
import { unwrap } from "./_helpers";
import type { EquipmentCheck } from "@/lib/equipment/status";

export interface Equipment {
  id: string;
  name: string;
  description: string | null;
  service_id: string | null;
  responsible_user_id: string | null;
  responsible_name: string | null;
  interval_days: number;
  active: boolean;
  maintenance: boolean;
  manual_lock: boolean;
  history_locked: boolean;
  next_due_date: string | null;
  active_measurement_id: string | null;
  measurement_services: { service_name: string } | null;
}
export type EquipmentInput = Pick<Equipment, "name" | "description" | "service_id" | "responsible_user_id" | "responsible_name" | "interval_days">;
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  return unwrap(dbClient.rpc(name as never, args as never) as unknown as PromiseLike<{ data: T; error: { message: string } | null }>);
}
export const testEquipment = {
  list: () => unwrap(dbClient.from("test_equipment" as never).select("*, measurement_services(service_name)").order("name")) as unknown as Promise<Equipment[]>,
  history: (id: string) => unwrap(dbClient.from("test_equipment_checks" as never).select("*").eq("equipment_id", id).order("performed_at", { ascending: false }).order("version", { ascending: false })) as unknown as Promise<EquipmentCheck[]>,
  save: (id: string | null, input: EquipmentInput) => call<string>("save_test_equipment", { _id: id, _input: input }),
  state: (id: string, action: "deactivate" | "reactivate" | "maintenance" | "release_maintenance" | "lock" | "unlock", reason: string) => call<void>("set_equipment_state", { _equipment_id: id, _action: action, _reason: reason }),
  createCheck: (id: string, assignee: string, dueDate: string | null) => call<string>("create_equipment_check_order", { _equipment_id: id, _assigned_to: assignee, _due_date: dueDate }),
  start: (id: string, expected: string) => call<void>("start_equipment_check", { _equipment_id: id, _expected_measurement_id: expected }),
  record: (id: string, expected: string, status: string, summary: string, notes: string, values: Record<string, unknown>) => call<string>("record_equipment_check", { _equipment_id: id, _status: status, _summary: summary, _notes: notes, _values: values, _expected_measurement_id: expected }),
  correct: (checkId: string, status: string, summary: string, notes: string, reason: string, values: Record<string, unknown>) => call<string>("correct_equipment_check", { _check_id: checkId, _status: status, _summary: summary, _notes: notes, _reason: reason, _values: values }),
  cancel: (id: string, expected: string, reason: string) => call<void>("cancel_equipment_check_order", { _equipment_id: id, _reason: reason, _expected_measurement_id: expected }),
  context: (id: string) => call<{ measurement_id: string; order_number: string; measurement_number: string; assigned_to: string; status: string; values: Record<string, unknown> } | null>("get_equipment_check_context", { _equipment_id: id }),
  saveDraft: (id: string, expected: string, values: Record<string, unknown>) => call<void>("save_equipment_check_draft", { _equipment_id: id, _values: values, _expected_measurement_id: expected }),
  qualifiedUsers: (id: string) => call<{ user_id: string; first_name: string; last_name: string }[]>("equipment_qualified_users", { _equipment_id: id }),
  audit: (id: string) => call<{ id: string; event_type: string; created_at: string; metadata: Record<string, unknown> }[]>("get_equipment_audit", { _equipment_id: id }),
};