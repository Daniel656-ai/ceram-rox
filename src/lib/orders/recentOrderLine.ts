/** Projekt-Text der Auftragsliste im Dashboard: nur wenn ein Projekt vorhanden ist, sonst leer (kein Strich). */
export function recentOrderProject(o: {
  projects?: { project_number?: string | null; project_name?: string | null } | null;
}): string {
  return [o.projects?.project_number, o.projects?.project_name].filter(Boolean).join(" – ");
}

/** Anlagedatum als TT.MM.JJJJ; leer, wenn kein Datum vorhanden ist. */
export function recentOrderDate(o: { created_at?: string | null }): string {
  return o.created_at ? new Date(o.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}
