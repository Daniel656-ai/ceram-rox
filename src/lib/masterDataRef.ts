/**
 * ROX – Stammdatenreferenz für globale Variablen (Desktop-/Tauri-Variante)
 * =======================================================================
 *
 * Eine globale Variable (globales Feld) kann als Datenquelle direkt auf einen
 * Stammdatenwert verweisen:
 *
 *   Kategorie (global_lists) -> Eintrag (global_list_items) -> Attribut
 *
 * Die Referenz wird ausschließlich in `metadata.master_data_ref` des bereits
 * bestehenden globalen Feldes abgelegt (kein neues Datenmodell, keine neue
 * Tabelle). Beim Einfügen in ein Formular wird sie in die Feld-Metadaten
 * kopiert und zur Laufzeit gegen den vorhandenen Stammdaten-Katalog aufgelöst.
 *
 * Grundregeln:
 * - Die Referenz hat IMMER Vorrang vor einem Standardwert.
 * - Es gibt KEINEN stillen Fallback: liefert die Referenz keinen Wert, wird
 *   ein klarer Hinweis angezeigt statt eines alten oder erfundenen Wertes.
 */

import type { MasterDataCategory } from "@/lib/api/globalLibrary";

export interface MasterDataRef {
  /** Schlüssel der Stammdaten-Kategorie (global_lists.list_key). */
  list_key: string;
  /** Schlüssel des Eintrags (global_list_items.item_value). */
  item_value: string;
  /** Attributschlüssel des Eintrags; "" = Bezeichnung des Eintrags. */
  attribute_key: string;
  /** Anzeigetext für den Designer (rein informativ). */
  label?: string;
}

export type MasterDataResolution =
  | { status: "ok"; value: unknown; unit: string | null; label: string }
  | { status: "missing"; reason: string };

const METADATA_KEY = "master_data_ref";

/** Liest die Stammdatenreferenz aus den Metadaten eines globalen oder Formularfeldes. */
export function readMasterDataRef(
  metadata: Record<string, unknown> | null | undefined
): MasterDataRef | null {
  const raw = (metadata ?? {})[METADATA_KEY] as Partial<MasterDataRef> | undefined;
  if (!raw || typeof raw !== "object") return null;
  if (!raw.list_key || !raw.item_value) return null;
  return {
    list_key: String(raw.list_key),
    item_value: String(raw.item_value),
    attribute_key: typeof raw.attribute_key === "string" ? raw.attribute_key : "",
    label: typeof raw.label === "string" ? raw.label : undefined,
  };
}

/** Schreibt (oder entfernt) die Referenz in bestehende Metadaten. */
export function writeMasterDataRef(
  metadata: Record<string, unknown> | null | undefined,
  ref: MasterDataRef | null
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  if (ref) next[METADATA_KEY] = ref;
  else delete next[METADATA_KEY];
  return next;
}

/** Token-Schreibweise der Referenz (kompatibel zu {{stammdaten.*}}). */
export function masterDataRefToken(ref: MasterDataRef): string {
  const attr = ref.attribute_key || "bezeichnung";
  return `{{stammdaten.${ref.list_key}.${ref.item_value}.${attr}}}`;
}

/**
 * Löst die Referenz gegen den vorhandenen Stammdaten-Katalog auf.
 * Leere Werte gelten ausdrücklich als "kein Wert vorhanden".
 */
export function resolveMasterDataRef(
  ref: MasterDataRef,
  catalog: MasterDataCategory[]
): MasterDataResolution {
  const cat = catalog.find((c) => c.list.list_key === ref.list_key);
  if (!cat) {
    return { status: "missing", reason: `Stammdaten-Kategorie „${ref.list_key}“ existiert nicht.` };
  }
  const item = cat.items.find((i) => i.item_value === ref.item_value);
  if (!item) {
    return {
      status: "missing",
      reason: `Eintrag „${ref.item_value}“ in „${cat.list.display_name}“ existiert nicht.`,
    };
  }
  if (!ref.attribute_key) {
    return { status: "ok", value: item.label, unit: null, label: `${cat.list.display_name} · ${item.label}` };
  }
  const attr = cat.attributes.find((a) => a.attribute_key === ref.attribute_key);
  if (!attr) {
    return {
      status: "missing",
      reason: `Eigenschaft „${ref.attribute_key}“ ist in „${cat.list.display_name}“ nicht definiert.`,
    };
  }
  const value = (item.metadata ?? {})[attr.attribute_key];
  if (value === null || value === undefined || value === "") {
    return {
      status: "missing",
      reason: `Für „${item.label} · ${attr.display_name}“ ist in den Stammdaten kein Wert hinterlegt.`,
    };
  }
  return {
    status: "ok",
    value,
    unit: attr.unit ?? null,
    label: `${cat.list.display_name} · ${item.label} · ${attr.display_name}`,
  };
}

/** Auswahlmöglichkeiten für den Designer (Kategorie/Eintrag/Attribut). */
export function masterDataRefLabel(ref: MasterDataRef, catalog: MasterDataCategory[]): string {
  const res = resolveMasterDataRef(ref, catalog);
  if (res.status === "ok") return res.label;
  return `${ref.list_key}.${ref.item_value}.${ref.attribute_key || "bezeichnung"}`;
}
