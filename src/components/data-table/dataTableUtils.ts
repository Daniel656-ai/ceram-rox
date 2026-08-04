import type {
  ColumnFilterValue,
  DataTableColumn,
  DateFilterValue,
  DatePreset,
  SortState,
} from "./types";

export function getValue<T>(row: T, col: DataTableColumn<T>): unknown {
  if (col.accessor) return col.accessor(row);
  return (row as Record<string, unknown>)[col.key];
}

export function toSearchString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleDateString("de-DE");
  if (typeof v === "boolean") return v ? "ja" : "nein";
  return String(v);
}

function toTime(v: unknown): number | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v as string);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function compareValues<T>(a: T, b: T, col: DataTableColumn<T>): number {
  const va = getValue(a, col);
  const vb = getValue(b, col);
  const type = col.type ?? "text";

  const emptyA = va == null || va === "";
  const emptyB = vb == null || vb === "";
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1; // empty always last
  if (emptyB) return -1;

  switch (type) {
    case "number": {
      const na = toNumber(va) ?? 0;
      const nb = toNumber(vb) ?? 0;
      return na - nb;
    }
    case "date": {
      const ta = toTime(va) ?? 0;
      const tb = toTime(vb) ?? 0;
      return ta - tb;
    }
    case "boolean": {
      const ba = va ? 1 : 0;
      const bb = vb ? 1 : 0;
      return ba - bb; // Nein -> Ja
    }
    case "status": {
      const order = col.statusOrder ?? [];
      const ia = order.indexOf(String(va));
      const ib = order.indexOf(String(vb));
      const na = ia === -1 ? order.length : ia;
      const nb = ib === -1 ? order.length : ib;
      if (na !== nb) return na - nb;
      return String(va).localeCompare(String(vb), "de");
    }
    default:
      return toSearchString(va).localeCompare(toSearchString(vb), "de", {
        numeric: true,
        sensitivity: "base",
      });
  }
}

export function resolveDateRange(f: DateFilterValue): { from: number; to: number } | null {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  // Monday-based week
  const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

  switch (f.preset as DatePreset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = addDays(now, -1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "this_week": {
      const s = startOfWeek(now);
      return { from: startOfDay(s), to: endOfDay(addDays(s, 6)) };
    }
    case "last_week": {
      const s = addDays(startOfWeek(now), -7);
      return { from: startOfDay(s), to: endOfDay(addDays(s, 6)) };
    }
    case "this_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case "last_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "this_year":
      return {
        from: new Date(now.getFullYear(), 0, 1).getTime(),
        to: endOfDay(new Date(now.getFullYear(), 11, 31)),
      };
    case "custom": {
      const from = f.from ? startOfDay(new Date(f.from)) : Number.NEGATIVE_INFINITY;
      const to = f.to ? endOfDay(new Date(f.to)) : Number.POSITIVE_INFINITY;
      if (!f.from && !f.to) return null;
      return { from, to };
    }
    default:
      return null;
  }
}

export function matchesFilter<T>(
  row: T,
  col: DataTableColumn<T>,
  filter: ColumnFilterValue,
): boolean {
  const raw = getValue(row, col);

  switch (filter.kind) {
    case "text":
      if (!filter.value.trim()) return true;
      return toSearchString(raw).toLowerCase().includes(filter.value.trim().toLowerCase());
    case "number": {
      if (!filter.value.trim()) return true;
      const target = toNumber(filter.value);
      const val = toNumber(raw);
      if (target == null) return true;
      if (val == null) return false;
      switch (filter.op) {
        case ">": return val > target;
        case ">=": return val >= target;
        case "<": return val < target;
        case "<=": return val <= target;
        default: return val === target;
      }
    }
    case "boolean":
      return (filter.value === "true") === Boolean(raw);
    case "status":
      if (!filter.values.length) return true;
      return filter.values.includes(String(raw ?? ""));
    case "date": {
      const range = resolveDateRange(filter.value);
      if (!range) return true;
      const t = toTime(raw);
      if (t == null) return false;
      return t >= range.from && t <= range.to;
    }
    default:
      return true;
  }
}

export function processRows<T>(
  rows: T[],
  columns: DataTableColumn<T>[],
  search: string,
  filters: Record<string, ColumnFilterValue>,
  sort: SortState | null,
): T[] {
  const q = search.trim().toLowerCase();
  const searchCols = columns.filter((c) => c.searchable !== false);

  let out = rows.filter((row) => {
    if (q) {
      const hit = searchCols.some((c) =>
        toSearchString(getValue(row, c)).toLowerCase().includes(q),
      );
      if (!hit) return false;
    }
    for (const [key, filter] of Object.entries(filters)) {
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      if (!matchesFilter(row, col, filter)) return false;
    }
    return true;
  });

  if (sort) {
    const col = columns.find((c) => c.key === sort.key);
    if (col) {
      out = out
        .map((row, i) => ({ row, i }))
        .sort((a, b) => {
          const cmp = compareValues(a.row, b.row, col);
          if (cmp !== 0) return sort.dir === "asc" ? cmp : -cmp;
          return a.i - b.i;
        })
        .map((x) => x.row);
    }
  }

  return out;
}

export function isFilterActive(f: ColumnFilterValue | undefined): boolean {
  if (!f) return false;
  switch (f.kind) {
    case "text":
    case "number":
      return !!f.value.trim();
    case "boolean":
      return true;
    case "status":
      return f.values.length > 0;
    case "date":
      return f.value.preset !== "all" && !!resolveDateRange(f.value);
    default:
      return false;
  }
}
