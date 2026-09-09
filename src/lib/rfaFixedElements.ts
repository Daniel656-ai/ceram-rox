/**
 * RFA-Messfälle mit Elementbereich („Standardlos“, „Oberfläche“).
 *
 * Grundprinzip (zentral, nicht je Messfall programmiert):
 *
 *   ERGEBNISFELDER = FIXED_ELEMENTS (immer, in fester Reihenfolge)
 *                    + dynamisch importierte Elemente mit numerischem Wert > 0
 *
 * Die ersten 17 Elemente entsprechen exakt der Reihenfolge des Messfalls
 * „Kalibrierte Elemente“ und bleiben auch dann erhalten, wenn der Import sie
 * nicht liefert. Messfälle mit fester Elementliste ohne Bereich
 * („Qualitätskontrolle“, „Kalibrierte Elemente“) bleiben unberührt.
 */

import type { CaseElementSpec } from "@/lib/measurementBlocks";
import { elementKey, elementLibrary, elementSortValue, formatElementKey } from "@/lib/elementKeys";

/** Feste Ergebnisstruktur (Position 1–17) inklusive originaler Einheit. */
export const RFA_FIXED_ELEMENTS: ReadonlyArray<{ key: string; unit: string }> = [
  { key: "SiO2", unit: "%" },
  { key: "Al2O3", unit: "%" },
  { key: "Fe2O3", unit: "%" },
  { key: "TiO2", unit: "%" },
  { key: "CaO", unit: "%" },
  { key: "MgO", unit: "%" },
  { key: "BaO", unit: "%" },
  { key: "Na2O", unit: "%" },
  { key: "K2O", unit: "%" },
  { key: "SO3", unit: "%" },
  { key: "P2O5", unit: "%" },
  { key: "V2O5", unit: "%" },
  { key: "WO3", unit: "%" },
  { key: "MoO3", unit: "%" },
  { key: "As", unit: "ppm" },
  { key: "Pb", unit: "ppm" },
  { key: "Nb", unit: "%" },
];

/** Einheit eines festen Standardelements (As/Pb bleiben ppm). */
export function fixedElementUnit(key: string): string | null {
  return RFA_FIXED_ELEMENTS.find((e) => e.key === key)?.unit ?? null;
}

/**
 * Standardbereich der dynamischen RFA-Messfälle. Er wird nur verwendet, wenn
 * am Messfall kein eigener Elementbereich gepflegt ist.
 */
export const DEFAULT_RFA_ELEMENT_RANGE = "B-U";

/** Bezeichnungen, die einen dynamischen RFA-Messfall kennzeichnen. */
const DYNAMIC_RFA_PATTERN = /standard\s*-?\s*los|oberfl(ä|ae)che/i;

/**
 * Im Messkontext (z. B. Präparation „Oberfläche“) darf nur die eindeutige
 * Bezeichnung „Standardlos“ die dynamische Elementlogik auslösen.
 */
const DYNAMIC_RFA_CONTEXT_PATTERN = /standard\s*-?\s*los/i;

/**
 * Erkennt „Standardlos“ bzw. „Oberfläche“ – auch dann, wenn die Bezeichnung
 * aus der Messfallsteuerung stammt (z. B. Messfall „Externe Analyse“ mit der
 * Messung „Standardlos“). „Kalibrierte Elemente“ und „Qualitätskontrolle“
 * werden bewusst NICHT erfasst.
 */
export function isDynamicRfaScope(...texts: Array<unknown>): boolean {
  return texts.some((t) => typeof t === "string" && DYNAMIC_RFA_PATTERN.test(t));
}

/** Wie `isDynamicRfaScope`, aber nur für eindeutige Kontextangaben. */
export function isDynamicRfaContext(...texts: Array<unknown>): boolean {
  return texts.some((t) => typeof t === "string" && DYNAMIC_RFA_CONTEXT_PATTERN.test(t));
}

/**
 * Wirksamer Elementbereich einer Messung: gepflegter Bereich des Messfalls,
 * sonst der Standardbereich für „Standardlos“/„Oberfläche“. Namen von Messfall
 * und Messung entscheiden breit, Kontextwerte nur bei „Standardlos“.
 */
export function effectiveElementRange(
  configured: string | null | undefined,
  names: Array<unknown>,
  contextValues: Array<unknown> = []
): string | null {
  const explicit = typeof configured === "string" ? configured.trim() : "";
  if (explicit) return explicit;
  return isDynamicRfaScope(...names) || isDynamicRfaContext(...contextValues)
    ? DEFAULT_RFA_ELEMENT_RANGE
    : null;
}


/**
 * Numerischer Messwert > 0? Die Prüfung erfolgt immer auf dem Zahlenwert,
 * niemals auf dem formatierten Anzeigetext („0,000“ ist nicht > 0).
 */
export function isPositiveMeasurement(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  const raw = String(value).trim();
  if (!raw) return false;
  const n = Number.parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0;
}

/**
 * Ergänzt die feste 17er-Struktur vor einer (meist leeren) Messfall-Liste.
 * Doppelte Elemente entstehen nicht; bereits konfigurierte Elemente behalten
 * ihre Bezeichnung und werden nicht zusätzlich angehängt.
 */
export function withFixedRfaElements(spec: CaseElementSpec[]): CaseElementSpec[] {
  const configured = new Map(spec.map((s) => [s.key, s]));
  const out: CaseElementSpec[] = RFA_FIXED_ELEMENTS.map(({ key, unit }) => {
    const hit = configured.get(key);
    configured.delete(key);
    return hit
      ? { ...hit, unit: hit.unit ?? unit }
      : { key, label: formatElementKey(key), official: true, unit };
  });
  for (const s of spec) if (configured.has(s.key)) out.push(s);
  return out;
}

/**
 * Reihenfolge der Ergebnisse für Anzeige/Export: erst die 17 Standardelemente
 * in fester Reihenfolge, danach weitere Elemente nach Ordnungszahl. Nicht-
 * chemische Ergebnisse behalten ihre bisherige Position – bestehende
 * Ergebnisdarstellungen ändern sich dadurch nicht.
 */
export function orderElementResults<T extends { display_label?: string | null; result_name: string }>(
  rows: T[],
): T[] {
  /** Nur echte chemische Bezeichnungen werden umsortiert („Feuchte“ bleibt stehen). */
  const norm = (v: string) =>
    v.toLowerCase()
      .replace(/[\u2080-\u2089]/g, (c) => String(c.charCodeAt(0) - 0x2080))
      .replace(/[^a-z0-9]/g, "");
  const known = new Set(elementLibrary.map((e) => e.key));
  const rank = (r: T): number | null => {
    const label = (r.display_label || r.result_name || "").trim();
    const key = elementKey(label);
    if (!key) return null;
    // Nur Elemente der globalen Elementbibliothek werden umsortiert.
    const looksChemical =
      known.has(key) || (key.length <= 6 && !/[a-z]{3}/.test(label));
    if (norm(key) !== norm(label) || !looksChemical) return null;
    const fixed = RFA_FIXED_ELEMENTS.findIndex((e) => e.key === key);
    return fixed >= 0 ? fixed : 1000 + elementSortValue(key);
  };
  const slots: number[] = [];
  const elements: Array<{ row: T; rank: number }> = [];
  rows.forEach((row, i) => {
    const r = rank(row);
    if (r == null) return;
    slots.push(i);
    elements.push({ row, rank: r });
  });
  if (elements.length < 2) return rows;
  elements.sort((a, b) => a.rank - b.rank);
  const out = [...rows];
  slots.forEach((slot, i) => { out[slot] = elements[i].row; });
  return out;
}
