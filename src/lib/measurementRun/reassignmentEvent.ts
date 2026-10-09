/** Event-Typ des bestehenden activity_log-Eintrags aus reassign_measurement. */
export const REASSIGN_EVENT = "measurement_reassigned";

const MODE_LABELS: Record<string, string> = {
  master: "durch Admin",
  project_lead: "durch Projektleitung",
  handover: "Übergabe durch bisherigen Bearbeiter",
};

/** Verlaufstext: bisheriger → neuer Bearbeiter, Art und Grund. */
export function describeReassignment(
  meta: any,
  name: (id?: string | null) => string,
): string {
  const nr0 = meta?.measurement_number ? ` ${meta.measurement_number}` : "";
  const mode0 = MODE_LABELS[meta?.mode] ? ` · ${MODE_LABELS[meta.mode]}` : "";
  const reason0 = meta?.reason ? ` · Grund: „${meta.reason}"` : "";
  if (meta?.action === "unassigned" || (meta && meta.to_user_id == null && meta.from_user_id)) {
    return `Zuweisung entfernt${nr0}: ${name(meta.from_user_id)}${mode0}${reason0}`;
  }
  const from = meta?.from_user_id ? name(meta.from_user_id) : "nicht zugewiesen";
  const to = name(meta?.to_user_id);
  const nr = meta?.measurement_number ? ` ${meta.measurement_number}` : "";
  const mode = MODE_LABELS[meta?.mode] ? ` (${MODE_LABELS[meta.mode]})` : "";
  const reason = meta?.reason ? ` · Grund: „${meta.reason}"` : "";
  return `Zuweisung geändert${nr}: ${from} → ${to}${mode}${reason}`;
}
