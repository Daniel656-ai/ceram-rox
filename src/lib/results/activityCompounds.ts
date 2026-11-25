/**
 * Verbindungen (Gase) der Aktivitätsmessung – dynamisch aus dem Formular statt fester Liste.
 * ==========================================================================================
 *
 * Die Verbindung wird aus der BESCHRIFTUNG (`display_label`) bestimmt, nicht aus dem Schlüssel:
 * `co_2` heißt „CO (2)“ und ist CO (nicht CO₂), `no_2` heißt „NO (2)“ und ist NO (nicht NO₂).
 * Ein Verwendungszusatz im Label („ 1“, „ 2“, „(2)“) ist die Nummer der Verwendung, kein Teil der Formel.
 * Nur wenn ein Ergebnis gar keine Beschriftung hat, wird ersatzweise der Schlüssel gelesen.
 *
 * Gase und Bedingungen müssen die Einheit ppm oder % haben – Dosiermengen (Nml, g, Nl, Nml/min) und
 * alle anderen Felder zählen nie als Verbindung.
 */
import { formatElementKey } from "@/lib/elementKeys";

/** Klartextnamen (Kleinschreibung) -> Formel. Nur, wenn das Formular den Namen statt der Formel nutzt. */
const NAMES: Record<string, string> = {
  propan: "C3H8", propane: "C3H8", ethen: "C2H4", ethene: "C2H4", ethylen: "C2H4", methan: "CH4",
  ethan: "C2H6", propen: "C3H6", propylen: "C3H6", ammoniak: "NH3", wasser: "H2O", sauerstoff: "O2",
  stickstoff: "N2", wasserstoff: "H2",
};
/** Schlüsselfallback (nur ohne Beschriftung): Kleinschreibung -> Formel. */
const KEY_FORMULAS: Record<string, string> = {
  no: "NO", no2: "NO2", n2o: "N2O", nh3: "NH3", co: "CO", co2: "CO2", h2o: "H2O", o2: "O2", n2: "N2", so2: "SO2",
  so3: "SO3", h2: "H2", ch4: "CH4", c2h4: "C2H4", c2h6: "C2H6", c3h6: "C3H6", c3h8: "C3H8", hcl: "HCl",
};

const FORMULA = /^(?:[A-Z][a-z]?\d*)+$/;
const NOT_COMPOUND = new Set(["AV", "FR", "SV", "AP", "DS", "RT", "GHSV", "LHSV"]);
const UNIT = /^\s*(ppm|%|vol\.?\s*-?\s*%)\s*$/i;

/** Einheit eines Gases/einer Eingangsbedingung: ppm oder %. */
export const isGasUnit = (unit: string | null | undefined): boolean => UNIT.test(unit ?? "");

/** „ppm“ oder „%“ (andere Schreibweisen von Prozent werden zu „%“); sonst ppm. */
export const normalizeGasUnit = (unit: string | null | undefined): string => (/%/.test(unit ?? "") ? "%" : "ppm");

export interface CompoundRef {
  /** Formel in Klartext, z. B. „C2H4“. */
  compound: string;
  /** Richtung aus der Beschriftung („In“/„Out“), sonst null. */
  dir: "in" | "out" | null;
  /** Nummer der Verwendung aus der Beschriftung („NO (2)“ -> 2), sonst null. */
  usage: number | null;
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";

function fromLabel(label: string): CompoundRef | null {
  const s = label
    .replace(/[_^]\{([^}]*)\}/g, "$1")
    .replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)));
  const tokens = s.split(/[\s_()\-–/]+/).filter(Boolean);
  let dir: "in" | "out" | null = null;
  let usage: number | null = null;
  const kept: string[] = [];
  for (const t of tokens) {
    const l = t.toLowerCase();
    if (l === "in" || l === "ein") dir = "in";
    else if (l === "out" || l === "aus") dir = "out";
    else if (l === "anzeige" || l === "anlage") continue;
    else if (/^\d+$/.test(t) && kept.length > 0) usage = Number(t);
    else kept.push(t);
  }
  if (kept.length !== 1) return null;
  const word = kept[0];
  const compound = NAMES[word.toLowerCase()] ?? (FORMULA.test(word) && !NOT_COMPOUND.has(word) ? word : null);
  return compound ? { compound, dir, usage } : null;
}

function fromKey(rawKey: string): CompoundRef | null {
  let key = rawKey.toLowerCase();
  let dir: "in" | "out" | null = null;
  const d = key.match(/_(in|out)(?:_\d+)?$/);
  if (d) { dir = d[1] as "in" | "out"; key = key.slice(0, d.index); }
  key = key.replace(/_(anzeige|anlage)$/, "");
  const m = key.match(/^(.*?)(?:_(\d+))?$/);
  const name = m?.[1] ?? key;
  const compound = NAMES[name] ?? KEY_FORMULAS[name];
  return compound ? { compound, dir, usage: m?.[2] ? Number(m[2]) : null } : null;
}

/** Verbindung eines Ergebnisses: aus der Beschriftung, nur ohne Beschriftung ersatzweise aus dem Schlüssel. */
export function compoundRef(label: string | null | undefined, key: string): CompoundRef | null {
  const text = (label ?? "").trim();
  return text ? fromLabel(text) : fromKey(key);
}

/** Schreibweise für die Anzeige: „C2H4“ -> „C₂H₄“. */
export const compoundLabel = (compound: string): string => formatElementKey(compound);

/**
 * Raumgeschwindigkeit SV: Beschriftung besteht nur aus "SV" (+ Verwendungszusatz) und die Einheit ist h^-1 (1/h).
 * Liefert die Nummer der Verwendung (null = ohne Nummer), sonst undefined (kein SV).
 */
export function svUsage(label: string | null | undefined, unit: string | null | undefined): number | null | undefined {
  const u = (unit ?? "").replace(/[\s^{}]/g, "").replace(/⁻¹/g, "-1");
  if (!/^(h-1|1\/h)$/i.test(u)) return undefined;
  const tokens = (label ?? "").replace(/[_^]\{([^}]*)\}/g, "$1").split(/[\s_()\-–/]+/).filter(Boolean);
  const kept = tokens.filter((t) => !/^\d+$/.test(t));
  if (kept.length !== 1 || kept[0].toUpperCase() !== "SV") return undefined;
  const n = tokens.find((t) => /^\d+$/.test(t));
  return n ? Number(n) : null;
}
