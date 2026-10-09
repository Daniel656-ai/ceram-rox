/** Event-Typ des bestehenden activity_log-Eintrags aus reassign_measurement. */
export const REASSIGN_EVENT = "measurement_reassigned";

const MODE_LABELS: Record<string, string> = {
  master: "durch Master",
  project_lead: "durch Projektleitung",
  handover: "Übergabe durch bisherigen Bearbeiter",
};

/** Verlaufstext: bisheriger → neuer Bearbeiter, Art und Grund. */
export function describeReassignment(
  meta: any,
  name: (id?: string | null) => string,
): string {
  const from = meta?.from_user_id ? name(meta.from_user_id) : "nicht zugewiesen";
  const to = name(meta?.to_user_id);
  const nr = meta?.measurement_number ? ` ${meta.measurement_number}` : "";
  const mode = MODE_LABELS[meta?.mode] ? ` (${MODE_LABELS[meta.mode]})` : "";
  const reason = meta?.reason ? ` · Grund: „${meta.reason}"` : "";
  return `Zuweisung geändert${nr}: ${from} → ${to}${mode}${reason}`;
}
