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
import { formatElementKey } from "@/lib/elementKeys";

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
