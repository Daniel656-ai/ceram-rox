/**
 * Probennummern für Beprobungsaufträge aus der m³-Liste.
 * Format: erste 9 Zeichen der Artikelnummer + "-" + fünfstellige Elementnummer.
 * Reine Funktionen, ausschließlich String-Verarbeitung (führende Nullen bleiben erhalten).
 */
import { articlePrefix } from "./orderLabel";
import type { TestMarkingRowsResolution } from "./testMarking";

export class M3SampleNumberError extends Error {}

export function buildM3SampleNumber(articleNumber: unknown, elementNumber: unknown): string {
  const prefix = articlePrefix(typeof articleNumber === "string" ? articleNumber : null);
  if (!prefix || prefix.length !== 9) {
    throw new M3SampleNumberError("Artikelnummer fehlt oder hat weniger als 9 Zeichen – Probennummer kann nicht gebildet werden.");
  }
  const raw = typeof elementNumber === "string" ? elementNumber.trim() : "";
  if (!/^\d{1,5}$/.test(raw)) {
    throw new M3SampleNumberError(`Ungültige Elementnummer „${String(elementNumber ?? "")}“ – erwartet bis zu fünf Ziffern.`);
  }
  return `${prefix}-${raw.padStart(5, "0")}`;
}

export interface M3SamplePlanEntry {
  rowIndex: number;
  elementNumber: string;
  sampleNumber: string;
}

/**
 * Variante A: Ist mindestens eine TEST-Zeile markiert, nur diese Zeilen;
 * sonst alle Zeilen mit gültiger abgeleiteter Elementnummer.
 * Unklare TEST-Markierungen (mehrdeutig/verwaist/Altindex) werden abgelehnt statt ersetzt.
 */
export function planM3Samples(
  articleNumber: unknown,
  rows: Record<string, unknown>[],
  marking: TestMarkingRowsResolution
): M3SamplePlanEntry[] {
  if (marking.status === "ambiguous" || marking.status === "missing" || marking.status === "legacy_index") {
    throw new M3SampleNumberError("Die TEST-Markierung ist nicht eindeutig zuordenbar – bitte TEST-Zeilen neu setzen.");
  }
  const marked = marking.status === "ok" && marking.rowIndices.length > 0;
  const indices = marked ? marking.rowIndices : rows.map((_, i) => i);
  const plan: M3SamplePlanEntry[] = [];
  for (const i of indices) {
    const el = rows[i]?.element_number;
    const valid = typeof el === "string" && /^\d{1,5}$/.test(el.trim());
    if (!valid) {
      if (marked) throw new M3SampleNumberError(`TEST-Zeile ${i + 1} hat keine gültige Elementnummer.`);
      continue;
    }
    plan.push({ rowIndex: i, elementNumber: (el as string).trim(), sampleNumber: buildM3SampleNumber(articleNumber, el) });
  }
  if (!plan.length) throw new M3SampleNumberError("Keine m³-Zeile mit gültiger Elementnummer – es kann keine Probe angelegt werden.");
  const seen = new Map<string, number>();
  for (const p of plan) {
    if (seen.has(p.sampleNumber)) {
      throw new M3SampleNumberError(`Probennummer ${p.sampleNumber} kommt in Zeile ${seen.get(p.sampleNumber)! + 1} und ${p.rowIndex + 1} doppelt vor.`);
    }
    seen.set(p.sampleNumber, p.rowIndex);
  }
  return plan;
}
