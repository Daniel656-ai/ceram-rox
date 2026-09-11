/**
 * Fachliche Zuordnung: welche Dienstleistung benötigt welche Geometrieart?
 *
 * Zentrale Stelle – bewusst KEINE zweite Logik in Komponenten und keine
 * Datenbankänderung an den bestehenden Dienstleistungsdefinitionen.
 *
 * Regel (verbindlich):
 *   gleiche Probe + gleiche Geometrieart      → gemeinsamer Geometriedatensatz
 *   gleiche Probe + andere Geometrieart       → getrennter Geometriedatensatz
 *   andere Probe                              → jeweils eigener Datensatz
 */

import { HONEYCOMB_GEOMETRY_KIND, PLATE_GEOMETRY_KIND } from "./plate";

export type GeometryKind = typeof HONEYCOMB_GEOMETRY_KIND | typeof PLATE_GEOMETRY_KIND;

export const GEOMETRY_KIND_LABELS: Record<GeometryKind, string> = {
  [HONEYCOMB_GEOMETRY_KIND]: "Geometrievermessung – Wabenkörper",
  [PLATE_GEOMETRY_KIND]: "Geometrievermessung – Platte",
};

/** Feste Anzeigereihenfolge der Geometrieabschnitte. */
export const GEOMETRY_KIND_ORDER: GeometryKind[] = [HONEYCOMB_GEOMETRY_KIND, PLATE_GEOMETRY_KIND];

/**
 * Dienstleistungen mit Plattengeometrie. Erkennung über den Dienstleistungs-
 * namen (BENCH NOx / BENCH SOx); weitere BENCH-Varianten werden automatisch
 * mit erfasst.
 */
const PLATE_SERVICE_PATTERN = /^\s*bench\b/i;

/** Geometrieart einer Dienstleistung – `null`, wenn keine Geometrie benötigt wird. */
export function geometryKindForService(serviceName: string | null | undefined): GeometryKind | null {
  const name = (serviceName ?? "").trim();
  if (!name) return null;
  if (PLATE_SERVICE_PATTERN.test(name)) return PLATE_GEOMETRY_KIND;
  return null;
}

/**
 * Geometriearten, die für die beauftragten Dienstleistungen einer Probe zu
 * erfassen sind. Ohne Platten-Dienstleistung bleibt es bei der bestehenden
 * Wabenkörper-Geometrie.
 */
export function geometryKindsForServices(serviceNames: Array<string | null | undefined>): GeometryKind[] {
  const kinds = new Set<GeometryKind>();
  for (const name of serviceNames) {
    const kind = geometryKindForService(name);
    if (kind) kinds.add(kind);
  }
  // Wabenkörper bleibt der Standard, sofern keine reine Platten-Beauftragung vorliegt.
  const onlyPlate = kinds.has(PLATE_GEOMETRY_KIND) && kinds.size === 1;
  const hasNonPlate = serviceNames.some(
    (n) => (n ?? "").trim() && !geometryKindForService(n) && !/geometrievermessung/i.test(n ?? ""),
  );
  if (!onlyPlate || hasNonPlate) kinds.add(HONEYCOMB_GEOMETRY_KIND);
  return GEOMETRY_KIND_ORDER.filter((k) => kinds.has(k));
}

export { HONEYCOMB_GEOMETRY_KIND, PLATE_GEOMETRY_KIND };
