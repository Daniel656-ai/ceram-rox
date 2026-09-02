/**
 * Stammdatenanbindung der Geometrie-/Auslegungsberechnung.
 *
 * Es wird bewusst KEINE eigene Tabelle angelegt: Zelligkeiten und
 * Reaktorgeometrien sind normale Stammdaten-Kategorien (`global_lists` mit
 * frei definierbaren Attributen) – analog zu den Mundstücken. Die konkreten
 * Werte pflegt der Benutzer, sie stehen nicht im Code.
 */

import type { MasterDataCategory } from "@/lib/api/globalLibrary";
import {
  DEFAULT_REACTOR_GEOMETRY,
  type CellDensityOption,
  type ReactorGeometry,
} from "./calculations";

export const CELL_DENSITY_LIST_KEY = "zelligkeiten";
export const CELL_DENSITY_ATTRIBUTE = "zellenzahl";

export const REACTOR_LIST_KEY = "reaktorgeometrien";
export const REACTOR_WIDTH_ATTRIBUTE = "breite_mm";
export const REACTOR_HEIGHT_ATTRIBUTE = "hoehe_mm";

const toNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const category = (catalog: MasterDataCategory[], key: string) =>
  catalog.find((c) => c.list.list_key === key) ?? null;

/** Aktive, gepflegte Zelligkeiten – ausschließlich diese dürfen vorgeschlagen werden. */
export function activeCellDensities(catalog: MasterDataCategory[]): CellDensityOption[] {
  const cat = category(catalog, CELL_DENSITY_LIST_KEY);
  if (!cat) return [];
  return cat.items
    .filter((i) => i.is_active !== false && !i.archived_at)
    .map((i) => ({
      key: i.item_value,
      label: i.label || i.item_value,
      zellenzahl: toNumber((i.metadata ?? {})[CELL_DENSITY_ATTRIBUTE]) ?? toNumber(i.item_value) ?? NaN,
    }))
    .filter((o) => Number.isFinite(o.zellenzahl))
    .sort((a, b) => a.zellenzahl - b.zellenzahl);
}

/**
 * Verfügbare Reaktorgeometrien (Messkonfigurationen). Die Standardkonfiguration
 * ist 3 × 3 cm; weitere (z. B. SOx mit 3,5 × 3,5 cm) werden allein über die
 * Stammdaten ergänzt – keine feste Zahl in Formeln.
 */
export function reactorGeometries(catalog: MasterDataCategory[]): ReactorGeometry[] {
  const cat = category(catalog, REACTOR_LIST_KEY);
  if (!cat) return [DEFAULT_REACTOR_GEOMETRY];
  const list = cat.items
    .filter((i) => i.is_active !== false && !i.archived_at)
    .map((i) => ({
      key: i.item_value,
      label: i.label || i.item_value,
      widthMm: toNumber((i.metadata ?? {})[REACTOR_WIDTH_ATTRIBUTE]) ?? NaN,
      heightMm: toNumber((i.metadata ?? {})[REACTOR_HEIGHT_ATTRIBUTE]) ?? NaN,
    }))
    .filter((g) => Number.isFinite(g.widthMm) && Number.isFinite(g.heightMm));
  return list.length ? list : [DEFAULT_REACTOR_GEOMETRY];
}

/** Konfiguration einer Messart (Standard = Aktivität). */
export function reactorGeometryFor(
  catalog: MasterDataCategory[],
  key: string = DEFAULT_REACTOR_GEOMETRY.key,
): ReactorGeometry {
  const all = reactorGeometries(catalog);
  return all.find((g) => g.key === key) ?? all[0] ?? DEFAULT_REACTOR_GEOMETRY;
}
