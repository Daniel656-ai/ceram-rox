import type { ReactNode } from "react";

export type ColumnType = "text" | "number" | "date" | "boolean" | "status" | "custom";

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

export interface DataTableColumn<T> {
  /** Stable key – used for sorting, filtering and persistence. */
  key: string;
  header: ReactNode;
  /** Data type – drives comparator and the available column filter. */
  type?: ColumnType;
  /** Raw value used for sorting / searching / filtering. */
  accessor?: (row: T) => unknown;
  /** Rendered cell. Falls back to the accessor value. */
  cell?: (row: T) => ReactNode;
  /** Ordered list of status values (for type "status"). */
  statusOrder?: string[];
  /** Human readable labels for status values (filter dropdown). */
  statusLabels?: Record<string, string>;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  className?: string;
  headClassName?: string;
}

export type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export interface DateFilterValue {
  preset: DatePreset;
  from?: string | null;
  to?: string | null;
}

export type ColumnFilterValue =
  | { kind: "text"; value: string }
  | { kind: "number"; op: ">" | ">=" | "<" | "<=" | "="; value: string }
  | { kind: "boolean"; value: "true" | "false" }
  | { kind: "status"; values: string[] }
  | { kind: "date"; value: DateFilterValue };

export interface DataTableState {
  search: string;
  sort: SortState | null;
  filters: Record<string, ColumnFilterValue>;
  page: number;
  pageSize: number;
}
