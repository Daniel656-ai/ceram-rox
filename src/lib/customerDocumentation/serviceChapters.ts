/**
 * Zentrale Zuordnung: Dienstleistung → Analyseart → Dokumentationskapitel.
 *
 * Diese Datei ist die EINZIGE Stelle, an der Dienstleistungsnamen fachlich
 * interpretiert werden. Komponenten und Exporte greifen ausschließlich hierauf
 * zu – es darf keine zweite Zuordnung in einer Komponente entstehen.
 *
 * Es werden keine Dienstleistungsnamen verändert und keine Datenbankfelder
 * benötigt; die Erkennung erfolgt rein lesend über den vorhandenen Namen.
 */

export type ChapterKey =
  | "header"
  | "toc"
  | "test_conditions"
  | "activity_conversion"
  | "physical_properties"
  | "geometry"
  | "material_certificates"
  | "welder_certificates"
  | "lifting_beam"
  | "drawings"
  | "spare_elements"
  | "module_packing_lists"
  | "attachments";

/** Reihenfolge der Kapitel im Dokument. */
export const CHAPTER_ORDER: ChapterKey[] = [
  "header",
  "toc",
  "test_conditions",
  "activity_conversion",
  "physical_properties",
  "geometry",
  "material_certificates",
  "welder_certificates",
  "lifting_beam",
  "drawings",
  "spare_elements",
  "module_packing_lists",
  "attachments",
];

export type AnalysisKey =
  | "bench_nox"
  | "bench_sox"
  | "nox"
  | "sox"
  | "bet"
  | "rfa"
  | "physical"
  | "geometry"
  | "other";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[_\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Erkennung der Analyseart aus dem Dienstleistungsnamen.
 * Reihenfolge ist bedeutsam: „BENCH NOx“ muss vor „NOx“ greifen.
 */
export function detectAnalysisKey(serviceName: string | null | undefined): AnalysisKey {
  const n = normalize(String(serviceName ?? ""));
  if (!n) return "other";
  const isBench = /\bbench\b/.test(n);
  if (isBench && /\bno ?x\b|\bnox\b/.test(n)) return "bench_nox";
  if (isBench && /\bso ?x\b|\bsox\b/.test(n)) return "bench_sox";
  if (/\bnox\b|\bno x\b/.test(n)) return "nox";
  if (/\bsox\b|\bso x\b|so2|so3/.test(n)) return "sox";
  if (/\bbet\b|oberfl(a|ä)che|surface area/.test(n)) return "bet";
  if (/\brfa\b|\bxrf\b|r(o|ö)ntgenfluoreszenz/.test(n)) return "rfa";
  if (/geometri|geometry|abmessung/.test(n)) return "geometry";
  if (/physikal|physical|dichte|density|porosit|festigkeit|strength|h(a|ä)rte/.test(n)) return "physical";
  return "other";
}

/** Kapitel, in dem die Ergebnisse dieser Analyseart erscheinen. */
export const ANALYSIS_CHAPTER: Record<AnalysisKey, ChapterKey | null> = {
  bench_nox: "activity_conversion",
  bench_sox: "activity_conversion",
  nox: "activity_conversion",
  sox: "activity_conversion",
  bet: "physical_properties",
  rfa: "physical_properties",
  physical: "physical_properties",
  geometry: "geometry",
  // Nicht zugeordnete Dienstleistungen erscheinen bewusst unter den
  // physikalischen Eigenschaften, damit kein offizielles Ergebnis verloren geht.
  other: "physical_properties",
};

/** Analysearten, deren Messparameter als Testbedingungen gelten. */
export const TEST_CONDITION_ANALYSES: AnalysisKey[] = ["bench_nox", "bench_sox", "nox", "sox"];

export function chapterForService(serviceName: string | null | undefined): ChapterKey | null {
  return ANALYSIS_CHAPTER[detectAnalysisKey(serviceName)];
}
