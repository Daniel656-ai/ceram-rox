/**
 * Methodenorientierter Importer „Gasadsorption“.
 *
 * Bewusst KEIN Hersteller- oder Geräteimporter: verarbeitet werden
 * Gasadsorptions-Mess- und Reportdateien beliebiger Systeme, solange sich
 * ihre Struktur auswerten lässt.
 *
 *   TextExtractor (binär / Text / Tabellenkalkulation)
 *     -> ParameterDetector (Katalog + generische „Name: Wert Einheit“-Zeilen)
 *     -> Klassifizierung (Messwert vs. technisches Metadatum)
 *     -> ResultNormalizer (Parametername und Einheit strikt getrennt)
 *
 * Alle Auswertungen (BET, BJH ads./des., Langmuir, t-Plot, DFT …) laufen über
 * denselben Importer – es gibt keinen Importer je Auswertung.
 */
import * as XLSX from "xlsx";
import { extractStrings, scanDoubles } from "../binaryText";
import { micromeriticsPairLines } from "./micromeriticsRecords";

import type {
  AnalysisType, Confidence, FileImporter, ImportedAnalysis,
  ImportedMeasurement, ImportedResult,
} from "../types";
import { GAS_SORPTION_PATTERNS, type GasSorptionParameterDef } from "./parameters";
import { classifyReading, splitNameUnit, isKnownUnit } from "@/lib/measurementClassification";

export const GAS_SORPTION_PARSER_VERSION = "2.0.0-gasadsorption";
export const GAS_SORPTION_IMPORTER_ID = "gasadsorption";

const EXTENSIONS = [".smp", ".rep", ".txt", ".csv", ".dat", ".prn", ".xls", ".xlsx"];
const SPREADSHEET = [".xls", ".xlsx"];

const ext = (name: string) => "." + (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();

/** Inhaltsmerkmale einer Gasadsorptionsmessung – unabhängig vom Hersteller. */
const CONTENT_MARKERS = [
  "bet", "bjh", "langmuir", "t-plot", "t plot", "dft", "isotherm",
  "adsorption", "desorption", "pore volume", "porenvolumen", "surface area",
  "oberfläche", "quantity adsorbed", "relative pressure", "p/po", "p/p0",
];

/** Herstellerhinweise werden ausschließlich als Metadatum verwendet. */
const VENDOR_HINTS = [
  "micromeritics", "tristar", "asap", "microactive", "gemini",
  "quantachrome", "autosorb", "nova", "anton paar",
  "bel japan", "belsorp", "microtrac", "3p instruments", "thermo",
];

/* ---------------------------------------------------------------- */
/* Textextraktion                                                    */
/* ---------------------------------------------------------------- */

const looksBinary = (buf: Uint8Array) => {
  const n = Math.min(buf.length, 4096);
  let zeros = 0;
  for (let i = 0; i < n; i++) if (buf[i] === 0) zeros++;
  return n > 0 && zeros / n > 0.1;
};

/** Liefert auswertbare Textzeilen – unabhängig vom konkreten Dateiformat. */
export function extractLines(file: { name: string; buffer: ArrayBuffer }): string[] {
  const e = ext(file.name);
  if (SPREADSHEET.includes(e)) {
    try {
      const wb = XLSX.read(file.buffer, { type: "array" });
      return wb.SheetNames.flatMap((n) =>
        XLSX.utils
          .sheet_to_csv(wb.Sheets[n], { FS: ": " })
          .split(/\r?\n/)
          .map((l) => l.replace(/(:\s)+/g, ": ").replace(/(^[:\s]+|[:\s]+$)/g, ""))
      ).filter((l) => l.trim() !== "");
    } catch {
      /* fällt auf die generische Extraktion zurück */
    }
  }
  const buf = new Uint8Array(file.buffer);
  if (looksBinary(buf)) {
    // Strukturierte Label/Wert-Paare haben Vorrang vor dem reinen Zeichenketten-Scan.
    const pairs = micromeriticsPairLines(file.buffer);
    const raw = extractStrings(file.buffer, 3).map((s) => s.text);
    return pairs.length >= 3 ? [...pairs, ...raw] : raw;
  }

  return new TextDecoder("utf-8", { fatal: false })
    .decode(buf)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

/* ---------------------------------------------------------------- */
/* Erkennung                                                         */
/* ---------------------------------------------------------------- */

export function detectGasSorption(file: { name: string; buffer: ArrayBuffer }): boolean {
  if (!EXTENSIONS.includes(ext(file.name))) return false;
  // Die Dateiendung entscheidet NICHT allein – der Inhalt wird geprüft.
  const hay = extractLines(file).join(" \n ").toLowerCase();
  return CONTENT_MARKERS.some((m) => hay.includes(m));
}

/* ---------------------------------------------------------------- */
/* Zahlen                                                            */
/* ---------------------------------------------------------------- */

const NUM_RE = /([+-]?\d(?:[\d.,]*\d)?(?:[eE][+-]?\d+)?)/;

export function toNumber(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "");
  const commas = (s.match(/,/g) ?? []).length;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const prefix = s.slice(0, lastComma).replace(/^[+-]/, "");
    const decimals = s.length - lastComma - 1;
    const thousands = commas > 1 || (decimals === 3 && prefix !== "0" && /^\d{1,3}$/.test(prefix));
    s = thousands ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Zahl + Einheit aus dem Text hinter der Bezeichnung. */
function valueFromText(tail: string): { value: number; unit: string | null } | null {
  const m = tail.match(NUM_RE);
  if (!m) return null;
  const value = toNumber(m[1]);
  if (value == null) return null;
  const after = tail.slice((m.index ?? 0) + m[1].length).trim();
  const unit = after.match(/^[^\s:;,]{1,12}/)?.[0] ?? null;
  return { value, unit: unit && /[a-zA-Z²³/·%°]/.test(unit) ? unit : null };
}

/* ---------------------------------------------------------------- */
/* Probeninformation & Metadaten                                     */
/* ---------------------------------------------------------------- */

function sampleInfo(lines: string[]) {
  const info: ImportedMeasurement["sampleInformation"] = {};
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    const low = t.toLowerCase();
    const tailOf = (label: string) => {
      const idx = low.indexOf(label);
      const inline = t.slice(idx + label.length).replace(/^[\s:=]+/, "");
      return inline || lines[i + 1] || "";
    };
    if (!info.sampleName && (low.startsWith("sample:") || low.includes("sample name") || low.startsWith("probe:"))) {
      const v = tailOf(low.includes("sample name") ? "sample name" : low.startsWith("probe:") ? "probe:" : "sample:");
      if (v && v.length < 120) info.sampleName = v.trim();
    }
    if (info.sampleMass == null && (low.includes("sample mass") || low.includes("sample weight") || low.includes("einwaage"))) {
      const key = low.includes("sample mass") ? "sample mass" : low.includes("sample weight") ? "sample weight" : "einwaage";
      const v = valueFromText(tailOf(key));
      if (v) { info.sampleMass = v.value; info.sampleMassUnit = v.unit ?? "g"; }
    }
    if (!info.analysisDate && (low.includes("analysis date") || low.includes("completed:") || low.includes("started:") || low.includes("messdatum"))) {
      const key = low.includes("analysis date") ? "analysis date"
        : low.includes("messdatum") ? "messdatum"
          : low.includes("completed:") ? "completed:" : "started:";
      const v = tailOf(key);
      if (v && v.length < 60) info.analysisDate = v.trim();
    }
  }
  return info;
}

/** Gerät/Hersteller nur als Import-Metadatum – nie als Ergebnisparameter. */
export function detectInstrument(lines: string[]): { vendor: string | null; instrument: string | null } {
  // Dateipfade enthalten oft den Gerätenamen – sie sind aber keine Gerätebezeichnung.
  const isPath = (l: string) => /[\\/]/.test(l) || /\.(smp|rep|emf|txt|xlsx?)\b/i.test(l);
  for (const l of lines) {
    if (isPath(l)) continue;
    const low = l.toLowerCase();
    const hint = VENDOR_HINTS.find((v) => low.includes(v));
    if (hint) {
      return {
        vendor: hint.replace(/\b\w/g, (c) => c.toUpperCase()),
        instrument: l.trim().slice(0, 80),
      };
    }

    const m = l.match(/^\s*(instrument|ger[aä]t|analyzer)\s*[:=]\s*(.+)$/i);
    if (m) return { vendor: null, instrument: m[2].trim().slice(0, 80) };
  }
  return { vendor: null, instrument: null };
}

/* ---------------------------------------------------------------- */
/* Parameter-Erkennung                                               */
/* ---------------------------------------------------------------- */

interface Found {
  normalizedName: string;
  analysis: AnalysisType;
  aliases: string[];
  sourceName: string;
  value: number;
  unit: string | null;
  confidence: Confidence;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function matchKnown(low: string): { def: GasSorptionParameterDef; pattern: string } | null {
  const hit = GAS_SORPTION_PATTERNS.find((p) => low.includes(p.pattern));
  return hit ? { def: hit.def, pattern: hit.pattern } : null;
}

/**
 * Generische Zeile „Bezeichnung: Wert Einheit“. So bleiben auch Parameter
 * erhalten, die der Katalog (noch) nicht kennt – sie dürfen nicht verloren gehen.
 */
function genericReading(line: string): { name: string; value: number; unit: string | null } | null {
  const m = line.match(/^\s*([^:=]{2,70}?)\s*[:=]\s*([+-]?\d[\d.,]*(?:[eE][+-]?\d+)?)\s*([^\s;,]{0,12})\s*$/);
  if (!m) return null;
  if (!/[a-zA-ZäöüÄÖÜ]/.test(m[1])) return null;
  const value = toNumber(m[2]);
  if (value == null) return null;
  const tailUnit = m[3] && /[a-zA-Z²³/·%°]/.test(m[3]) ? m[3] : null;
  // Einheit darf niemals Teil des Parameternamens bleiben.
  const split = splitNameUnit(m[1]);
  return { name: split.name, value, unit: tailUnit ?? split.unit };
}

function findResults(
  lines: string[],
  buffer: ArrayBuffer,
  offsets: number[] | null
): { found: Found[]; unrecognized: string[] } {
  const found: Found[] = [];
  const unrecognized: string[] = [];
  const taken = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const low = text.toLowerCase();
    const known = matchKnown(low);

    if (known) {
      if (taken.has(known.def.normalizedName)) continue;
      const idx = low.indexOf(known.pattern);
      const tail = text.slice(idx + known.pattern.length);

      let hit = valueFromText(tail);
      let confidence: Confidence = "high";
      if (!hit) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const cand = valueFromText(lines[j]);
          if (cand && /^[\s:=]*[+-]?[\d.,]/.test(lines[j])) { hit = cand; confidence = "medium"; break; }
        }
      }
      if (!hit && offsets) {
        const from = offsets[i] + text.length;
        const doubles = scanDoubles(buffer, from, from + 256);
        if (doubles.length > 0) { hit = { value: doubles[0].value, unit: null }; confidence = "low"; }
      }
      if (!hit) { unrecognized.push(text.slice(0, 120)); continue; }

      const rawName = text.slice(idx, idx + known.pattern.length);
      const split = splitNameUnit(rawName);
      taken.add(known.def.normalizedName);
      found.push({
        normalizedName: known.def.normalizedName,
        analysis: known.def.analysis,
        aliases: known.def.aliases,
        sourceName: titleCase(split.name || known.def.normalizedName),
        value: hit.value,
        unit: hit.unit ?? split.unit ?? known.def.unit ?? null,
        confidence,
      });
      continue;
    }

    // Unbekannter Parameter: nur übernehmen, wenn er fachlich ein Messwert ist.
    const generic = genericReading(text);
    if (!generic) continue;
    const cls = classifyReading({
      sourceName: generic.name,
      raw: String(generic.value),
      value: generic.value,
      unit: generic.unit,
    });
    if (cls.category !== "measurement") continue;
    const key = `generic:${generic.name.toLowerCase()}`;
    if (taken.has(key)) continue;
    // Ohne bekannte Einheit und ohne Gasadsorptionsbezug bleibt die Zeile Rohtext.
    if (!isKnownUnit(generic.unit) && !CONTENT_MARKERS.some((m) => generic.name.toLowerCase().includes(m))) {
      unrecognized.push(text.slice(0, 120));
      continue;
    }
    taken.add(key);
    found.push({
      normalizedName: key,
      analysis: "UNKNOWN",
      aliases: [generic.name],
      sourceName: generic.name,
      value: generic.value,
      unit: generic.unit,
      confidence: "medium",
    });
  }

  return { found, unrecognized };
}

/* ---------------------------------------------------------------- */
/* Parser                                                            */
/* ---------------------------------------------------------------- */

export function parseGasSorptionFile(file: { name: string; buffer: ArrayBuffer }): ImportedMeasurement {
  const binary = looksBinary(new Uint8Array(file.buffer)) && !SPREADSHEET.includes(ext(file.name));
  const pairLines = binary ? micromeriticsPairLines(file.buffer) : [];
  const structured = pairLines.length >= 3;
  const extracted = binary && !structured ? extractStrings(file.buffer, 3) : null;
  const lines = structured
    ? [...pairLines, ...extractStrings(file.buffer, 3).map((s) => s.text)]
    : extracted
      ? extracted.map((s) => s.text)
      : extractLines(file);
  // Der spekulative Double-Scan entfällt, sobald echte Label/Wert-Paare vorliegen.
  const offsets = extracted ? extracted.map((s) => s.offset) : null;


  const { found, unrecognized } = findResults(lines, file.buffer, offsets);
  const warnings: string[] = [];

  // Messdatei (.SMP) ist die primäre Quelle: Bedingungen, Einwaage und – sofern
  // vorhanden – Isothermen-Rohdaten werden immer aus ihr gelesen.
  const smp = binary || ext(file.name) === ".smp" ? extractSmp(file.buffer, lines) : null;
  const isotherm = smp?.isotherm.length ? smp.isotherm : readIsothermPoints(lines);
  const dataset = isothermDataset(isotherm);

  if (found.length === 0) {
    warnings.push(
      ext(file.name) === ".smp"
        ? "In dieser Messdatei (.SMP) sind keine bereits ausgewerteten Kennwerte (z. B. BET-Oberfläche, Porenvolumen) enthalten – " +
          "übernommen wurden Probenangaben und Analysebedingungen" +
          (dataset ? " sowie die Isothermen-Rohdaten" : "") +
          ". Ausgewertete Kennwerte können optional aus einer zugehörigen Reportdatei (.REP) ergänzt werden."
        : "In dieser Datei konnten keine Gasadsorptions-Ergebnisparameter erkannt werden. " +
          "Bitte prüfen, ob es sich um eine gültige Datei einer Gasadsorptionsmessung handelt."
    );
  }

  if (found.some((f) => f.confidence === "low")) {
    warnings.push("Einzelne Werte konnten nur unsicher gelesen werden und sind nicht vorausgewählt.");
  }

  const byAnalysis = new Map<AnalysisType, ImportedAnalysis>();
  for (const f of found) {
    const a = byAnalysis.get(f.analysis) ?? { type: f.analysis, results: [], series: [] };
    const r: ImportedResult = {
      sourceName: f.sourceName,
      normalizedName: f.normalizedName,
      aliases: f.aliases,
      value: f.value,
      unit: f.unit,
      confidence: f.confidence,
      analysis: f.analysis,
    };
    a.results.push(r);
    byAnalysis.set(f.analysis, a);
  }

  const instrument = detectInstrument(lines);
  const info = sampleInfo(lines);
  if (info.sampleMass == null && smp?.sampleMass != null) {
    info.sampleMass = smp.sampleMass;
    info.sampleMassUnit = info.sampleMassUnit ?? "g";
  }

  const header: Record<string, string> = { ...(smp?.header ?? {}) };
  if (instrument.instrument) header["Gerät"] = instrument.instrument;
  if (instrument.vendor) header["Hersteller"] = instrument.vendor;
  if (info.sampleName) header["Probe"] = info.sampleName;
  if (info.analysisDate) header["Analysedatum"] = info.analysisDate;

  return {
    source: instrument.vendor ?? "Gasadsorption",
    instrumentFamily: instrument.instrument ?? "",
    sourceFileName: file.name,
    parserVersion: GAS_SORPTION_PARSER_VERSION,
    sampleInformation: info,
    analyses: [...byAnalysis.values()],
    warnings,
    unrecognized: unrecognized.slice(0, 50),
    dataset,
    headerMap: Object.keys(header).length > 0 ? header : undefined,
  };
}

export const gasSorptionImporter: FileImporter = {
  id: GAS_SORPTION_IMPORTER_ID,
  label: "Gasadsorption",
  extensions: EXTENSIONS,
  detect: detectGasSorption,
  parse: parseGasSorptionFile,
};
