import { formatGasInOut, parseGasInOut } from "@/lib/elementKeys";
import { cleanUnmappableMarkup, toUnicode } from "@/lib/richText";
import { humanizeKey, parseStructuredText } from "@/lib/results/structuredValues";
import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";
import { compoundLabel, compoundRef, isGasUnit, normalizeGasUnit } from "@/lib/results/activityCompounds";
import { parseTemperatureList, stepOfInstance, temperatureOf, temperatureRowInstance } from "@/lib/results/temperatureBlock";

/**
 * Aktivitätsmessung (NOx): EINE Darstellung für alle Formularbefüllungen (siehe tasks/014).
 *
 * Reine Anzeige – an den Daten ändert sich nichts. Es gibt drei Bauarten desselben Formulars:
 *  A) Block:   `aktivitatsmessblock` mit `gas_einstellungen` (Messbedingungen) und einer Liste je Temperatur.
 *              Jeder Eintrag = ein Katalysator (Titel `kat_nr`).
 *  B) flach:   Einzelfelder je Temperaturstufe n: `temperatur_n`, `eta_nox`/`eta_nox_kopie`/`eta_nox_kopie_kopie`
 *              (Stufe 1/2/3), K-Wert-Kette, `<gas>_in_n` / `<gas>_out_n`.
 *  C) alt:     wie B, dazu Bedingungen als Einzelfelder (`no`, `no_2`, `nh3_1`, `nh3_2`, `h2o`, `o2`, `co`, …).
 * Die Erkennung läuft über die STRUKTUR (Feldschlüssel nach Mustern), nie über den Messartnamen.
 * Einzelfelder werden dem Katalysator mit derselben Nummer zugeordnet (…_av1 / av_1 / _kopie = 2 → Katalysator /2).
 * Was sich nirgends zuordnen lässt, steht klein unter „Weitere Angaben“ (nichts geht verloren).
 */

/** Formel einer Verbindung ("NO", "C2H4" ...): bekannte Gase fest, weitere dynamisch aus dem Formular. */
export type ActivityGas = string;
/** Reihenfolge der BEKANNTEN Gasspalten in der Temperaturtabelle; weitere Verbindungen kommen dahinter. */
export const ACTIVITY_GAS_ORDER: ActivityGas[] = ["NO", "NH3", "NO2", "N2O", "CO", "CO2"];
/** Einheiten der bekannten Gase; weitere Verbindungen tragen die Einheit aus dem Formular (gasUnits). */
export const ACTIVITY_GAS_UNIT: Record<string, string> = {
  NO: "ppm", NH3: "ppm", NO2: "ppm", N2O: "ppm", CO: "ppm", CO2: "%",
};
/** Einheit einer Gasspalte: bekanntes Gas fest, sonst aus dem Formular, sonst ppm. */
export const gasUnitOf = (cat: { gasUnits?: Record<string, string> }, gas: ActivityGas): string =>
  ACTIVITY_GAS_UNIT[gas] ?? cat.gasUnits?.[gas] ?? "ppm";

export type ActivityValue = number | string | null;

export interface ActivityConditions {
  av: ActivityValue;
  fr: ActivityValue;
  no: ActivityValue;
  nh3: ActivityValue;
  h2o: ActivityValue;
  o2: ActivityValue;
  /** Weitere Eingangsgase mit Wert (z. B. CO, SO2, C2H4), in der Reihenfolge ihres Auftretens. */
  extra: ActivityExtraCondition[];
}
export interface ActivityExtraCondition {
  compound: string;
  value: ActivityValue;
  unit: string;
}
export interface ActivityRow {
  temperature: ActivityValue;
  /** Vorgabe laut Auftrag (Temperaturblock), nur gesetzt, wenn sie vom gemessenen `temperature` abweicht. */
  temperatureTarget?: ActivityValue;
  eta: ActivityValue;
  k: ActivityValue;
  gases: Partial<Record<ActivityGas, { in: ActivityValue; out: ActivityValue }>>;
}
/** Ein beschrifteter Wert (Probendaten bzw. Weitere Angaben). */
export interface ActivityField {
  label: string;
  value: ActivityValue;
  unit: string | null;
}
export interface ActivityCatalyst {
  /** Nummer des Katalysators (1, 2, …) – aus `kat_nr` (/n), Feldnamen oder Position. */
  index: number;
  /** Echte Katalysatornummer (`kat_nr`, z. B. FG26_0330/1); sonst null. */
  title: string | null;
  /** Probendaten: Test-Nr, Kanalgröße, Wandstärke, Länge, Kanäle, Zellenzahl – was vorhanden ist. */
  sampleData: ActivityField[];
  conditions: ActivityConditions;
  rows: ActivityRow[];
  /** Nur Gase, die in mindestens einer Zeile einen Wert haben (CO/CO₂ entfallen sonst). */
  gasColumns: ActivityGas[];
  /** Einheiten weiterer (nicht fest bekannter) Gase aus dem Formular. */
  gasUnits?: Record<string, string>;
}
export interface ActivityView {
  /** true nur, wenn alle beteiligten Werte offiziell sind. */
  official: boolean;
  catalysts: ActivityCatalyst[];
  /** Weitere Angaben: alles, was keinem Katalysator/keiner Tabelle zugeordnet werden konnte. */
  other: ActivityField[];
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

/** Messart „Aktivitätsmessung“: wird IMMER in dieser Ansicht dargestellt, auch wenn die Struktur nicht passt. */
export const isActivityService = (name: string | null | undefined): boolean => /aktivit(ä|ae)t/i.test(name ?? "");

/** Anzeigetext einer Beschriftung: Auszeichnungen lesbar, Gasnamen korrekt (NO₂ in), nie Rohmarkup. */
export function activityLabel(raw: string): string {
  const t = raw.trim();
  return toUnicode(cleanUnmappableMarkup(formatGasInOut(t) ?? t));
}

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

function gasOf(key: string): { gas: ActivityGas; dir: "in" | "out"; index: number } | null {
  const g = parseGasInOut(key);
  if (!g) return null;
  return (ACTIVITY_GAS_ORDER as string[]).includes(g.gas)
    ? { gas: g.gas as ActivityGas, dir: g.dir, index: g.index ? Number(g.index) : 1 }
    : null;
}

const emptyConditions = (): ActivityConditions => ({ av: null, fr: null, no: null, nh3: null, h2o: null, o2: null, extra: [] });

/* ------------------------------------------------------------------ */
/* Variante A: Aktivitätsmessblock                                     */
/* ------------------------------------------------------------------ */

const CONDITION_KEY = /(_anlage$|^fr_?feucht$)/i;
const TEMP_KEY = /^temperatur/i;
const isRowsList = (arr: unknown[]): arr is Obj[] =>
  arr.length > 0 && arr.every(isObj) &&
  (arr as Obj[]).some((o) => keysOf(o).some((k) => TEMP_KEY.test(k)) &&
    keysOf(o).some((k) => /^eta/i.test(k) || parseGasInOut(k) !== null));

/** Felder einer Block-Zeile, die in der Temperaturtabelle stehen (alles andere = Weitere Angaben). */
const isRowConsumed = (k: string) =>
  TEMP_KEY.test(k) || /^eta/i.test(k) || /^k_?wert/i.test(k) || /^av/i.test(k) || gasOf(k) !== null;
/** Reine Umrechnungsfaktoren der Dosierung – keine Messwerte. */
const isConversionKey = (k: string) => /umrechnung/i.test(k) || /^(fr_?trocken)$/i.test(k);

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

const sortRows = (rows: ActivityRow[]) =>
  rows.sort((a, b) => (typeof a.temperature === "number" && typeof b.temperature === "number" ? a.temperature - b.temperature : 0));

const gasColumnsOf = (rows: ActivityRow[]): ActivityGas[] => {
  const has = (g: ActivityGas) => rows.some((r) => r.gases[g] && (r.gases[g]!.in !== null || r.gases[g]!.out !== null));
  const known = ACTIVITY_GAS_ORDER.filter(has);
  // Weitere Verbindungen dahinter, in der Reihenfolge ihres Auftretens.
  const more: ActivityGas[] = [];
  for (const r of rows) for (const g of Object.keys(r.gases)) if (!ACTIVITY_GAS_ORDER.includes(g) && !more.includes(g) && has(g)) more.push(g);
  return [...known, ...more];
};

function buildCatalyst(entry: Obj, position: number): { cat: ActivityCatalyst; extras: ActivityField[] } | null {
  let conditionsObj: Obj | null = null;
  let rows: Obj[] = [];
  const entryExtras: ActivityField[] = [];
  for (const k of keysOf(entry)) {
    const v = entry[k];
    if (Array.isArray(v) && isRowsList(v)) { rows = rows.concat(v); continue; }
    const candidates: unknown[] = Array.isArray(v) ? v : [v];
    let isConditions = false;
    for (const c of candidates) {
      if (isObj(c) && !conditionsObj && keysOf(c).some((kk) => CONDITION_KEY.test(kk))) { conditionsObj = c; isConditions = true; }
    }
    if (!isConditions && !Array.isArray(v) && !isObj(v)) {
      const val = asValue(v);
      if (val !== null) entryExtras.push({ label: activityLabel(humanizeKey(k)), value: val, unit: null });
    }
  }
  const built = sortRows(rows.map(buildRow).filter((r): r is ActivityRow => r !== null));
  if (built.length === 0) return null;
  const c = conditionsObj ?? {};
  const av = rows.map((r) => firstValue(r, /^av/i)).find((v) => v !== null) ?? firstValue(c, /^av/i);
  const conditions: ActivityConditions = {
    av: av ?? null,
    fr: firstValue(c, /^fr_?feucht$/i),
    no: firstValue(c, /^no_anlage$/i),
    nh3: firstValue(c, /^nh3_anlage$/i),
    h2o: firstValue(c, /^h2o_anlage$/i),
    o2: firstValue(c, /^o2_anlage$/i),
    extra: [],
  };
  // kat_nr unverändert als Text (führende Nullen, Kommas bleiben erhalten).
  const katKey = findKey(c, /^kat_?nr$/i);
  const katNr = katKey && String(c[katKey] ?? "").trim() !== "" ? String(c[katKey]).trim() : null;
  const title = katNr;
  const slash = title ? title.match(/\/(\d+)\s*$/) : null;
  const cat: ActivityCatalyst = {
    index: slash ? Number(slash[1]) : position,
    title, sampleData: [], conditions, rows: built, gasColumns: gasColumnsOf(built),
  };

  // Nicht zugeordnete Felder des Katalysators (nur Werte; Umrechnungsfaktoren der Dosierung sind keine Messwerte).
  const extras: ActivityField[] = [...entryExtras];
  for (const k of keysOf(c)) {
    if (CONDITION_KEY.test(k) && !/^kat/i.test(k) || /^kat_?nr$/i.test(k) || isConversionKey(k)) continue;
    const val = asValue(c[k]);
    if (val !== null) extras.push({ label: activityLabel(humanizeKey(k)), value: val, unit: null });
  }
  for (const r of rows) {
    const t = firstValue(r, TEMP_KEY);
    for (const k of keysOf(r)) {
      if (isRowConsumed(k)) continue;
      const val = asValue(r[k]);
      if (val !== null) extras.push({ label: activityLabel(humanizeKey(k)) + (t !== null ? ` (${t} °C)` : ""), value: val, unit: null });
    }
  }
  const prefix = cat.title ? `${cat.title} · ` : "";
  return { cat, extras: extras.map((e) => ({ ...e, label: prefix + e.label })) };
}

/** Katalysatoren eines einzelnen Blockergebnisses; null, wenn der Wert kein Aktivitätsmessblock ist. */
function parseBlock(r: Pick<SampleResultValue, "value" | "remarks">): { cats: ActivityCatalyst[]; extras: ActivityField[] } | null {
  if (r.value !== null && r.value !== undefined) return null;
  const parsed = parseStructuredText(r.remarks);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isObj)) return null;
  const built = (parsed as Obj[]).map((e, i) => buildCatalyst(e, i + 1)).filter((x): x is NonNullable<typeof x> => x !== null);
  return built.length ? { cats: built.map((b) => b.cat), extras: built.flatMap((b) => b.extras) } : null;
}

export function parseActivityBlock(r: Pick<SampleResultValue, "value" | "remarks">): ActivityCatalyst[] | null {
  return parseBlock(r)?.cats ?? null;
}

export const isActivityBlockResult = (r: Pick<SampleResultValue, "value" | "remarks">): boolean =>
  parseBlock(r) !== null;

/* ------------------------------------------------------------------ */
/* Einzelfelder (Varianten B/C und Ergänzung zu A)                     */
/* ------------------------------------------------------------------ */

const resultKey = (r: Pick<SampleResultValue, "result_name">): string =>
  r.result_name.startsWith("form:") ? r.result_name.slice(r.result_name.indexOf(":", 5) + 1) : r.result_name;

type SampleKind = "test" | "d" | "ti" | "l" | "channels" | "cells";
type CondKind = "av" | "fr" | "no" | "nh3" | "h2o" | "o2";
type Flat =
  | { kind: "sample"; field: SampleKind; idx: number | null }
  | { kind: "cond"; field: CondKind; idx: number | null }
  | { kind: "step"; field: "temp" | "eta" | "k"; step: number }
  | { kind: "gas"; gas: ActivityGas; dir: "in" | "out"; step: number };

const SAMPLE_LABEL: Record<SampleKind, string> = {
  test: "Test-Nr", d: "Kanalgröße d", ti: "Wandstärke ti", l: "Länge l", channels: "Anzahl Kanäle", cells: "Zellenzahl",
};
const SAMPLE_ORDER: SampleKind[] = ["test", "d", "ti", "l", "channels", "cells"];

/** Ordnet ein Einzelfeld nach seinem Schlüssel (und ggf. seiner Einheit) ein; null = nicht zuordenbar. */
function classifyFlat(r: SampleResultValue): Flat | null {
  const key = resultKey(r).toLowerCase();
  const unit = (r.unit ?? "").trim().toLowerCase();
  let m: RegExpMatchArray | null;

  const gas = gasOf(key);
  if (gas) return { kind: "gas", gas: gas.gas, dir: gas.dir, step: gas.index };
  if ((m = key.match(/^temperatur_?(\d+)$/))) return { kind: "step", field: "temp", step: Number(m[1]) };
  if ((m = key.match(/^eta_nox((?:_kopie)*)$/))) return { kind: "step", field: "eta", step: 1 + m[1].length / 6 };
  if ((m = key.match(/^k_wert((?:_kopie)*)$/))) return { kind: "step", field: "k", step: 1 + m[1].length / 6 };

  if (key === "test_nr") return { kind: "sample", field: "test", idx: null };
  if (/^d_kanalgroesse/.test(key)) return { kind: "sample", field: "d", idx: null };
  if (/^ti_/.test(key)) return { kind: "sample", field: "ti", idx: null };
  if ((m = key.match(/^l((?:_kopie)*)$/))) return { kind: "sample", field: "l", idx: 1 + m[1].length / 6 };
  if ((m = key.match(/^anzahl.*kan.*?(\d+)$/))) return { kind: "sample", field: "channels", idx: Number(m[1]) };
  if ((m = key.match(/^zellenzahl(?:.*?(\d+))?$/))) return { kind: "sample", field: "cells", idx: m[1] ? Number(m[1]) : null };

  if ((m = key.match(/^av_?(\d+)$/))) return { kind: "cond", field: "av", idx: Number(m[1]) };
  if ((m = key.match(/^fr_?(\d+)$/))) return { kind: "cond", field: "fr", idx: Number(m[1]) };
  if (/^fr_?feucht$/.test(key)) return { kind: "cond", field: "fr", idx: null };
  // Sollwerte der Anlage nur mit passender Einheit; in Nml/g/Nl sind es Dosiermengen (keine Bedingungen).
  if ((m = key.match(/^(no|nh3)_anlage$/)) && unit === "ppm") return { kind: "cond", field: m[1] as CondKind, idx: null };
  if ((m = key.match(/^(h2o|o2)_anlage$/)) && unit === "%") return { kind: "cond", field: m[1] as CondKind, idx: null };
  // ältere flache Bauart: no, no_2, nh3_1, nh3_2, h2o, o2
  if ((m = key.match(/^(no|nh3)(?:_(\d+))?$/))) return { kind: "cond", field: m[1] as CondKind, idx: m[2] ? Number(m[2]) : 1 };
  if ((m = key.match(/^(h2o|o2)$/))) return { kind: "cond", field: m[1] as CondKind, idx: null };

  // Weitere Gase (C2H4, SO2, Propan ...): Verbindung aus der BESCHRIFTUNG, Richtung In/Out, Einheit ppm/%.
  if (isGasUnit(r.unit)) {
    const ref = compoundRef(r.display_label, key);
    if (ref && ref.dir) {
      const trail = key.match(/_(\d+)$/);
      return { kind: "gas", gas: ref.compound, dir: ref.dir, step: ref.usage ?? (trail ? Number(trail[1]) : 1) };
    }
  }
  return null;
}

/**
 * Weitere Eingangsgase der Messbedingungen (ohne In/Out, Einheit ppm/%): Verbindung aus der Beschriftung.
 * Kommt eine Verbindung mehrfach vor (co, co_2 = "CO (2)"), zaehlt die erste Verwendung mit Wert; die uebrigen bleiben
 * unter "Weitere Angaben". Bekannte Bedingungen (NO, NH3, H2O, O2) laufen weiter ueber ihre eigenen Regeln.
 */
const KNOWN_CONDITIONS = new Set(["NO", "NH3", "H2O", "O2", "N2"]);
function pickExtraConditions<T extends SampleResultValue>(plain: T[], used: Set<SampleResultValue>): Map<T, ActivityExtraCondition> {
  const byCompound = new Map<string, Array<{ r: T; usage: number; order: number; value: ActivityValue }>>();
  plain.forEach((r, order) => {
    if (used.has(r) || !isGasUnit(r.unit)) return;
    const value = flatValue(r);
    if (value === null) return;
    if (classifyFlat(r)) return; // bekannte Einordnung (Gas je Stufe, Bedingung, Probendaten ...)
    const ref = compoundRef(r.display_label, resultKey(r).toLowerCase());
    if (!ref || ref.dir !== null || KNOWN_CONDITIONS.has(ref.compound)) return;
    const list = byCompound.get(ref.compound) ?? [];
    list.push({ r, usage: ref.usage ?? 1, order, value });
    byCompound.set(ref.compound, list);
  });
  const chosen: Array<{ r: T; compound: string; order: number; value: ActivityValue }> = [];
  for (const [compound, list] of byCompound) {
    const first = [...list].sort((a, b) => a.usage - b.usage || a.order - b.order)[0];
    chosen.push({ r: first.r, compound, order: first.order, value: first.value });
  }
  chosen.sort((a, b) => a.order - b.order);
  return new Map(chosen.map((c) => [c.r, { compound: c.compound, value: c.value, unit: normalizeGasUnit(c.r.unit) }]));
}

/** Wert eines Einzelfelds (Zahl oder einfacher Text; strukturierter Text zählt nicht). */
function flatValue(r: SampleResultValue): ActivityValue {
  if (r.value !== null && r.value !== undefined) return asValue(r.value);
  const t = (r.remarks ?? "").trim();
  return t !== "" && parseStructuredText(t) === undefined ? asValue(t) : null;
}

/** Temperatur aus Beschriftungen wie „η-NOx 1_{(200 °C)}“. */
function temperatureFromLabel(label: string | null): number | null {
  const m = (label ?? "").match(/(\d+(?:[.,]\d+)?)\s*°\s*C/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** Temperaturen aus dem Temperaturblock des Auftraggebers: Eintrag i = Stufe i (siehe temperatureBlock.ts). */
export interface TemperatureBlockData {
  /** Index 0 = Stufe 1; null = leerer Eintrag (Stufe bleibt frei). */
  temps: Array<number | null>;
  /** Beteiligte Ergebnisse (Liste und Zeilenergebnisse): werden nicht noch einmal unter „Weitere Angaben“ gezeigt. */
  used: SampleResultValue[];
  official: boolean;
}

export function collectTemperatureBlock(results: SampleResultValue[]): TemperatureBlockData | null {
  const container = results.find((r) =>
    r.value === null && /^temperatur(?:_\d+)?$/i.test(resultKey(r)) && parseTemperatureList(r.remarks) !== null);
  const rows = results.filter((r) => temperatureRowInstance(resultKey(r)) !== null);
  if (!container && rows.length === 0) return null;
  let temps: Array<number | null>;
  if (container) temps = parseTemperatureList(container.remarks)!;
  else {
    temps = [];
    rows.forEach((r, i) => {
      const step = stepOfInstance(temperatureRowInstance(resultKey(r))!) ?? i + 1;
      temps[step - 1] = typeof r.value === "number" && Number.isFinite(r.value) ? r.value : temperatureOf({ v: r.remarks });
    });
    for (let i = 0; i < temps.length; i++) temps[i] ??= null;
  }
  if (!temps.some((t) => t !== null)) return null;
  const used = [...(container ? [container] : []), ...rows];
  // Offiziell zählen die Zeilenergebnisse (je ausgefülltem Eintrag eines); ohne sie die Liste.
  const official = rows.length > 0 ? rows.every((r) => r.is_official === true) : container?.is_official === true;
  return { temps, used, official };
}

const sameTemperature = (a: ActivityValue, b: ActivityValue) =>
  a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9) || String(a).trim() === String(b).trim();

/** Variante B/C: Temperaturstufen aus Einzelfeldern (und dem Temperaturblock des Auftraggebers). */
function buildFlatCatalyst(results: SampleResultValue[], relaxed = false, block: TemperatureBlockData | null = null): { cat: ActivityCatalyst; used: Set<SampleResultValue>; official: boolean } | null {
  type Step = { temp: ActivityValue; target?: ActivityValue; eta: ActivityValue; k: ActivityValue; gases: ActivityRow["gases"]; labelTemp: number | null };
  const steps = new Map<number, Step>();
  const gasUnits: Record<string, string> = {};
  const used = new Set<SampleResultValue>();
  let official = true;
  let conditionHints = 0;
  const step = (n: number): Step => {
    let s = steps.get(n);
    if (!s) steps.set(n, (s = { temp: null, eta: null, k: null, gases: {}, labelTemp: null }));
    return s;
  };
  for (const r of results) {
    const f = classifyFlat(r);
    if (!f) continue;
    if (f.kind === "cond" && ["no", "nh3", "h2o", "o2", "av"].includes(f.field) && flatValue(r) !== null) conditionHints += 1;
    if (f.kind !== "step" && f.kind !== "gas") continue;
    const v = flatValue(r);
    if (v === null) continue;
    const s = step(f.step);
    // Nur als „verbraucht“ markieren, wenn der Wert wirklich in die Zelle geschrieben wurde; kollidierende
    // Felder (z. B. no_in_1 und no_anzeige_in_1) bleiben sonst als Weitere Angaben erhalten.
    let written = false;
    if (f.kind === "gas") {
      const cell = (s.gases[f.gas] ??= { in: null, out: null });
      if (cell[f.dir] === null) {
        cell[f.dir] = v; written = true;
        if (!ACTIVITY_GAS_ORDER.includes(f.gas)) gasUnits[f.gas] ??= normalizeGasUnit(r.unit);
      }
    } else if (f.field === "temp") {
      if (s.temp === null) { s.temp = v; written = true; }
    } else if (s[f.field] === null) {
      s[f.field] = v;
      s.labelTemp ??= temperatureFromLabel(r.display_label);
      written = true;
    }
    if (written) {
      used.add(r);
      if (r.is_official !== true) official = false;
    }
  }
  if (block) {
    block.temps.forEach((t, i) => {
      if (t === null) return; // leerer Eintrag: Stufe bleibt frei, nichts verschiebt sich
      const s = step(i + 1);
      if (s.temp === null) s.temp = t;
      else if (!sameTemperature(s.temp, t)) s.target = t; // gemessen weicht von der Vorgabe ab: beide zeigen
    });
    block.used.forEach((r) => used.add(r));
    if (!block.official) official = false;
  }
  const rows: ActivityRow[] = [...steps.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => ({
    temperature: s.temp ?? s.labelTemp,
    ...(s.target !== undefined && s.target !== null ? { temperatureTarget: s.target } : {}),
    eta: s.eta, k: s.k, gases: s.gases,
  }));
  const hasResult = (r: ActivityRow) => r.eta !== null || r.k !== null || Object.keys(r.gases).length > 0;
  // Strenge Erkennung: mindestens eine Temperaturstufe MIT Ergebnis (η NOx, K-Wert oder Gas), oder mehrere
  // Temperaturen zusammen mit Bedingungsfeldern (alte flache Bauart). Einzelne Felder allein genügen nicht.
  const stepWithResult = rows.some((r) => r.temperature !== null && hasResult(r));
  const temps = rows.filter((r) => r.temperature !== null).length;
  if (!relaxed && !(stepWithResult || (temps >= 2 && conditionHints > 0))) return null;
  const cat: ActivityCatalyst = {
    index: 1, title: null, sampleData: [], conditions: emptyConditions(), rows: sortRows(rows), gasColumns: gasColumnsOf(rows),
    ...(Object.keys(gasUnits).length ? { gasUnits } : {}),
  };
  return { cat, used, official };
}

/** Einzelfeld als beschrifteter Wert (für Probendaten und Weitere Angaben). */
function toField(r: SampleResultValue, label?: string): ActivityField | null {
  const value = flatValue(r);
  if (value === null) return null;
  const raw = (label ?? r.display_label?.trim()) || humanizeKey(resultKey(r));
  return { label: label ?? activityLabel(raw), value, unit: r.unit ? toUnicode(r.unit) : null };
}

/**
 * Trennt die Aktivitätsmessung (Block und/oder Einzelfelder) von den übrigen Ergebnissen und baut daraus die
 * einheitliche Ansicht. `rest` enthält nur noch, was KEIN anzuzeigender Wert ist (Importprotokolle, leere oder
 * andere strukturierte Einträge) – alle Werte stehen entweder in einer Tabelle oder unter „Weitere Angaben“.
 */
export function extractActivity<T extends SampleResultValue>(
  results: T[],
  opts: { serviceName?: string | null } = {},
): { view: ActivityView | null; rest: T[] } {
  const byService = isActivityService(opts.serviceName);
  const catalysts: ActivityCatalyst[] = [];
  const other: ActivityField[] = [];
  const plain: T[] = [];
  let official = true;
  let sawBlock = false;
  for (const r of results) {
    const b = parseBlock(r);
    if (b) {
      sawBlock = true;
      catalysts.push(...b.cats);
      other.push(...b.extras);
      if (r.is_official !== true) official = false;
    } else plain.push(r);
  }

  // Variante B/C: keine Blöcke, aber Temperaturstufen als Einzelfelder.
  let used = new Set<SampleResultValue>();
  if (!sawBlock) {
    // Passt nur die Messart (nicht die Struktur), gilt trotzdem unsere Ansicht – sofern überhaupt Werte vorliegen.
    const block = collectTemperatureBlock(plain);
    const hasAnyValue = !!block || plain.some((r) => flatValue(r) !== null && !(r.value === null && parseStructuredText(r.remarks) !== undefined));
    const flat = buildFlatCatalyst(plain, byService && hasAnyValue, block);
    if (flat) {
      catalysts.push(flat.cat);
      used = flat.used;
      if (!flat.official) official = false;
    }
  }
  if (catalysts.length === 0) return { view: null, rest: results };

  const byIndex = (n: number) => catalysts.find((c) => c.index === n);
  const rest: T[] = [];
  const sampleFields = new Map<ActivityCatalyst, Map<SampleKind, ActivityField>>();
  const putSample = (c: ActivityCatalyst, kind: SampleKind, f: ActivityField) => {
    const m = sampleFields.get(c) ?? new Map<SampleKind, ActivityField>();
    if (!m.has(kind)) m.set(kind, f);
    sampleFields.set(c, m);
  };

  const extraConditions = pickExtraConditions(plain, used);
  for (const r of plain) {
    if (used.has(r)) continue; // bereits in der Temperaturtabelle
    const extra = extraConditions.get(r);
    if (extra) { catalysts.forEach((c) => c.conditions.extra.push(extra)); continue; }
    const v = flatValue(r);
    const structured = r.value === null && (r.remarks ?? "").trim() !== "" && parseStructuredText(r.remarks) !== undefined;
    if (v === null) { rest.push(r); continue; } // leer, strukturiert oder intern: allgemeine Behandlung
    if (structured) { rest.push(r); continue; }
    const f = classifyFlat(r);
    if (f?.kind === "sample") {
      const targets = f.idx === null ? catalysts : [byIndex(f.idx)].filter((c): c is ActivityCatalyst => !!c);
      if (targets.length) {
        const field = toField(r, SAMPLE_LABEL[f.field])!;
        field.unit = r.unit ? toUnicode(r.unit) : null;
        targets.forEach((c) => putSample(c, f.field, field));
        continue;
      }
    } else if (f?.kind === "cond") {
      const targets = f.idx === null ? catalysts : [byIndex(f.idx)].filter((c): c is ActivityCatalyst => !!c);
      if (targets.length) {
        // AV und FR kommen weiterhin aus dem Katalysator-Eintrag – die Einzelfelder nur als Ersatz.
        targets.forEach((c) => { c.conditions[f.field] ??= v; });
        continue;
      }
    }
    const field = toField(r);
    if (field) other.push(field);
  }

  for (const [c, m] of sampleFields) {
    c.sampleData = SAMPLE_ORDER.filter((k) => m.has(k)).map((k) => m.get(k)!);
  }
  catalysts.sort((a, b) => a.index - b.index);
  return { view: { official, catalysts, other }, rest };
}

/** Sind überhaupt Messbedingungen vorhanden? (sonst: Hinweis „keine Messbedingungen erfasst“) */
export const hasConditions = (c: ActivityConditions): boolean =>
  c.extra.length > 0 || [c.av, c.fr, c.no, c.nh3, c.h2o, c.o2].some((v) => v !== null);

/**
 * Überschrift „Katalysator …“: nur bei echter Katalysatornummer (kat_nr, z. B. FG26_0330/1), die nicht der
 * Probenbezeichnung/-nummer entspricht. Mehrere Katalysatoren ohne kat_nr werden nur durchnummeriert.
 */
export function catalystHeading(
  cat: ActivityCatalyst,
  total: number,
  sample?: { number?: string | null; name?: string | null },
): string | null {
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  if (cat.title) {
    const t = norm(cat.title);
    if (t === norm(sample?.name) || t === norm(sample?.number)) return null;
    return cat.title;
  }
  return total > 1 ? String(cat.index) : null;
}
