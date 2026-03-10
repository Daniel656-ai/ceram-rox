/**
 * Austrian public holidays calculation including Easter-based movable holidays.
 * Uses the Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for Easter.
 */

interface Holiday {
  date: Date;
  name: string;
}

/**
 * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns all Austrian public holidays for a given year.
 */
export function getAustrianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);

  return [
    { date: new Date(year, 0, 1), name: "Neujahr" },
    { date: new Date(year, 0, 6), name: "Heilige Drei Könige" },
    { date: addDays(easter, 1), name: "Ostermontag" },
    { date: new Date(year, 4, 1), name: "Staatsfeiertag" },
    { date: addDays(easter, 39), name: "Christi Himmelfahrt" },
    { date: addDays(easter, 50), name: "Pfingstmontag" },
    { date: addDays(easter, 60), name: "Fronleichnam" },
    { date: new Date(year, 7, 15), name: "Mariä Himmelfahrt" },
    { date: new Date(year, 9, 26), name: "Nationalfeiertag" },
    { date: new Date(year, 10, 1), name: "Allerheiligen" },
    { date: new Date(year, 11, 8), name: "Mariä Empfängnis" },
    { date: new Date(year, 11, 25), name: "Weihnachten" },
    { date: new Date(year, 11, 26), name: "Stefanitag" },
  ];
}

/**
 * Returns a Set of holiday date strings (YYYY-MM-DD) for efficient lookup.
 * Covers the given year and optionally surrounding years.
 */
export function getHolidaySet(year: number, extraYears: number[] = []): Set<string> {
  const years = [year, ...extraYears];
  const set = new Set<string>();
  for (const y of years) {
    for (const h of getAustrianHolidays(y)) {
      set.add(formatDateKey(h.date));
    }
  }
  return set;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Check if a date is a working day (Mon-Fri, not a public holiday).
 */
export function isWorkingDay(date: Date, holidaySet?: Set<string>): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Weekend
  if (holidaySet) {
    return !holidaySet.has(formatDateKey(date));
  }
  // Fallback: build set for the year
  const set = getHolidaySet(date.getFullYear());
  return !set.has(formatDateKey(date));
}

/**
 * Add N working days to a date, skipping weekends and Austrian holidays.
 * Returns the resulting date.
 */
export function addWorkingDays(startDate: Date, workingDays: number, holidaySet?: Set<string>): Date {
  const set = holidaySet ?? getHolidaySet(startDate.getFullYear(), [startDate.getFullYear() + 1]);
  const result = new Date(startDate);
  let added = 0;
  while (added < workingDays) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result, set)) {
      added++;
    }
  }
  return result;
}

/**
 * Count working days between two dates (exclusive of start, inclusive of end),
 * skipping weekends and Austrian holidays.
 */
export function countWorkingDays(start: Date, end: Date, holidaySet?: Set<string>): number {
  const minYear = Math.min(start.getFullYear(), end.getFullYear());
  const maxYear = Math.max(start.getFullYear(), end.getFullYear());
  const years = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);
  const set = holidaySet ?? getHolidaySet(minYear, years.slice(1));

  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current, set)) count++;
  }
  return count;
}

/**
 * Get holidays for a date range (for calendar display).
 */
export function getHolidaysInRange(start: Date, end: Date): Holiday[] {
  const years = new Set<number>();
  const current = new Date(start);
  while (current <= end) {
    years.add(current.getFullYear());
    current.setMonth(current.getMonth() + 1);
  }
  years.add(end.getFullYear());

  const holidays: Holiday[] = [];
  for (const y of years) {
    holidays.push(...getAustrianHolidays(y));
  }
  return holidays.filter((h) => h.date >= start && h.date <= end);
}
