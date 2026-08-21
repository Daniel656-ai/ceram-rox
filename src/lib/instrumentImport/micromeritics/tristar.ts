/**
 * Micromeritics TriStar II / TriStar II Plus Importer (.SMP primär, .REP optional).
 *
 * Der Parser arbeitet modular und ohne feste Byte-Positionen:
 *   FileDetector -> TextExtractor -> SampleInformationExtractor
 *                -> AnalysisDetector -> BET/BJH/NLDFT-Parser -> ResultNormalizer
 *
 * Werte werden nur dann als Ergebnis geliefert, wenn eine bekannte
 * Micromeritics-Bezeichnung gefunden wurde. Unbekannte Datenblöcke werden
 * ausschließlich protokolliert, nie geraten.
 */
import { extractStrings, scanDoubles, type ExtractedString } from "../binaryText";
import type {
  AnalysisType, Confidence, FileImporter, ImportedAnalysis,
  ImportedMeasurement, ImportedResult,
} from "../types";

export const TRISTAR_PARSER_VERSION = "1.0.0-bet";

/* ---------------------------------------------------------------- */
/* Bekannte Kennwerte                                                */
/* ---------------------------------------------------------------- */

interface KnownResultDef {
  normalizedName: string;
  analysis: AnalysisType;
  /** Erkennungsmuster in der Gerätedatei (case-insensitive Teilstring). */
  patterns: string[];
  /** Bezeichnungen, unter denen das Zielfeld im ROX-Formular heißen kann. */
  aliases: string[];
  unit?: string | null;
}

const KNOWN: KnownResultDef[] = [
  {
    normalizedName: "bet_surface_area",
    analysis: "BET",
    patterns: ["bet surface area", "single point surface area", "bet-oberfläche"],
    aliases: [
      "Spezifische Oberfläche - BET", "Spezifische Oberfläche – BET", "Spezifische Oberflaeche BET",
      "BET Surface Area", "BET Oberfläche", "spezifische_oberflaeche_bet", "bet_surface_area", "BET",
    ],
    unit: "m²/g",
  },
  {
    normalizedName: "bet_c_constant",
    analysis: "BET",
    patterns: ["c constant", "bet c", "c-constant"],
    aliases: ["BET C-Konstante", "BET C Constant", "C-Konstante", "bet_c", "bet_c_konstante"],
    unit: null,
  },
  {
    normalizedName: "bet_slope",
    analysis: "BET",
    patterns: ["slope"],
    aliases: ["BET Steigung", "Slope", "bet_slope", "Steigung"],
    unit: "g/cm³ STP",
  },
  {
    normalizedName: "bet_intercept",
    analysis: "BET",
    patterns: ["intercept", "y-intercept"],
    aliases: ["BET Achsenabschnitt", "Intercept", "bet_intercept", "Achsenabschnitt"],
    unit: "g/cm³ STP",
  },
  {
    normalizedName: "bet_correlation_coefficient",
    analysis: "BET",
    patterns: ["correlation coefficient", "korrelationskoeffizient"],
    aliases: ["BET Korrelationskoeffizient", "Correlation Coefficient", "bet_r", "Korrelationskoeffizient"],
    unit: null,
  },
  {
    normalizedName: "bet_molecular_cross_section",
    analysis: "BET",
    patterns: ["molecular cross-section", "molecular cross section"],
    aliases: ["Molekülquerschnitt", "Molecular Cross-Sectional Area", "bet_cross_section"],
    unit: "nm²",
  },
  {
    normalizedName: "bjh_ads_cumulative_surface_area",
    analysis: "BJH_ADSORPTION",
    patterns: ["bjh adsorption cumulative surface area"],
    aliases: ["BJH Adsorption kumulierte Oberfläche", "bjh_ads_surface_area"],
    unit: "m²/g",
  },
  {
    normalizedName: "bjh_ads_cumulative_pore_volume",
    analysis: "BJH_ADSORPTION",
    patterns: ["bjh adsorption cumulative volume of pores", "bjh adsorption cumulative pore volume"],
    aliases: ["BJH Adsorption Porenvolumen", "Porenvolumen BJH Adsorption", "bjh_ads_pore_volume"],
    unit: "cm³/g",
  },
  {
    normalizedName: "bjh_ads_average_pore_diameter",
    analysis: "BJH_ADSORPTION",
    patterns: ["bjh adsorption average pore diameter", "bjh adsorption average pore width"],
    aliases: ["BJH Adsorption mittlerer Porendurchmesser", "bjh_ads_pore_diameter"],
    unit: "nm",
  },
  {
    normalizedName: "bjh_des_cumulative_surface_area",
    analysis: "BJH_DESORPTION",
    patterns: ["bjh desorption cumulative surface area"],
    aliases: ["BJH Desorption kumulierte Oberfläche", "bjh_des_surface_area"],
    unit: "m²/g",
  },
  {
    normalizedName: "bjh_des_cumulative_pore_volume",
    analysis: "BJH_DESORPTION",
    patterns: ["bjh desorption cumulative volume of pores", "bjh desorption cumulative pore volume"],
    aliases: ["BJH Desorption Porenvolumen", "Porenvolumen BJH Desorption", "bjh_des_pore_volume"],
    unit: "cm³/g",
  },
  {
    normalizedName: "bjh_des_average_pore_diameter",
    analysis: "BJH_DESORPTION",
    patterns: ["bjh desorption average pore diameter", "bjh desorption average pore width"],
    aliases: ["BJH Desorption mittlerer Porendurchmesser", "bjh_des_pore_diameter"],
    unit: "nm",
  },
  {
    normalizedName: "total_pore_volume",
    analysis: "ISOTHERM",
    patterns: ["single point adsorption total pore volume", "total pore volume of pores"],
    aliases: ["Gesamtporenvolumen", "Total Pore Volume", "total_pore_volume", "Porenvolumen"],
    unit: "cm³/g",
  },
  {
    normalizedName: "average_pore_diameter",
    analysis: "ISOTHERM",
    patterns: ["adsorption average pore diameter", "adsorption average pore width"],
    aliases: ["Mittlerer Porendurchmesser", "Average Pore Diameter", "average_pore_diameter"],
    unit: "nm",
  },
  {
    normalizedName: "nldft_cumulative_pore_volume",
    analysis: "NLDFT",
    patterns: ["dft cumulative pore volume", "nldft cumulative pore volume"],
    aliases: ["NLDFT Porenvolumen", "DFT Porenvolumen", "nldft_pore_volume"],
    unit: "cm³/g",
  },
  {
    normalizedName: "nldft_cumulative_surface_area",
    analysis: "NLDFT",
    patterns: ["dft cumulative surface area", "nldft cumulative surface area"],
    aliases: ["NLDFT Oberfläche", "DFT Oberfläche", "nldft_surface_area"],
    unit: "m²/g",
  },
];

/* ---------------------------------------------------------------- */
/* FileDetector                                                      */
/* ---------------------------------------------------------------- */

const VENDOR_MARKERS = ["micromeritics", "tristar", "asap", "microactive"];

const ext = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();

export function detectTriStar(file: { name: string; buffer: ArrayBuffer }): boolean {
  const e = ext(file.name);
  if (e !== "smp" && e !== "rep") return false;
  const strings = extractStrings(file.buffer, 4);
  const hay = strings.map((s) => s.text.toLowerCase()).join(" ");
  if (VENDOR_MARKERS.some((m) => hay.includes(m))) return true;
  // Endung .SMP/.REP ist bei fehlenden Herstellermarkern immer noch ein starker Hinweis.
  return e === "smp" || e === "rep";
}

/* ---------------------------------------------------------------- */
/* Zahlen                                                            */
/* ---------------------------------------------------------------- */

const NUM_RE = /([+-]?\d(?:[\d.,]*\d)?(?:[eE][+-]?\d+)?)/;

function toNumber(raw: string): number | null {
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
/* SampleInformationExtractor                                        */
/* ---------------------------------------------------------------- */

function sampleInfo(strings: ExtractedString[]) {
  const info: ImportedMeasurement["sampleInformation"] = {};
  for (let i = 0; i < strings.length; i++) {
    const t = strings[i].text;
    const low = t.toLowerCase();
    const tailOf = (label: string) => {
      const idx = low.indexOf(label);
      const inline = t.slice(idx + label.length).replace(/^[\s:=]+/, "");
      return inline || strings[i + 1]?.text || "";
    };
    if (!info.sampleName && (low.startsWith("sample:") || low.includes("sample name"))) {
      const v = tailOf(low.includes("sample name") ? "sample name" : "sample:");
      if (v && v.length < 120) info.sampleName = v.trim();
    }
    if (info.sampleMass == null && (low.includes("sample mass") || low.includes("sample weight"))) {
      const v = valueFromText(tailOf(low.includes("sample mass") ? "sample mass" : "sample weight"));
      if (v) { info.sampleMass = v.value; info.sampleMassUnit = v.unit ?? "g"; }
    }
    if (!info.analysisDate && (low.includes("analysis date") || low.includes("completed:") || low.includes("started:"))) {
      const v = tailOf(low.includes("analysis date") ? "analysis date" : low.includes("completed:") ? "completed:" : "started:");
      if (v && v.length < 60) info.analysisDate = v.trim();
    }
  }
  return info;
}

/* ---------------------------------------------------------------- */
/* Result-Extraktion                                                 */
/* ---------------------------------------------------------------- */

interface Found { def: KnownResultDef; sourceName: string; value: number; unit: string | null; confidence: Confidence }

function findResults(strings: ExtractedString[], buffer: ArrayBuffer): { found: Found[]; unrecognized: string[] } {
  const found: Found[] = [];
  const unrecognized: string[] = [];
  const taken = new Set<string>();

  for (let i = 0; i < strings.length; i++) {
    const s = strings[i];
    const low = s.text.toLowerCase();
    const def = KNOWN.find((d) => d.patterns.some((p) => low.includes(p)));
    if (!def || taken.has(def.normalizedName)) continue;

    const pattern = def.patterns.find((p) => low.includes(p))!;
    const idx = low.indexOf(pattern);
    const tail = s.text.slice(idx + pattern.length);

    // 1) Wert steht in derselben Zeichenkette -> hohe Konfidenz
    let hit = valueFromText(tail);
    let confidence: Confidence = "high";

    // 2) Wert in einer der nächsten Zeichenketten -> mittlere Konfidenz
    if (!hit) {
      for (let j = i + 1; j < Math.min(i + 4, strings.length); j++) {
        const cand = valueFromText(strings[j].text);
        if (cand && /^[\s:=]*[+-]?[\d.,]/.test(strings[j].text)) { hit = cand; confidence = "medium"; break; }
      }
    }

    // 3) Binärer Zahlenblock in der Nähe der Bezeichnung -> geringe Konfidenz
    if (!hit) {
      const doubles = scanDoubles(buffer, s.offset + s.text.length, s.offset + s.text.length + 256);
      if (doubles.length > 0) { hit = { value: doubles[0].value, unit: null }; confidence = "low"; }
    }

    if (!hit) { unrecognized.push(s.text.slice(0, 120)); continue; }

    taken.add(def.normalizedName);
    found.push({
      def,
      sourceName: s.text.slice(idx, idx + pattern.length + 0) || def.normalizedName,
      value: hit.value,
      unit: hit.unit ?? def.unit ?? null,
      confidence,
    });
  }
  return { found, unrecognized };
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/* ---------------------------------------------------------------- */
/* Parser                                                            */
/* ---------------------------------------------------------------- */

export function parseTriStarFile(file: { name: string; buffer: ArrayBuffer }): ImportedMeasurement {
  const strings = extractStrings(file.buffer, 3);
  const { found, unrecognized } = findResults(strings, file.buffer);
  const warnings: string[] = [];

  if (found.length === 0) {
    warnings.push(
      "In dieser Datei konnten keine bekannten Micromeritics-Kennwerte erkannt werden. " +
      "Bitte prüfen, ob es sich um eine TriStar-II-Messdatei handelt."
    );
  }

  const byAnalysis = new Map<AnalysisType, ImportedAnalysis>();
  for (const f of found) {
    const a = byAnalysis.get(f.def.analysis) ?? { type: f.def.analysis, results: [], series: [] };
    const r: ImportedResult = {
      sourceName: titleCase(f.sourceName),
      normalizedName: f.def.normalizedName,
      aliases: f.def.aliases,
      value: f.value,
      unit: f.unit,
      confidence: f.confidence,
      analysis: f.def.analysis,
    };
    a.results.push(r);
    byAnalysis.set(f.def.analysis, a);
  }

  if (found.some((f) => f.confidence === "low")) {
    warnings.push("Einzelne Werte konnten nur unsicher gelesen werden und sind nicht vorausgewählt.");
  }

  return {
    source: "Micromeritics",
    instrumentFamily: "TriStar",
    sourceFileName: file.name,
    parserVersion: TRISTAR_PARSER_VERSION,
    sampleInformation: sampleInfo(strings),
    analyses: [...byAnalysis.values()],
    warnings,
    unrecognized: unrecognized.slice(0, 50),
  };
}

export const tristarImporter: FileImporter = {
  id: "micromeritics_tristar",
  label: "Micromeritics TriStar II",
  extensions: [".smp", ".rep"],
  detect: detectTriStar,
  parse: parseTriStarFile,
};
