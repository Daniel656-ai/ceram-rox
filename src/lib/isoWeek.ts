/**
 * Zentrale ISO-8601 Kalenderwochen-Logik.
 * Die KW wird IMMER aus dem Datum abgeleitet – niemals unabhängig gespeichert.
 */

export interface IsoWeek {
  year: number;
  week: number;
}

function toDate(value: Date | string): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  // "YYYY-MM-DD" oder ISO-Timestamp
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return isNaN(d.getTime()) ? null : d;
}

/** ISO-8601 Kalenderwoche eines Datums. */
export function getISOWeek(value: Date | string): IsoWeek | null {
  const date = toDate(value);
  if (!date) return null;
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return { year: target.getUTCFullYear(), week };
}

/** Montag (ISO) einer Kalenderwoche als "YYYY-MM-DD". */
export function isoWeekToDate(year: number, week: number, weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // 0 = Montag
  const week1Monday = new Date(jan4.getTime() - jan4Day * 86400000);
  const result = new Date(week1Monday.getTime() + ((week - 1) * 7 + (weekday - 1)) * 86400000);
  return result.toISOString().slice(0, 10);
}

/** Anzahl der ISO-Kalenderwochen eines Jahres (52 oder 53). */
export function isoWeeksInYear(year: number): number {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  return getISOWeek(dec28)?.week ?? 52;
}

/** "14.08.2026" */
export function formatDateDE(value?: Date | string | null): string {
  const d = value ? toDate(value) : null;
  return d ? d.toLocaleDateString("de-DE") : "–";
}

/** "KW 33" bzw. "KW 33/2026" */
export function formatWeek(value?: Date | string | null, withYear = false): string {
  const iso = value ? getISOWeek(value) : null;
  if (!iso) return "";
  return withYear ? `KW ${iso.week}/${iso.year}` : `KW ${iso.week}`;
}

/** "14.08.2026 · KW 33" – zentrale Darstellung für alle Projekttermine. */
export function formatDateWithWeek(value?: Date | string | null, withYear = false): string {
  const d = value ? toDate(value) : null;
  if (!d) return "–";
  return `${formatDateDE(d)} · ${formatWeek(d, withYear)}`;
}

/** Sortierschlüssel "2026-33" für Gruppierungen. */
export function weekKey(year: number, week: number): string {
  return `${year}-${String(week).padStart(2, "0")}`;
}
