import { parseGasInOut } from "@/lib/elementKeys";
import { parseStructuredText } from "@/lib/results/structuredValues";
import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";

/**
 * Aktivitätsmessung (NOx): Darstellung aus dem gespeicherten Aktivitätsmessblock.
 *
 * Reine Anzeige – an den Daten ändert sich nichts. Erkennung ausschließlich über die STRUKTUR des Blocks
 * (kein Messartname, keine festen Feldnamen mit Nummern wie `temperatur_11`):
 *  - jeder Eintrag des Blocks = ein Katalysator (Titel `kat_nr`),
 *  - Messbedingungen = Objekt/Liste mit `*_anlage`-Werten und `frfeucht` (üblicherweise `gas_einstellungen`),
 *  - Ergebnisse = Liste mit einer Zeile je Temperatur (Schlüssel `temperatur…`, `eta…`, `k_wert…`, `<gas>_in/out`).
 * Erkennt die Struktur nichts, bleibt es bei der allgemeinen Darstellung (Rückgabe null).
 */

export type ActivityGas = "NO" | "NH3" | "NO2" | "N2O" | "CO" | "CO2";
/** Reihenfolge der Gasspalten in der Temperaturtabelle. */
export const ACTIVITY_GAS_ORDER: ActivityGas[] = ["NO", "NH3", "NO2", "N2O", "CO", "CO2"];
/** Feste Einheiten der Gase (nicht gespeichert, laut Vorgabe fest). */
export const ACTIVITY_GAS_UNIT: Record<ActivityGas, string> = {
  NO: "ppm", NH3: "ppm", NO2: "ppm", N2O: "ppm", CO: "ppm", CO2: "%",
};

export type ActivityValue = number | string | null;

export interface ActivityConditions {
  av: ActivityValue;
  fr: ActivityValue;
  no: ActivityValue;
  nh3: ActivityValue;
  h2o: ActivityValue;
  o2: ActivityValue;
}
export interface ActivityRow {
  temperature: ActivityValue;
  eta: ActivityValue;
  k: ActivityValue;
  gases: Partial<Record<ActivityGas, { in: ActivityValue; out: ActivityValue }>>;
}
export interface ActivityCatalyst {
  /** `kat_nr`, sonst Bezeichnung des Eintrags, sonst null. */
  title: string | null;
  conditions: ActivityConditions;
  rows: ActivityRow[];
  /** Nur Gase, die in mindestens einer Zeile einen Wert haben (CO/CO₂ entfallen sonst). */
  gasColumns: ActivityGas[];
}
export interface ActivityView {
  /** true nur, wenn alle beteiligten Blöcke offiziell sind. */
  official: boolean;
  catalysts: ActivityCatalyst[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const asValue = (v: unknown): ActivityValue => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t.replace(",", "."));
    return /^[-+]?\d+(?:[.,]\d+)?$/.test(t) && Number.isFinite(n) ? n : t;
  }
  return null;
};

const keysOf = (o: Obj) => Object.keys(o).filter((k) => !k.startsWith("__"));
const findKey = (o: Obj, re: RegExp): string | undefined => keysOf(o).find((k) => re.test(k));
const firstValue = (o: Obj, ...res: RegExp[]): ActivityValue => {
  for (const re of res) {
    for (const k of keysOf(o)) if (re.test(k)) {
      const v = asValue(o[k]);
      if (v !== null) return v;
    }
  }
  return null;
};

const CONDITION_KEY = /(_anlage$|^fr_?feucht$)/i;
const TEMP_KEY = /^temperatur/i;
const isRowsList = (arr: unknown[]): arr is Obj[] =>
  arr.length > 0 && arr.every(isObj) &&
  (arr as Obj[]).some((o) => keysOf(o).some((k) => TEMP_KEY.test(k)) &&
    keysOf(o).some((k) => /^eta/i.test(k) || parseGasInOut(k) !== null));

function gasOf(key: string): { gas: ActivityGas; dir: "in" | "out" } | null {
  const g = parseGasInOut(key);
  if (!g) return null;
  return (ACTIVITY_GAS_ORDER as string[]).includes(g.gas) ? { gas: g.gas as ActivityGas, dir: g.dir } : null;
}

function buildRow(o: Obj): ActivityRow | null {
  const tKey = findKey(o, TEMP_KEY);
  const gases: ActivityRow["gases"] = {};
  for (const k of keysOf(o)) {
    const g = gasOf(k);
    if (!g) continue;
    const v = asValue(o[k]);
    const cell = (gases[g.gas] ??= { in: null, out: null });
    if (cell[g.dir] === null) cell[g.dir] = v;
  }
  const row: ActivityRow = {
    temperature: tKey ? asValue(o[tKey]) : null,
    eta: firstValue(o, /^eta/i),
    // Der gespeicherte K-Wert ist die Kopie (`k_wert_kopie`); sonst der berechnete `k_wert`.
    k: firstValue(o, /^k_wert_kopie$/i, /^k_wert$/i, /^k_?wert/i),
    gases,
  };
  const hasGas = Object.values(gases).some((c) => c && (c.in !== null || c.out !== null));
  return row.temperature !== null || row.eta !== null || row.k !== null || hasGas ? row : null;
}

function buildCatalyst(entry: Obj): ActivityCatalyst | null {
  let conditionsObj: Obj | null = null;
  let rows: Obj[] = [];
  for (const k of keysOf(entry)) {
    const v = entry[k];
    const candidates: unknown[] = Array.isArray(v) ? v : [v];
    if (Array.isArray(v) && isRowsList(v)) { rows = rows.concat(v); continue; }
    for (const c of candidates) {
      if (isObj(c) && !conditionsObj && keysOf(c).some((kk) => CONDITION_KEY.test(kk))) conditionsObj = c;
    }
  }
  const built = rows.map(buildRow).filter((r): r is ActivityRow => r !== null);
  built.sort((a, b) => (typeof a.temperature === "number" && typeof b.temperature === "number" ? a.temperature - b.temperature : 0));
  if (built.length === 0 && !conditionsObj) return null;
  const c = conditionsObj ?? {};
  const av = rows.map((r) => firstValue(r, /^av/i)).find((v) => v !== null) ?? firstValue(c, /^av/i);
  const conditions: ActivityConditions = {
    av: av ?? null,
    fr: firstValue(c, /^fr_?feucht$/i),
    no: firstValue(c, /^no_anlage$/i),
    nh3: firstValue(c, /^nh3_anlage$/i),
    h2o: firstValue(c, /^h2o_anlage$/i),
    o2: firstValue(c, /^o2_anlage$/i),
  };
  const gasColumns = ACTIVITY_GAS_ORDER.filter((g) => built.some((r) => r.gases[g] && (r.gases[g]!.in !== null || r.gases[g]!.out !== null)));
  // kat_nr unverändert als Text (führende Nullen, Kommas bleiben erhalten).
  const katKey = findKey(c, /^kat_?nr$/i);
  const katNr = katKey && String(c[katKey] ?? "").trim() !== "" ? String(c[katKey]).trim() : null;
  const label = typeof entry.__label === "string" && entry.__label.trim() ? entry.__label.trim() : null;
  return { title: katNr ?? label, conditions, rows: built, gasColumns };
}

/** Katalysatoren eines einzelnen Blockergebnisses; null, wenn der Wert kein Aktivitätsmessblock ist. */
export function parseActivityBlock(r: Pick<SampleResultValue, "value" | "remarks">): ActivityCatalyst[] | null {
  if (r.value !== null && r.value !== undefined) return null;
  const parsed = parseStructuredText(r.remarks);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isObj)) return null;
  const catalysts = (parsed as Obj[]).map(buildCatalyst).filter((c): c is ActivityCatalyst => c !== null && c.rows.length > 0);
  return catalysts.length > 0 ? catalysts : null;
}

export const isActivityBlockResult = (r: Pick<SampleResultValue, "value" | "remarks">): boolean =>
  parseActivityBlock(r) !== null;

/** Trennt die Aktivitätsmessblöcke von den übrigen Ergebnissen (nichts geht verloren). */
export function extractActivity<T extends SampleResultValue>(results: T[]): { view: ActivityView | null; rest: T[] } {
  const catalysts: ActivityCatalyst[] = [];
  const rest: T[] = [];
  let official = true;
  for (const r of results) {
    const c = parseActivityBlock(r);
    if (c) {
      catalysts.push(...c);
      if (r.is_official !== true) official = false;
    } else rest.push(r);
  }
  return { view: catalysts.length ? { official, catalysts } : null, rest };
}
