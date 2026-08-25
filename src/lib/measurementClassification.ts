/**
 * Trennung von echten Mess-/Ergebnisparametern und technischen Metadaten.
 *
 * Zentrale fachliche Regel des Messdatenimports:
 *   echter Messwert                -> immer erhalten (zugeordnet oder „nicht zugeordnet“)
 *   technisches Metadatum          -> nie als Ergebniswert, nur als Importinformation
 *
 * Bewusst methodenunabhängig: die Erkennung nutzt ausschließlich Name, Rohwert
 * und Einheit – kein gerätespezifisches Wissen.
 */
import { normalizeName } from "@/lib/measurementImport";

/* ------------------------------------------------------------------ */
/* Einheiten                                                           */
/* ------------------------------------------------------------------ */

/** Typische Ergebnis-Einheiten (Vergleich erfolgt normalisiert). */
export const KNOWN_UNITS = [
  "%", "ppm", "ppb", "ppt", "mg/kg", "g/kg", "µg/g", "ug/g", "mg/g",
  "m²/g", "m2/g", "cm³/g", "cm3/g", "ml/g", "nm", "µm", "um", "mm", "cm", "m",
  "g", "mg", "kg", "g/cm³", "g/cm3", "kg/m³", "kg/m3",
  "°c", "k", "mpa", "kpa", "bar", "s", "min", "h", "mol/l", "meq/100g",
];

const normUnit = (u: string) => u.trim().toLowerCase().replace(/\s+/g, "");

export const isKnownUnit = (u: string | null | undefined): boolean =>
  !!u && KNOWN_UNITS.includes(normUnit(u));

/**
 * Trennt Einheiten aus dem Parameternamen: „As (PPM)“ -> { name: "As", unit: "ppm" }.
 * Der Parametername darf die Einheit niemals behalten.
 */
export function splitNameUnit(rawName: string): { name: string; unit: string | null } {
  let name = String(rawName ?? "").trim();
  let unit: string | null = null;

  // Einheit in Klammern am Ende: As (PPM), SiO2 [%]
  const bracket = name.match(/^(.*?)[\s]*[([{]\s*([^)\]}]+)\s*[)\]}]\s*$/);
  if (bracket && isKnownUnit(bracket[2])) {
    name = bracket[1].trim();
    unit = normUnit(bracket[2]);
  }

  // Einheit als angehängtes Wort: „As ppm“, „SiO2 %“
  if (!unit) {
    const tail = name.match(/^(.*\S)\s+(\S+)$/);
    if (tail && isKnownUnit(tail[2])) {
      name = tail[1].trim();
      unit = normUnit(tail[2]);
    } else if (/^(.*[A-Za-z0-9)\]])\s*%$/.test(name)) {
      name = name.replace(/\s*%$/, "").trim();
      unit = "%";
    }
  }

  return { name: name.replace(/[:=]\s*$/, "").trim(), unit };
}

/* ------------------------------------------------------------------ */
/* Kanonische Parameternamen                                           */
/* ------------------------------------------------------------------ */

/** Bekannte Aliasnamen -> kanonischer Parameter (normalisierte Schreibweise). */
const ALIASES: Record<string, string> = {
  arsenic: "as", arsen: "as",
  lead: "pb", blei: "pb",
  chromium: "cr", chrom: "cr",
  cadmium: "cd", mercury: "hg", quecksilber: "hg",
  nickel: "ni", copper: "cu", kupfer: "cu", zinc: "zn", zink: "zn",
  iron: "fe", eisen: "fe", silicon: "si", silizium: "si",
  aluminium: "al", aluminum: "al", titanium: "ti", titan: "ti",
  silica: "sio2", alumina: "al2o3",
  specificsurfacearea: "betsurfacearea",
  spezifischeoberflache: "betsurfacearea",
};

/** Vergleichsform eines Parameters ohne Einheit, mit Alias-Auflösung. */
export function canonicalParameter(rawName: string): string {
  const { name } = splitNameUnit(rawName);
  const n = normalizeName(name);
  return ALIASES[n] ?? n;
}

/* ------------------------------------------------------------------ */
/* Metadaten-Erkennung                                                 */
/* ------------------------------------------------------------------ */

export type ImportCategory = "measurement" | "metadata";

export type MetadataKind =
  | "date" | "time" | "method" | "instrument" | "operator"
  | "file" | "software" | "identifier" | "comment" | "status" | "other";

/** Endungen, die auf technische Kennungen statt Messwerte hindeuten. */
const META_SUFFIXES = /(id|nummer|nr|version|name|datum|zeit|pfad|datei)$/;
const META_PREFIXES = /^(gerat|instrument|device|serial|serien|operator|bediener|datei|file|software|report|kommentar|status|lauf|run|method|methode|mess?method)/;

const META_PATTERNS: Array<{ kind: MetadataKind; re: RegExp }> = [
  { kind: "date", re: /^(datum|mess?datum|analysendatum|analysedatum|pruefdatum|date|analysisdate|measurementdate|reportdate|startdate|enddate|erstelltam|createdat)$/ },
  { kind: "time", re: /^(uhrzeit|messzeit|zeit|time|analysistime|starttime|endtime|dauer|duration)$/ },
  { kind: "method", re: /^(methode|messmethode|analysemethode|pruefmethode|verfahren|method|methodname|measurementmethod|analysismethod|application|applikation|programm|program)$/ },
  { kind: "instrument", re: /^(gerat|geratid|geratenummer|geratenr|instrument|instrumentid|instrumentname|device|deviceid|seriennummer|serialnumber|serialno|spektrometer|analyzer|detektor|detector|channel|kanal)$/ },
  { kind: "operator", re: /^(operator|bediener|benutzer|user|username|anwender|bearbeiter|pruefer|analyst|laborant)$/ },
  { kind: "file", re: /^(datei|dateiname|dateipfad|filename|filepath|file|pfad|path|quelldatei|sourcefile|export|exportdatei)$/ },
  { kind: "software", re: /^(software|softwareversion|version|parserversion|firmware|build|applikationsversion)$/ },
  { kind: "identifier", re: /^(id|internalid|interneid|laufnummer|runnumber|run|sequenz|sequence|nummer|nr|no|index|position|pos|jobid|auftragsnummer|probennummer|samplied|sampleid|messnummer|messid|barcode)$/ },
  { kind: "comment", re: /^(kommentar|bemerkung|bemerkungen|comment|comments|notes|notiz|beschreibung|description|report|reportinfo|reportinformation|titel|title|header|kopfzeile)$/ },
  { kind: "status", re: /^(status|zustand|state|result?status|freigabe|flag|fehler|error|warnung|warning|qualitaet|quality)$/ },
  // Analyse-/Messbedingungen: beschreiben die Durchführung, nicht das Ergebnis.
  { kind: "other", re: /^(samplemass|sampleweight|einwaage|probeneinwaage|sampledensity|probendichte|equilibrationinterval|equilibrationtime|aequilibrierzeit|analysisbathtemp|bathtemperature|badtemperatur|analysistemperature|analysisfreespace|ambientfreespace|freespace|warmfreespace|coldfreespace|lowpressuredose|automaticdegas|degasconditions|degastemperature|thermalcorrection|analysisadsorptive|adsorptive|systemvolume|sampletube|reporttime|started|completed|submitter|einreicher)$/ },

];

const DATE_VALUE = /^\d{1,4}[.\-/]\d{1,2}[.\-/]\d{1,4}([ T]\d{1,2}:\d{2}(:\d{2})?)?$/;
const TIME_VALUE = /^\d{1,2}:\d{2}(:\d{2})?$/;

export interface ClassifiableReading {
  sourceName: string;
  raw: string;
  value: number | null;
  unit?: string | null;
  belowDetection?: boolean;
}

export interface Classification {
  category: ImportCategory;
  /** Parametername ohne Einheit. */
  parameter: string;
  /** Einheit aus Name oder Rohwert. */
  unit: string | null;
  /** Nur bei Metadaten gesetzt. */
  metadataKind?: MetadataKind;
  /** Kurzbegründung für die Vorschau. */
  reason: string;
}

/**
 * Entscheidet, ob ein gelesener Eintrag ein echter Messwert oder ein
 * technisches Metadatum ist. Nicht jeder numerische Wert ist ein Messwert.
 */
export function classifyReading(r: ClassifiableReading): Classification {
  const { name, unit: nameUnit } = splitNameUnit(r.sourceName);
  const unit = nameUnit ?? (r.unit ?? null);
  const key = normalizeName(name);
  const raw = String(r.raw ?? "").trim();

  const meta = META_PATTERNS.find((p) => p.re.test(key));
  if (meta) {
    return { category: "metadata", parameter: name, unit: null, metadataKind: meta.kind, reason: "Technische Information" };
  }

  // Datums-/Zeitwerte sind auch ohne sprechenden Namen keine Messwerte.
  if (DATE_VALUE.test(raw)) {
    return { category: "metadata", parameter: name, unit: null, metadataKind: "date", reason: "Datumswert" };
  }
  if (TIME_VALUE.test(raw)) {
    return { category: "metadata", parameter: name, unit: null, metadataKind: "time", reason: "Zeitwert" };
  }

  // Technische Kennungen (Geräte-ID, Laufnummer, Softwareversion …).
  if (META_PREFIXES.test(key) && META_SUFFIXES.test(key)) {
    return { category: "metadata", parameter: name, unit: null, metadataKind: "identifier", reason: "Technische Kennung" };
  }

  // Einheit ist ein starkes Indiz für einen Messwert.
  if (isKnownUnit(unit)) {
    return { category: "measurement", parameter: name, unit, reason: "Einheit erkannt" };
  }

  // Ohne Einheit: nur numerische bzw. unter der Nachweisgrenze liegende Werte
  // gelten als Messwert – freier Text ist eine Information.
  if (r.value != null || r.belowDetection) {
    return { category: "measurement", parameter: name, unit, reason: "Numerischer Messwert" };
  }

  return { category: "metadata", parameter: name, unit: null, metadataKind: "other", reason: "Kein numerischer Messwert" };
}

/** Ein importierter Messwert ohne Zielfeld – bleibt vollständig erhalten. */
export interface UnassignedMeasurementValue {
  parameter: string;
  normalized: string;
  raw: string;
  value: number | string | null;
  unit: string | null;
  source?: string | null;
}

/** Importinformation (Metadatum) für die Nachvollziehbarkeit. */
export interface ImportMetadataEntry {
  label: string;
  value: string;
  kind: MetadataKind;
}
