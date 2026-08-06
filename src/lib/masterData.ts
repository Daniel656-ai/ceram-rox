/**
 * Stammdaten als zentrale Datenquelle (Single Source of Truth).
 *
 * Jede Stammdaten-Kategorie (früher "Globale Liste") besitzt frei definierbare
 * Attribute. Deren Werte stehen systemweit als Tokens zur Verfügung:
 *
 *   {{stammdaten.mundstuecke.m1.schlitzbreite}}   – konkreter Eintrag
 *   {{mundstueck.schlitzbreite}}                  – aktuell ausgewählter Eintrag
 *
 * Die Werte werden nirgends dupliziert – Formulare, Berichte, Workflows,
 * Bedingungen, Berechnungen und Skripte lesen ausschließlich hier.
 */

import type { MasterDataCategory } from "@/lib/api/globalLibrary";

export const MASTER_DATA_NAMESPACE = "stammdaten";

/** `stammdaten.<kategorie>.<eintrag>.<attribut>` -> Wert */
export function flattenMasterDataCatalog(
  catalog: MasterDataCategory[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const cat of catalog) {
    const listKey = cat.list.list_key;
    for (const item of cat.items) {
      const base = `${MASTER_DATA_NAMESPACE}.${listKey}.${item.item_value}`;
      out[`${base}.bezeichnung`] = item.label;
      out[`${base}.wert`] = item.item_value;
      out[`${base}.aktiv`] = item.is_active !== false;
      if (item.description) out[`${base}.beschreibung`] = item.description;
      for (const attr of cat.attributes) {
        out[`${base}.${attr.attribute_key}`] = (item.metadata ?? {})[attr.attribute_key] ?? null;
      }
    }
  }
  return out;
}

/**
 * Variablen für aktuell ausgewählte Einträge:
 * `selection = { mundstuecke: "m1" }` -> `mundstuecke.schlitzbreite`.
 */
export function masterDataSelectionVariables(
  catalog: MasterDataCategory[],
  selection: Record<string, string | null | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [listKey, value] of Object.entries(selection)) {
    if (!value) continue;
    const cat = catalog.find((c) => c.list.list_key === listKey);
    if (!cat) continue;
    const item = cat.items.find((i) => i.item_value === value || i.label === value);
    if (!item) continue;
    out[`${listKey}.bezeichnung`] = item.label;
    out[`${listKey}.wert`] = item.item_value;
    for (const attr of cat.attributes) {
      out[`${listKey}.${attr.attribute_key}`] = (item.metadata ?? {})[attr.attribute_key] ?? null;
    }
  }
  return out;
}

/** Alle verfügbaren Stammdaten-Tokens (für Designer / Auswahllisten). */
export function listMasterDataTokens(catalog: MasterDataCategory[]) {
  const tokens: { path: string; token: string; group: string; label: string }[] = [];
  for (const cat of catalog) {
    const listKey = cat.list.list_key;
    const attrs = [
      { key: "bezeichnung", label: "Bezeichnung" },
      ...cat.attributes.map((a) => ({
        key: a.attribute_key,
        label: a.unit ? `${a.display_name} (${a.unit})` : a.display_name,
      })),
    ];
    for (const a of attrs) {
      const path = `${listKey}.${a.key}`;
      tokens.push({
        path,
        token: `{{${path}}}`,
        group: cat.list.display_name,
        label: a.label,
      });
    }
  }
  return tokens;
}
