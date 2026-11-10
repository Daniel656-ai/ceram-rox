export interface EquipmentCheck {
  id: string;
  corrects_check_id: string | null;
  root_check_id: string | null;
  version: number;
  status: "bestanden" | "nicht_bestanden";
  performed_at: string;
  interval_days: number;
  performed_by: string;
  performed_by_name: string;
  result_summary: string;
  notes: string | null;
  correction_reason: string | null;
  values: Record<string, unknown>;
  created_at: string;
  order_measurement_id: string;
}

export const viennaDay = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
export const warningDays = (interval: number) => Math.min(7, Math.max(1, Math.floor(interval * 0.2)));
export const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export function currentChecks(checks: EquipmentCheck[]) {
  const replaced = new Set(checks.map(c => c.corrects_check_id).filter(Boolean));
  return checks.filter(c => !replaced.has(c.id)).sort((a, b) => b.performed_at.localeCompare(a.performed_at) || (b.root_check_id ?? b.id).localeCompare(a.root_check_id ?? a.id));
}
export function equipmentStatus(equipment: { active: boolean; maintenance: boolean; manual_lock: boolean; next_due_date: string | null; history_locked: boolean; interval_days: number }, today = viennaDay(new Date())) {
  if (!equipment.active) return "inactive";
  if (equipment.maintenance) return "maintenance";
  if (equipment.manual_lock || equipment.history_locked) return "locked";
  if (!equipment.next_due_date) return "pending";
  if (today > equipment.next_due_date) return "red";
  if (today >= addDays(equipment.next_due_date, -warningDays(equipment.interval_days))) return "yellow";
  return "green";
}