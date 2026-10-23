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

/** Welche Fälle sind laut gebuchten Leistungen nötig (mehrfach zählt einmal)? */
export function bookedCases(serviceNames: Array<string | null | undefined>) {
  const names = new Set(serviceNames.map(norm));
  return {
    rw: names.has("raumgewicht") || names.has("wasseraufnahme"),
    schw: names.has("schwindung"),
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

  const desired: Array<{ zweck: string; anzahl: number; laenge: number }> = [];
  if (input.rw) desired.push({ zweck: ZWECK_RW, anzahl: rwAnzahl(input.brennCount), laenge: 200 });
  if (input.schw) desired.push({ zweck: ZWECK_SCHW, anzahl: 3, laenge: 150 });

  type Pair = { a: Row; m: Row | undefined };
  const userPairs: Pair[] = [];
  const autoByZweck = new Map<string, Pair>();
  const orphanPairs: Pair[] = [];

  auswahlIn.forEach((a, i) => {
    const m = msIn[i];
    if (!isAutoEntry(a)) { userPairs.push({ a, m }); return; }
    const want = desired.find((d) => d.zweck === a.zweck);
    if (want && !autoByZweck.has(want.zweck)) {
      const { verwaist: _v, ...rest } = a;
      autoByZweck.set(want.zweck, {
        a: { ...rest, ms: MS_293, anzahl: want.anzahl, laenge: want.laenge, zweck: want.zweck, auto: true },
        m,
      });
      return;
    }
    // Nicht mehr benötigt (oder Duplikat): nur entfernen, wenn keine Werte erfasst sind.
    if (mundstueckRowHasValues(m)) orphanPairs.push({ a: { ...a, verwaist: true }, m });
  });

  const autoPairs: Pair[] = desired.map((d) =>
    autoByZweck.get(d.zweck) ?? {
      a: { ms: MS_293, anzahl: d.anzahl, laenge: d.laenge, zweck: d.zweck, auto: true },
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
