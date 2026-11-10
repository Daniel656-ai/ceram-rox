/**
 * ROX – Automatisches Mundstück 293/1 (Raumgewicht / Wasseraufnahme / Schwindung).
 *
 * Reine Planungslogik ohne Datenzugriff. Die MS-Auswahl (`ms_auswahl_1`) und
 * „Mundstück MS“ (`mundstueck_ms_1`) sind in der Firmendatenbank NUR über die
 * Reihenfolge verknüpft. Deshalb werden beide Listen immer paarweise bewegt:
 * Zeile i der MS-Auswahl gehört zu Zeile i in „Mundstück MS“.
 *
 * - Auto-Einträge tragen `auto: true` und `zweck`; sie stehen immer am Ende
 *   (zuerst „Raumgewicht / Wasseraufnahme“, dann „Schwindung“).
 * - Vom Auftraggeber gewählte Einträge (ohne `auto`) werden nie verändert.
 * - Entfällt ein Auto-Eintrag und hat seine Mundstück-Zeile bereits Werte,
 *   bleibt er erhalten und wird als verwaist markiert.
 * - Idempotent: ein zweiter Lauf ändert nichts.
 */

export const MS_AUSWAHL_KEY = "ms_auswahl_1";
export const MUNDSTUECK_MS_KEY = "mundstueck_ms_1";
export const BRENNEN_KEY = "brennen_1";
/** Die Regel wird nur auf Aufgaben dieser Leistung angewendet (exakter Leistungsname). */
export const EXTRUSION_SERVICE_NAME = "Extrusion";
export const MS_293 = "293_1";
export const ZWECK_RW = "Raumgewicht / Wasseraufnahme";
export const ZWECK_SCHW = "Schwindung";
/** Für den Auftraggeber gesperrte Felder eines Auto-Eintrags. */
export const AUTO_LOCKED_KEYS = ["anzahl", "laenge"] as const;

type Row = Record<string, unknown>;

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/**
 * Normalisierte Mundstück-Kennung für Vergleiche: „293/1“ und „293_1“
 * gelten als identisch. Nur für den Duplikatvergleich – die
 * Originalschreibweise vorhandener Einträge wird nie verändert.
 */
export const normMs = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().replace(/_/g, "/").replace(/\s+/g, " ");

/**
 * MS-Nummer aus einem Leistungsnamen „Schwindung <ms>“ lesen.
 * Schreibweise (Schrägstriche, führende Nullen, Groß/Klein) bleibt erhalten.
 */
export function schwindungMs(serviceName: string | null | undefined): string | null {
  const m = /^schwindung\s+(.+)$/i.exec(String(serviceName ?? "").trim());
  if (!m) return null;
  const ms = m[1].trim().replace(/\s+/g, " ");
  return ms || null;
}

/** Präfix der Schwindungs-Mundstück-Schlüssel in `analyse_ppp`. */
export const SCHWINDUNG_KEY_PREFIX = "schwindung_ms_";
export const ANALYSE_PPP_KEY = "analyse_ppp";
export const MS_FIELD_KEY = "ms";

/**
 * MS-Kandidat aus einem `analyse_ppp`-Schlüssel: „schwindung_ms_293_1“ → „293_1“.
 * Keine numerische Konvertierung, führende Nullen/Unterstriche bleiben erhalten.
 */
export function msFromSchwindungKey(key: unknown): string | null {
  const k = String(key ?? "").trim();
  if (!k.toLowerCase().startsWith(SCHWINDUNG_KEY_PREFIX)) return null;
  const rest = k.slice(SCHWINDUNG_KEY_PREFIX.length);
  return rest || null;
}

/**
 * Kandidat gegen die Optionswerte des Feldes „ms“ prüfen. Nur bei genau einer
 * passenden Option (Vergleich ohne Groß/Klein) wird deren `value` exakt
 * zurückgegeben; keine oder mehrdeutige Treffer → null. Labels werden nie genutzt.
 */
export function resolveMsOptionValue(candidate: string, optionValues: string[]): string | null {
  const c = candidate.trim().toLowerCase();
  const hits = Array.from(new Set(optionValues.filter((v) => String(v).trim().toLowerCase() === c)));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * MS-Auswahlwerte aller in `analyse_ppp` gewählten Schwindungs-Schlüssel.
 * Keine Rückfalllogik auf Leistungsnamen; nicht auflösbare Schlüssel landen in `rejected`.
 */
export function schwMsFromAnalysePpp(
  selected: unknown,
  optionValues: string[]
): { values: string[]; rejected: string[] } {
  const list = Array.isArray(selected) ? selected : selected == null || selected === "" ? [] : [selected];
  const values: string[] = [];
  const rejected: string[] = [];
  for (const e of list) {
    const key = typeof e === "object" && e !== null ? (e as Row).value : e;
    const cand = msFromSchwindungKey(key);
    if (!cand) continue;
    const v = resolveMsOptionValue(cand, optionValues);
    if (v == null) { rejected.push(String(key)); continue; }
    if (!values.includes(v)) values.push(v);
  }
  return { values, rejected };
}

/**
 * Welche Fälle sind laut gebuchten Leistungen nötig (mehrfach zählt einmal)?
 * `schwMs` bleibt hier leer: Schwindungs-Mundstücke kommen ausschließlich aus
 * `analyse_ppp` (siehe `schwMsFromAnalysePpp`), nie aus dem Leistungsnamen.
 */
export function bookedCases(serviceNames: Array<string | null | undefined>) {
  const names = new Set(serviceNames.map(norm));
  const schwMs: string[] = [];
  return {
    rw: names.has("raumgewicht") || names.has("wasseraufnahme"),
    schw: names.has("schwindung"),
    schwMs,
  };
}

const hasValue = (v: unknown) =>
  !(v == null || v === "" || (Array.isArray(v) && v.length === 0));

/** Anzahl Brenntemperaturen = Zeilen in „Brennen“ mit mindestens einem Wert. */
export function countBrenntemperaturen(brennen: unknown): number {
  if (!Array.isArray(brennen)) return 0;
  return brennen.filter((r) => r && typeof r === "object" && Object.values(r as Row).some(hasValue)).length;
}

/** abgerundet(n / 2) + 1; keine Brenntemperatur → 1. */
export function rwAnzahl(brennCount: number): number {
  return brennCount <= 0 ? 1 : Math.floor(brennCount / 2) + 1;
}

/** Hat eine Mundstück-Zeile bereits Werte (außer der Kennung „ms“)? */
export function mundstueckRowHasValues(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  return Object.entries(row as Row).some(([k, v]) => k !== "ms" && hasValue(v));
}

export const isAutoEntry = (r: unknown) => !!r && typeof r === "object" && (r as Row).auto === true;

export interface Mundstueck293Input {
  rw: boolean;
  schw: boolean;
  /** Validierte MS-Auswahlwerte (Optionswerte) aus `analyse_ppp`. */
  schwMs?: string[];
  brennCount: number;
  msAuswahl: unknown;
  mundstueckMs: unknown;
}

export interface Mundstueck293Plan {
  msAuswahl: Row[];
  mundstueckMs: Row[];
  changedAuswahl: boolean;
  changedMundstueck: boolean;
  orphaned: number;
}

export function planMundstueck293(input: Mundstueck293Input): Mundstueck293Plan {
  const auswahlIn: Row[] = Array.isArray(input.msAuswahl) ? (input.msAuswahl as Row[]) : [];
  const msIn: Row[] = Array.isArray(input.mundstueckMs) ? (input.mundstueckMs as Row[]) : [];

  // Soll-Einträge: RW (293/1, brenntemperaturabhängig) unverändert; je gebuchter
  // „Schwindung <ms>“-Leistung ein eigener Eintrag mit der Originalschreibweise.
  type Desired = { ms: string; zweck: string; anzahl: number; laenge: number };
  const desired: Desired[] = [];
  const desiredSeen = new Set<string>();
  const desiredMs = new Set<string>();
  const pushDesired = (d: Desired) => {
    const k = `${d.zweck}|${normMs(d.ms)}`;
    if (desiredSeen.has(k)) return;
    // Zweckunabhängig: ein Schwindungs-Eintrag entfällt, wenn das Mundstück
    // bereits (z. B. für Raumgewicht / Wasseraufnahme) vorgesehen ist.
    if (d.zweck === ZWECK_SCHW && desiredMs.has(normMs(d.ms))) return;
    desiredSeen.add(k);
    desiredMs.add(normMs(d.ms));
    desired.push(d);
  };
  if (input.rw) pushDesired({ ms: MS_293, zweck: ZWECK_RW, anzahl: rwAnzahl(input.brennCount), laenge: 200 });
  if (input.schw) pushDesired({ ms: MS_293, zweck: ZWECK_SCHW, anzahl: 3, laenge: 150 });
  for (const ms of input.schwMs ?? []) pushDesired({ ms, zweck: ZWECK_SCHW, anzahl: 3, laenge: 150 });

  // Auftraggeber-Einträge haben Vorrang: kein Auto-Eintrag für bereits gewählte Mundstücke.
  const userMs = new Set(
    auswahlIn.filter((a) => !isAutoEntry(a)).map((a) => normMs((a as Row).ms))
  );

  type Pair = { a: Row; m: Row | undefined };
  const userPairs: Pair[] = [];
  const autoByKey = new Map<string, Pair>();
  const orphanPairs: Pair[] = [];
  const keyOf = (zweck: unknown, ms: unknown) => `${zweck}|${normMs(ms)}`;

  auswahlIn.forEach((a, i) => {
    const m = msIn[i];
    if (!isAutoEntry(a)) { userPairs.push({ a, m }); return; }
    const want = desired.find((d) => keyOf(d.zweck, d.ms) === keyOf(a.zweck, a.ms));
    if (want && !autoByKey.has(keyOf(want.zweck, want.ms))) {
      const { verwaist: _v, ...rest } = a;
      autoByKey.set(keyOf(want.zweck, want.ms), {
        a: { ...rest, ms: want.ms, anzahl: want.anzahl, laenge: want.laenge, zweck: want.zweck, auto: true },
        m,
      });
      return;
    }
    // Paarung unsicher (Mundstück-Zeile trägt eine andere Kennung): unverändert erhalten.
    if (m && m.ms != null && m.ms !== "" && normMs(m.ms) !== normMs(a.ms)) { orphanPairs.push({ a, m }); return; }
    // Nicht mehr benötigt (oder Duplikat): nur entfernen, wenn keine Werte erfasst sind.
    if (mundstueckRowHasValues(m)) orphanPairs.push({ a: { ...a, verwaist: true }, m });
  });

  // Bereits vorhandene Mundstücke (Auftraggeber, nicht-Schwindungs-Auto-Einträge,
  // erhaltene Einträge) blockieren einen weiteren Schwindungs-Eintrag – zweckunabhängig.
  const presentMs = new Set<string>([
    ...userMs,
    ...orphanPairs.filter((p) => p.a.zweck !== ZWECK_SCHW).map((p) => normMs(p.a.ms)),
    ...desired.filter((d) => d.zweck !== ZWECK_SCHW).map((d) => normMs(d.ms)),
  ]);
  const autoPairs: Pair[] = desired
    .filter((d) => d.zweck !== ZWECK_SCHW || !presentMs.has(normMs(d.ms)))
    .map((d) =>
      autoByKey.get(keyOf(d.zweck, d.ms)) ?? {
        a: { ms: d.ms, anzahl: d.anzahl, laenge: d.laenge, zweck: d.zweck, auto: true },
        m: undefined,
      }
    );

  const pairs = [...userPairs, ...autoPairs, ...orphanPairs];
  const msAuswahl = pairs.map((p) => p.a);
  // Fehlende Mundstück-Zeilen werden neu geschrieben – mit Kennung „ms“.
  const mundstueckMs: Row[] = pairs.map((p) => p.m ?? (p.a.ms != null ? { ms: p.a.ms } : {}));
  // Überzählige Mundstück-Zeilen ohne Gegenstück nie verwerfen.
  if (msIn.length > auswahlIn.length) mundstueckMs.push(...msIn.slice(auswahlIn.length));

  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  // Nur schreiben, wenn sich tatsächlich etwas geändert hat (bestehende Daten unberührt).
  const changedAuswahl = !same(msAuswahl, auswahlIn);
  const changedMundstueck = changedAuswahl && !same(mundstueckMs, msIn);
  return {
    msAuswahl,
    mundstueckMs: changedMundstueck ? mundstueckMs : msIn,
    changedAuswahl,
    changedMundstueck,
    orphaned: orphanPairs.length,
  };
}

/**
 * Entfernen einer Zeile der MS-Auswahl im Formular: Zeile an derselben
 * Position in „Mundstück MS“ mit entfernen. Hat sie Werte → nicht löschen.
 */
export function removePairedRow(
  auswahl: Row[],
  mundstueck: unknown,
  index: number
): { ok: true; auswahl: Row[]; mundstueck: Row[] | null } | { ok: false } {
  const ms = Array.isArray(mundstueck) ? (mundstueck as Row[]) : null;
  if (ms && mundstueckRowHasValues(ms[index])) return { ok: false };
  return {
    ok: true,
    auswahl: auswahl.filter((_, i) => i !== index),
    mundstueck: ms && index < ms.length ? ms.filter((_, i) => i !== index) : ms,
  };
}
