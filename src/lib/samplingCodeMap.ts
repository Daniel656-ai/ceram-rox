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
  { code: "NOx", serviceNames: ["NOX-Messung", "BENCH NOx"] },
  { code: "SOx", serviceNames: ["BENCH SOx"] },
  { code: "BET", serviceNames: ["BET"] },
  { code: "PV", serviceNames: ["Porenvolumen", "PGV (Hg)"] },
  { code: "A", serviceNames: ["Abrieb", "Aktivitätsmessung Mikroreaktor"] },
  { code: "DP", serviceNames: ["Druckprüfung"] },
  { code: "CA", serviceNames: ["Chemische Analyse", "RFA"] },
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
