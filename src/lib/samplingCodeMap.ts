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
  // Altwert – bleibt für bestehende gespeicherte Auswahlen lesbar.
  { code: "Bench", serviceNames: ["BENCH NOx", "BENCH SOx"] },
  { code: "Bench NOx", serviceNames: ["BENCH NOx"] },
  { code: "Bench SOx", serviceNames: ["BENCH SOx"] },
  // Exklusive Auswahl ohne Dienstleistung.
  { code: "Keine Messung notwendig", serviceNames: [] },
];

export const LEGACY_BENCH_CODE = "Bench";
export const NO_MEASUREMENT_CODE = "Keine Messung notwendig";
const BENCH_CODES = ["bench", "bench nox", "bench sox"];

/** Auswahlbare Kürzel für neue Eingaben (Alt-„Bench“ nur, wenn bereits gewählt). */
export function selectableSamplingCodes(selected: string[]): string[] {
  const hasLegacy = selected.some((c) => normalizeSamplingKey(c) === "bench");
  return SAMPLING_CODE_MAP.map((m) => m.code).filter((c) => c !== LEGACY_BENCH_CODE || hasLegacy);
}

/**
 * Auswahl umschalten. „Keine Messung notwendig“ ist exklusiv: Aktivieren wählt
 * alles andere ab, Auswahl einer anderen Messart hebt sie auf.
 */
export function toggleSamplingCode(selected: string[], code: string, checked: boolean): string[] {
  const key = normalizeSamplingKey(code);
  const noKey = normalizeSamplingKey(NO_MEASUREMENT_CODE);
  let next = selected.filter((c) => normalizeSamplingKey(c) !== key);
  if (checked) {
    if (key === noKey) return [NO_MEASUREMENT_CODE];
    next = next.filter((c) => normalizeSamplingKey(c) !== noKey);
    next.push(code);
  }
  const ordered = SAMPLING_CODE_MAP.map((m) => m.code).filter((c) =>
    next.some((n) => normalizeSamplingKey(n) === normalizeSamplingKey(c))
  );
  const unknown = next.filter((n) => !SAMPLING_CODE_MAP.some((m) => normalizeSamplingKey(m.code) === normalizeSamplingKey(n)));
  return [...ordered, ...unknown];
}

/** Bei einer oder mehreren Bench-Auswahlen insgesamt genau ein zusätzliches Teststück. */
export function benchExtraTestPieces(selected: string[]): number {
  return selected.some((c) => BENCH_CODES.includes(normalizeSamplingKey(c))) ? 1 : 0;
}

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
