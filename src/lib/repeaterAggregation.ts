/**
 * ROX – Aggregation über Messreihen-/Wiederholbereiche
 * ====================================================
 *
 * Ein Wiederholbereich (`field_type = "repeater"`) speichert seine Einträge als
 * Array von Objekten unter dem Feldschlüssel des Bereichs. Damit formularweite
 * Berechnungen (z. B. „Aktivitätsproben gesamt“) über ALLE Einträge rechnen
 * können, werden die Unterfeldwerte zusätzlich als Liste in den Rechen-Scope
 * gespiegelt:
 *
 *   vorgaben.anzahl_aktivitaetsproben  ->  [3, 3, 3, 3]
 *
 * Die vorhandenen Aggregatfunktionen der Formel-Engine (SUM, COUNT, MAX …)
 * arbeiten unverändert auf diesen Listen. Es entsteht keine zweite
 * Berechnungslogik: gespeicherte Werte bleiben unangetastet, die Spiegelung
 * geschieht ausschließlich zur Laufzeit der Auswertung.
 */

import type { FormField } from "@/lib/api/formFields";
import { repeaterChildren } from "@/lib/api/formFields";
import { numericValue } from "@/lib/fieldLinks";

/** Referenzschlüssel einer Messreihen-Aggregation (`bereich.unterfeld`). */
export const aggregateKey = (repeaterKey: string, childKey: string) => `${repeaterKey}.${childKey}`;

export interface AggregateRef {
  key: string;
  repeaterKey: string;
  childKey: string;
  label: string;
  unit: string | null;
}

/** Alle über Einträge aggregierbaren Unterfelder eines Formulars. */
export function repeaterAggregateRefs(fields: FormField[]): AggregateRef[] {
  const out: AggregateRef[] = [];
  for (const rep of fields) {
    if (rep.field_type !== "repeater") continue;
    for (const child of repeaterChildren(fields, rep.id)) {
      out.push({
        key: aggregateKey(rep.field_key, child.field_key),
        repeaterKey: rep.field_key,
        childKey: child.field_key,
        label: `${rep.display_name} › ${child.display_name}`,
        unit: child.unit ?? null,
      });
    }
  }
  return out;
}

/**
 * Werte-Listen je Unterfeld über alle Einträge. Leere bzw. nicht numerische
 * Eingaben werden ausgelassen – sie gelten als „noch nicht erfasst“ und dürfen
 * niemals als 0 in eine Summe einfließen.
 */
export function repeaterAggregateScope(
  fields: FormField[],
  values: Record<string, unknown> | undefined,
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!values) return out;
  for (const rep of fields) {
    if (rep.field_type !== "repeater") continue;
    const raw = values[rep.field_key];
    const entries: Array<Record<string, unknown>> = Array.isArray(raw) ? raw : [];
    for (const child of repeaterChildren(fields, rep.id)) {
      const list: number[] = [];
      for (const entry of entries) {
        const n = numericValue(entry?.[child.field_key]);
        if (n != null) list.push(n);
      }
      out[aggregateKey(rep.field_key, child.field_key)] = list;
    }
  }
  return out;
}
