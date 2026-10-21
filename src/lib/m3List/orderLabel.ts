/**
 * Anzeige der Spalte „Auftrag“ in der m³-Übersicht (nur Darstellung).
 * Soll: erste 9 Zeichen von production_releases.article_number + " " + projects.project_name,
 * Projekt ausschließlich über production_releases.project_id.
 * Kein Ersatz durch interne ROX-Auftragsnummer oder Freitext.
 */
export interface M3OrderLabel {
  label: string | null;
  complete: boolean;
  problem: string | null;
}

/** Erste 9 Zeichen der Artikelnummer, exakt übernommen (z. B. "0040-6129-125-0998" → "0040-6129"). */
export function articlePrefix(articleNumber: string | null | undefined): string | null {
  const a = articleNumber?.trim();
  return a ? a.slice(0, 9) : null;
}

export function m3OrderLabel(
  release: { article_number?: string | null; project_id?: string | null } | null | undefined,
  projectNameById: Map<string, string | null | undefined>
): M3OrderLabel {
  if (!release) return { label: null, complete: false, problem: "Keine Produktionsfreigabe hinterlegt" };
  const an = articlePrefix(release.article_number);
  if (!release.project_id) {
    return { label: an, complete: false, problem: "Projektzuordnung fehlt in der Produktionsfreigabe" };
  }
  if (!projectNameById.has(release.project_id)) {
    return { label: an, complete: false, problem: "Verknüpftes Projekt nicht gefunden" };
  }
  const pn = projectNameById.get(release.project_id)?.trim() || null;
  if (!an || !pn) {
    return {
      label: [an, pn].filter(Boolean).join(" ") || null,
      complete: false,
      problem: !an ? "Artikelnummer fehlt in der Produktionsfreigabe" : "Projektname fehlt",
    };
  }
  return { label: `${an} ${pn}`, complete: true, problem: null };
}

/** Text für Suche und Sortierung – identisch zur sichtbaren Bezeichnung. */
export function m3OrderSortText(l: M3OrderLabel): string {
  return l.label ?? "";
}
