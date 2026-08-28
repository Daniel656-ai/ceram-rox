/**
 * Lagerort-Helfer.
 *
 * Fachlich führend ist der Lagerort des einzelnen Gebindes
 * (`raw_material_containers.location_id` / `location_note`).
 * Die Lagerorte eines Rohstoffs werden daraus abgeleitet — der
 * Rohstoff-Stammsatz (`default_location_id`) dient nur als Vorbelegung.
 */

export function formatStorageLocation(loc: any): string {
  if (!loc) return "–";
  const parts = [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
  if (loc.name && parts) return `${loc.name} / ${parts}`;
  if (loc.name) return loc.name;
  return parts || "–";
}

/**
 * Gebinde, die physisch noch vorhanden sind.
 *
 * Fachliche Regel: Relevanz wird über den Status bestimmt, NICHT über
 * die Menge. Ein leeres Gebinde (current_quantity = 0) steht oft noch
 * physisch am Lagerort (Rückgabe, Entsorgung ausstehend, Audit) und
 * bleibt damit für die Lagerortanzeige relevant.
 * Ausgeschlossen sind nur Status, die "physisch nicht mehr vorhanden"
 * bedeuten (container_status: verfuegbar, reserviert, in_verwendung,
 * leer, gesperrt, entsorgt).
 */
const INACTIVE_CONTAINER_STATUSES = new Set(["entsorgt"]);

export function isActiveContainer(c: any): boolean {
  if (!c) return false;
  if (c.status && INACTIVE_CONTAINER_STATUSES.has(c.status)) return false;
  return true;
}

/**
 * Ermittelt die aktuellen Lagerorte eines Rohstoffs aus seinen Gebinden.
 * Reihenfolge stabil, Duplikate entfernt.
 */
export function aggregateContainerLocations(containers: any[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of containers || []) {
    if (!isActiveContainer(c)) continue;
    const base = c.storage_locations ? formatStorageLocation(c.storage_locations) : null;
    const label = base && base !== "–" ? base : c.location_note || null;
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

export function formatLocationList(labels: string[]): string {
  return labels.length ? labels.join(" · ") : "–";
}
