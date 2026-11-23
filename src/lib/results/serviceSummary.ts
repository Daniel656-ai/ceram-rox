import { isInternalResult } from "@/lib/results/internalResults";
import { displayResults } from "@/lib/results/betMeasurement";
import { isOfficialResult, type SampleMeasurementRecord } from "@/lib/results/sampleResultsAggregation";

/**
 * Welche Messarten (BET, RFA, Geometrie …) zu einem Auftrag bzw. einer Probe gehören –
 * mit Anzahl Analysen und offiziellen/vorläufigen Werten je Messart. Reine Anzeige.
 */
export interface ServiceSummary {
  name: string;
  /** Anzahl Analysen (Messungen) dieser Messart. */
  analyses: number;
  official: number;
  interim: number;
}

/** Messarten alphabetisch; interne Einträge (Importprotokolle, leere Blöcke …) zählen nicht als Werte. */
export function summarizeServices(measurements: SampleMeasurementRecord[]): ServiceSummary[] {
  const byName = new Map<string, ServiceSummary>();
  for (const m of measurements) {
    const name = (m.serviceName || "").trim() || "Messung";
    let s = byName.get(name);
    if (!s) {
      s = { name, analyses: 0, official: 0, interim: 0 };
      byName.set(name, s);
    }
    s.analyses += 1;
    for (const r of displayResults(m.serviceName, m.results ?? [])) {
      if (isInternalResult(r)) continue;
      if (isOfficialResult(r)) s.official += 1;
      else s.interim += 1;
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Wie viele Chips direkt sichtbar sind, bevor „+N“ folgt. */
export const VISIBLE_SERVICE_CHIPS = 3;
