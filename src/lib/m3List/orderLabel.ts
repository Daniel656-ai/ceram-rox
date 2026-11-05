/**
 * Anzeige der Spalte „Auftrag“ in der m³-Übersicht (nur Darstellung).
 * Soll: erste 9 Zeichen von production_releases.article_number + " " + Projektname.
 * Projektname: zuerst über production_releases.project_id (projects.project_name),
 * sonst der in derselben Freigabe gespeicherte production_releases.project_name.
 * Kein Ersatz durch interne ROX-Auftragsnummer, keine Namensähnlichkeit.
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
  release:
    | { article_number?: string | null; project_id?: string | null; project_name?: string | null }
    | null
    | undefined,
  projectNameById: Map<string, string | null | undefined>
): M3OrderLabel {
  if (!release) return { label: null, complete: false, problem: "Keine Produktionsfreigabe hinterlegt" };
  const an = articlePrefix(release.article_number);
  const linked = release.project_id ? projectNameById.get(release.project_id)?.trim() || null : null;
  const own = release.project_name?.trim() || null;
  const pn = linked ?? own;
  if (!pn) {
    const problem =
      release.project_id && !projectNameById.has(release.project_id)
        ? "Verknüpftes Projekt nicht gefunden"
        : "Projektzuordnung fehlt in der Produktionsfreigabe";
    return { label: an, complete: false, problem };
  }
  if (!an) {
    return { label: pn, complete: false, problem: "Artikelnummer fehlt in der Produktionsfreigabe" };
  }
  return { label: `${an} ${pn}`, complete: true, problem: null };
}

/** Text für Suche und Sortierung – identisch zur sichtbaren Bezeichnung. */
export function m3OrderSortText(l: M3OrderLabel): string {
  return l.label ?? "";
}
