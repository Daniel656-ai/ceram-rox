/**
 * Standardisierte GHS-Gefahrstoffklassen (9 Klassen / GHS01-GHS09).
 * Wird sowohl für Rohstoffe als auch Proben verwendet.
 */

export type HazardClassKey =
  | "explosionsgefaehrlich" // GHS01
  | "entzuendlich"          // GHS02
  | "oxidierend"            // GHS03
  | "gas_unter_druck"       // GHS04
  | "aetzend"               // GHS05
  | "giftig"                // GHS06
  | "gefaehrlich"           // GHS07
  | "gesundheitsgefaehrdend"// GHS08
  | "umweltgefaehrlich";    // GHS09

export interface HazardClassMeta {
  key: HazardClassKey;
  ghsCode: "GHS01" | "GHS02" | "GHS03" | "GHS04" | "GHS05" | "GHS06" | "GHS07" | "GHS08" | "GHS09";
  /** lucide-react icon name used as the inner symbol */
  iconKey:
    | "bomb"
    | "flame"
    | "circle-flame"
    | "cylinder"
    | "test-tube"
    | "skull"
    | "alert"
    | "health"
    | "leaf";
}

export const HAZARD_CLASSES: readonly HazardClassMeta[] = [
  { key: "explosionsgefaehrlich",  ghsCode: "GHS01", iconKey: "bomb" },
  { key: "entzuendlich",           ghsCode: "GHS02", iconKey: "flame" },
  { key: "oxidierend",             ghsCode: "GHS03", iconKey: "circle-flame" },
  { key: "gas_unter_druck",        ghsCode: "GHS04", iconKey: "cylinder" },
  { key: "aetzend",                ghsCode: "GHS05", iconKey: "test-tube" },
  { key: "giftig",                 ghsCode: "GHS06", iconKey: "skull" },
  { key: "gefaehrlich",            ghsCode: "GHS07", iconKey: "alert" },
  { key: "gesundheitsgefaehrdend", ghsCode: "GHS08", iconKey: "health" },
  { key: "umweltgefaehrlich",      ghsCode: "GHS09", iconKey: "leaf" },
] as const;

export const HAZARD_CLASS_KEYS: readonly HazardClassKey[] =
  HAZARD_CLASSES.map((h) => h.key);

/**
 * Map ältere/abweichende Schlüssel auf die standardisierten 9 GHS-Klassen.
 * Erhält Abwärtskompatibilität mit bestehenden DB-Einträgen.
 */
const LEGACY_ALIASES: Record<string, HazardClassKey | null> = {
  // alte Sample/Raw-Material Keys
  toxisch: "giftig",
  reizend: "gefaehrlich",
  gesundheitsschaedlich: "gesundheitsgefaehrdend",
  // Identitäten (neue Keys)
  aetzend: "aetzend",
  giftig: "giftig",
  entzuendlich: "entzuendlich",
  oxidierend: "oxidierend",
  explosionsgefaehrlich: "explosionsgefaehrlich",
  gas_unter_druck: "gas_unter_druck",
  gefaehrlich: "gefaehrlich",
  gesundheitsgefaehrdend: "gesundheitsgefaehrdend",
  umweltgefaehrlich: "umweltgefaehrlich",
  // verworfen
  sonstiges: null,
};

export function normalizeHazardClass(key: string): HazardClassKey | null {
  if (!key) return null;
  const hit = LEGACY_ALIASES[key];
  return hit === undefined ? null : hit;
}

/** Normalisiert eine Liste und entfernt unbekannte/duplizierte Einträge. */
export function normalizeHazardClasses(keys: readonly string[] | null | undefined): HazardClassKey[] {
  if (!keys) return [];
  const out: HazardClassKey[] = [];
  for (const k of keys) {
    const n = normalizeHazardClass(k);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function getHazardMeta(key: string): HazardClassMeta | null {
  const n = normalizeHazardClass(key);
  if (!n) return null;
  return HAZARD_CLASSES.find((h) => h.key === n) ?? null;
}
