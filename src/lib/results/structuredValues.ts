import { elementKey, elementLibrary, formatElementLabel } from "@/lib/elementKeys";
import { parseImportProtocol, type ImportProtocol } from "@/lib/results/importProtocol";

/**
 * Allgemeine, rein anzeigende Aufbereitung strukturierter Ergebniswerte
 * (Messdatenblöcke, Wiederholungs-Tabellen, Einstellungs-Objekte, JSON-Texte).
 *
 * Grundsatz: Ein roher „schlüssel: wert, …“-Text bzw. JSON erscheint nie in einer
 * Wertetabelle. Stattdessen:
 *  - echte Werte  -> einzelne Zeilen mit lesbarer Bezeichnung (und Einheit, falls bekannt)
 *  - leere Werte (null/leer) -> nicht anzeigen
 *  - Einstellungen/Schalter (Konfiguration) -> nur unter „Details“
 *  - Importprotokolle -> kurze Importinfo
 * An den gespeicherten Daten ändert sich nichts.
 */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Schlüsselwörter, die auf Einstellungen/Konfiguration statt Messwerte hindeuten. */
const CONFIG_KEY_RE = /(einstellung|settings?|config|konfig|umrechnung|schalter|toggle|optionen?)/i;

export interface StructuredLeaf {
  /** Pfad der Schlüssel, z. B. ["gas_einstellungen", "k_wert"]. */
  path: string[];
  value: string | number | boolean;
  /** Durchlauf-Kennung/-Name bei Listen mit mehreren Einträgen, sonst null. */
  entryId: string | null;
  entryLabel: string | null;
}

export interface StructuredAnalysis {
  /** Echte Werte (Messwerte, Texte). */
  values: StructuredLeaf[];
  /** Einstellungen/Schalter – nur für „Details“. */
  config: StructuredLeaf[];
  protocols: ImportProtocol[];
  /** Einheiten je Feldschlüssel aus Importprotokollen. */
  units: Record<string, string | null>;
}

/** JSON-Text (Objekt/Liste) parsen; alles andere = undefined. */
export function parseStructuredText(text: string | null | undefined): unknown {
  if (typeof text !== "string") return undefined;
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

/** Lesbarer Name zu einem technischen Schlüssel („al_2_o_3“ -> Al₂O₃, „fr_trocken“ -> Fr trocken). */
export function humanizeKey(key: string): string {
  const tokens = String(key).split("_").filter(Boolean);
  // Chemische Formel nur bei „Buchstaben-Ziffern-Token“ (z. B. sio_2, al_2_o_3, fe_2_o_3).
  if (tokens.length > 1 && tokens.some((t) => /^\d+$/.test(t)) && tokens.every((t) => /^\d+$/.test(t) || /^[a-z]{1,3}$/i.test(t))) {
    const compact = tokens.join("");
    const f = formatElementLabel(compact);
    // Nur bekannte Verbindungen aus der Elementbibliothek (SiO2, Al2O3 …), nie geratene Formeln.
    const ek = elementKey(compact);
    if (f && f !== compact && ek && elementLibrary.some((e) => e.key === ek)) return f;
  }
  const words = String(key).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : String(key);
}

/** Bezeichnung einer Zeile aus dem Pfad (letzter Schlüssel; Listenindex wird angehängt). */
export function labelFromPath(path: string[]): string {
  const last = path[path.length - 1] ?? "";
  if (/^\d+$/.test(last) && path.length > 1) return `${humanizeKey(path[path.length - 2])} ${last}`;
  return humanizeKey(last);
}

/** Letzter fachlicher Schlüssel (für Einheitenzuordnung und Dublettenprüfung). */
export function leafKey(path: string[]): string {
  for (let i = path.length - 1; i >= 0; i -= 1) if (!/^\d+$/.test(path[i])) return path[i];
  return path[path.length - 1] ?? "";
}

const isConfigPath = (path: string[]) => path.some((p) => CONFIG_KEY_RE.test(p));

function isEmptyLeaf(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** Zerlegt einen beliebigen JSON-Wert in Messwerte, Einstellungen und Importprotokolle. */
export function analyzeStructured(parsed: unknown): StructuredAnalysis {
  const out: StructuredAnalysis = { values: [], config: [], protocols: [], units: {} };

  const addProtocol = (obj: Record<string, unknown>) => {
    const p = parseImportProtocol(JSON.stringify(obj));
    if (!p) return false;
    out.protocols.push(p);
    for (const [k, u] of Object.entries(p.units)) if (!(k in out.units)) out.units[k] = u;
    return true;
  };

  const walk = (node: unknown, path: string[], entryId: string | null, entryLabel: string | null): void => {
    if (isEmptyLeaf(node)) return;
    if (typeof node === "string") {
      const nested = parseStructuredText(node);
      if (nested !== undefined) return walk(nested, path, entryId, entryLabel);
      return push(node, path, entryId, entryLabel);
    }
    if (typeof node === "number" || typeof node === "boolean") return push(node, path, entryId, entryLabel);
    if (Array.isArray(node)) {
      const items = node.filter((x) => !isEmptyLeaf(x));
      if (items.length === 0) return;
      if (items.every((x) => typeof x !== "object")) {
        return push(items.map(String).join(", "), path, entryId, entryLabel);
      }
      items.forEach((item, i) => walk(item, items.length > 1 ? [...path, String(i + 1)] : path, entryId, entryLabel));
      return;
    }
    if (isPlainObject(node)) {
      if (typeof node.imported_at === "string" && addProtocol(node)) return;
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith("__")) continue;
        walk(v, [...path, k], entryId, entryLabel);
      }
    }
  };

  const push = (value: string | number | boolean, path: string[], entryId: string | null, entryLabel: string | null) => {
    const leaf: StructuredLeaf = { path, value, entryId, entryLabel };
    // Schalter (true/false) und Einstellungs-Pfade sind keine Messwerte.
    if (typeof value === "boolean" || isConfigPath(path)) out.config.push(leaf);
    else out.values.push(leaf);
  };

  // Liste von Einträgen (Messdatenblock/Wiederholungstabelle): jeder Eintrag = Durchlauf.
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isPlainObject)) {
    const entries = parsed as Array<Record<string, unknown>>;
    entries.forEach((e, i) => {
      const id = typeof e.__instance_id === "string" ? e.__instance_id : entries.length > 1 ? `__entry${i + 1}` : null;
      const label =
        typeof e.__label === "string" && e.__label.trim() ? e.__label : entries.length > 1 ? `Eintrag ${i + 1}` : null;
      walk(e, [], id, label);
    });
    return out;
  }
  walk(parsed, [], null, null);
  return out;
}
