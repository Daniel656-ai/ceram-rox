/**
 * Zentrale Zuordnung Beprobungskürzel → Dienstleistung.
 *
 * Hintergrund: Die Dienstleistungs-Stammdaten besitzen im Firmen-Datenbestand
 * keine eigene Spalte für das Beprobungskürzel. Die einzige Information, die in
 * beiden Datenbeständen identisch und eindeutig vorhanden ist, ist der
 * Dienstleistungsname (`measurement_services.service_name`) – IDs unterscheiden
 * sich je Datenbestand.
 *
 * Deshalb erfolgt die Zuordnung ausschließlich hier, auf Anwendungsebene, über
 * den Dienstleistungsnamen. Pro Kürzel dürfen mehrere Schreibweisen/Synonyme
 * hinterlegt sein; verwendet wird der erste im Katalog tatsächlich vorhandene
 * aktive Treffer. Es wird niemals eine Dienstleistung erzeugt oder geraten.
 */

export type SamplingCodeMapping = {
  /** Kürzel, wie es die m³-Liste liefert (z. B. „Geo“). */
  code: string;
  /** Mögliche Dienstleistungsnamen, exakt wie im Dienstleistungskatalog. */
  serviceNames: string[];
};

export const SAMPLING_CODE_MAP: SamplingCodeMapping[] = [
  { code: "Geo", serviceNames: ["Geometrievermessung"] },
  { code: "NOx", serviceNames: ["NOX-Messung"] },
  { code: "SOx", serviceNames: ["SOX-Messung"] },
  { code: "BET", serviceNames: ["BET"] },
  { code: "PV", serviceNames: ["Porenvolumen"] },
  { code: "DP", serviceNames: ["DP"] },
  { code: "A", serviceNames: ["Abrieb"] },
  { code: "CA", serviceNames: ["CA"] },
  { code: "Bench", serviceNames: ["BENCH NOx", "BENCH SOx"] },
];

/** Vergleichsform: ohne Groß-/Kleinschreibung und ohne Randleerzeichen. */
export const normalizeSamplingKey = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

/** Liefert die hinterlegten Dienstleistungsnamen zu einem Kürzel. */
export function serviceNamesForCode(code: string): string[] {
  const key = normalizeSamplingKey(code);
  return SAMPLING_CODE_MAP.find((m) => normalizeSamplingKey(m.code) === key)?.serviceNames ?? [];
}

/** Liefert das Kürzel zu einem Dienstleistungsnamen (für die Anzeige). */
export function samplingCodeForServiceName(serviceName: string | null | undefined): string | null {
  const key = normalizeSamplingKey(serviceName);
  if (!key) return null;
  const hit = SAMPLING_CODE_MAP.find((m) =>
    m.serviceNames.some((n) => normalizeSamplingKey(n) === key)
  );
  return hit?.code ?? null;
}

/**
 * Ordnet Beprobungskürzel den bereits vorhandenen Dienstleistungen zu.
 * Verglichen wird ausschließlich der Dienstleistungsname – exakt, ohne
 * Namensähnlichkeit. Ein Kürzel kann mehrere Dienstleistungen bedeuten
 * („Bench“ → BENCH NOx + BENCH SOx); dann werden alle vorhandenen übernommen.
 */
export function matchSamplingCodes<T extends { id: string; service_name: string }>(
  codes: string[],
  services: T[]
): { matched: { code: string; id: string; service_name: string }[]; missing: string[] } {
  const byName = new Map(services.map((s) => [normalizeSamplingKey(s.service_name), s]));
  const matched: { code: string; id: string; service_name: string }[] = [];
  const missing: string[] = [];
  for (const raw of codes) {
    const code = (raw ?? "").trim();
    if (!code) continue;
    const hits = serviceNamesForCode(code)
      .map((n) => byName.get(normalizeSamplingKey(n)))
      .filter(Boolean) as T[];
    if (hits.length) {
      for (const hit of hits) matched.push({ code, id: hit.id, service_name: hit.service_name });
    } else missing.push(code);
  }
  return { matched, missing };
}
