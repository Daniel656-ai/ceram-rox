/**
 * Anzeige der Spalte „Auftrag“ in der m³-Übersicht (nur Darstellung).
 * Soll: production_releases.release_number + " " + projects.project_name,
 * Projekt ausschließlich über production_releases.project_id.
 * Kein Ersatz durch interne ROX-Auftragsnummer oder Freitext.
 */
export interface M3OrderLabel {
  label: string | null;
  complete: boolean;
  problem: string | null;
}

export function m3OrderLabel(
  release: { release_number?: string | null; project_id?: string | null } | null | undefined,
  projectNameById: Map<string, string | null | undefined>
): M3OrderLabel {
  if (!release) return { label: null, complete: false, problem: "Keine Fertigungsfreigabe hinterlegt" };
  const rn = release.release_number?.trim() || null;
  if (!release.project_id) {
    return { label: rn, complete: false, problem: "Projektzuordnung fehlt in der Fertigungsfreigabe" };
  }
  if (!projectNameById.has(release.project_id)) {
    return { label: rn, complete: false, problem: "Verknüpftes Projekt nicht gefunden" };
  }
  const pn = projectNameById.get(release.project_id)?.trim() || null;
  if (!rn || !pn) {
    return {
      label: [rn, pn].filter(Boolean).join(" ") || null,
      complete: false,
      problem: !rn ? "Freigabenummer fehlt" : "Projektname fehlt",
    };
  }
  return { label: `${rn} ${pn}`, complete: true, problem: null };
}

/** Text für Suche und Sortierung – identisch zur sichtbaren Bezeichnung. */
export function m3OrderSortText(l: M3OrderLabel): string {
  return l.label ?? "";
}
