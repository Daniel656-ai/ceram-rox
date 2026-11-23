import { parseStructuredText } from "@/lib/results/structuredValues";
import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";

/**
 * BET (spezifische Oberfläche): In der Ergebnisdatenbank zählt nur das Ergebnis „Spezifische Oberfläche BET“ in m²/g
 * (Regel: docs/gestaltungsregeln.md, Abschnitt „BET“). Hilfswerte (Tara, Brutto, Probengewicht, Rohr-Nr., SMP-Nummer,
 * Importinfo …) bleiben in der Datenbank gespeichert, werden aber nicht angezeigt. Reine Anzeige.
 *
 * Erkennung: Messart (BET / Spezifische Oberfläche) UND Feldzuordnung (Schlüssel `spezifische_oberflache_bet`,
 * Beschriftung „… Oberfläche … BET …“ oder ein `*bet*`-Feld mit Einheit m²/g) – nicht nur die Beschriftung.
 */

export const isBetService = (name: string | null | undefined): boolean =>
  /(^|[^a-z])bet([^a-z]|$)/i.test(name ?? "") || /spezifische\s+oberfl/i.test(name ?? "");

const keyOf = (r: Pick<SampleResultValue, "result_name">): string =>
  (r.result_name.startsWith("form:") ? r.result_name.slice(r.result_name.indexOf(":", 5) + 1) : r.result_name).toLowerCase();

const normUnit = (u: string | null | undefined): string =>
  (u ?? "").replace(/\s/g, "").replace("^{2}", "²").toLowerCase();

/** Ist das der BET-Ergebniswert (und kein Hilfswert)? */
export function isBetResult(r: Pick<SampleResultValue, "result_name" | "display_label" | "unit" | "value" | "remarks">): boolean {
  if (r.value === null && parseStructuredText(r.remarks) !== undefined) return false; // Importinfo/Blöcke sind keine Werte
  const key = keyOf(r);
  if (/^spezifische_oberfl(a|ä|ae)che(_bet)?$/.test(key)) return true;
  const label = r.display_label ?? "";
  if (/oberfl/i.test(label) && /(^|[^a-z])bet([^a-z]|$)/i.test(label)) return true;
  const unit = normUnit(r.unit);
  return /(^|_)bet(_|$)/.test(key) && (unit === "m²/g" || unit === "m2/g");
}

/**
 * Die anzuzeigenden Ergebnisse einer Messung: bei BET nur der BET-Wert, sonst unverändert.
 * Findet sich in einer BET-Messung kein BET-Wert, bleibt alles sichtbar (nichts geht verloren).
 */
export function displayResults<T extends SampleResultValue>(serviceName: string | null | undefined, results: T[]): T[] {
  if (!isBetService(serviceName)) return results;
  const bet = results.filter(isBetResult);
  return bet.length > 0 ? bet : results;
}

/** Zahlenwert eines BET-Ergebnisses (Zahl oder einfacher Text); null = leer. */
export function betValue(r: Pick<SampleResultValue, "value" | "remarks">): number | string | null {
  if (r.value !== null && r.value !== undefined) return r.value;
  const t = (r.remarks ?? "").trim();
  if (!t || parseStructuredText(t) !== undefined) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : t;
}
