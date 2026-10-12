export interface RenumberPreviewOrder {
  id: string;
  current_number: string | null;
  new_number: string | null;
  created_at: string;
  status: string | null;
  workflow_status: string | null;
  collision: boolean;
}

export interface RenumberPreview {
  user_id: string;
  short_code: string;
  prefix: string;
  year: number;
  start_value: number;
  count: number;
  last_counter: number | null;
  overflow: boolean;
  collision_count: number;
  orders: RenumberPreviewOrder[];
}

export const MIN_REASON_LENGTH = 5;

export function isValidStartValue(v: number): boolean {
  return Number.isInteger(v) && v >= 1 && v <= 9999;
}

export function isValidYear(y: number): boolean {
  return Number.isInteger(y) && y >= 2000 && y <= 2099;
}

export function isValidReason(r: string): boolean {
  return r.trim().length >= MIN_REASON_LENGTH;
}

/** Same format as generate_order_number(): upper(short_code) || YY || 4-digit counter. */
export function formatOrderNumber(shortCode: string, year: number, counter: number): string {
  return `${shortCode.toUpperCase()}${String(year % 100).padStart(2, "0")}${String(counter).padStart(4, "0")}`;
}

export function normalizeOrderNumber(n: string | null | undefined): string {
  return (n ?? "").trim().toUpperCase();
}

/** Ordering mandated for renumbering: created_at ASC, id ASC. */
export function sortForRenumber<T extends { created_at: string; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (d !== 0) return d;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function lastCounter(start: number, count: number): number {
  return start + count - 1;
}

export function overflows(start: number, count: number): boolean {
  return count > 0 && lastCounter(start, count) > 9999;
}

export function hasCollision(targets: string[], others: string[]): boolean {
  const set = new Set(others.map(normalizeOrderNumber));
  return targets.some((t) => set.has(normalizeOrderNumber(t)));
}

export function canExecute(p: RenumberPreview | null, reason: string, confirmed: boolean): boolean {
  return !!p && p.count > 0 && !p.overflow && p.collision_count === 0 && isValidReason(reason) && confirmed;
}

export function expectedIds(p: RenumberPreview): string[] {
  return p.orders.map((o) => o.id);
}

export function isStalePreviewError(message: string | undefined | null): boolean {
  return !!message && message.includes("seit der Vorschau geändert");
}
