import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnFilterValue, DataTableColumn, DataTableState, SortState } from "./types";
import { processRows } from "./dataTableUtils";

const PREFIX = "rox.table.";

function load(tableId: string): Partial<DataTableState> | null {
  try {
    const raw = localStorage.getItem(PREFIX + tableId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(tableId: string, state: DataTableState) {
  try {
    localStorage.setItem(
      PREFIX + tableId,
      JSON.stringify({
        search: state.search,
        sort: state.sort,
        filters: state.filters,
        pageSize: state.pageSize,
      }),
    );
  } catch {
    /* storage full / disabled – ignore */
  }
}

export interface UseDataTableOptions<T> {
  tableId: string;
  rows: T[];
  columns: DataTableColumn<T>[];
  defaultSort?: SortState | null;
  defaultPageSize?: number;
  /** Set false to render everything (no pagination). */
  paginated?: boolean;
}

export function useDataTable<T>({
  tableId,
  rows,
  columns,
  defaultSort = null,
  defaultPageSize = 25,
  paginated = true,
}: UseDataTableOptions<T>) {
  const initial = useMemo(() => load(tableId), [tableId]);

  const [search, setSearch] = useState(initial?.search ?? "");
  const [sort, setSort] = useState<SortState | null>(
    initial?.sort !== undefined ? initial.sort : defaultSort,
  );
  const [filters, setFilters] = useState<Record<string, ColumnFilterValue>>(
    initial?.filters ?? {},
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initial?.pageSize ?? defaultPageSize);

  useEffect(() => {
    persist(tableId, { search, sort, filters, page, pageSize });
  }, [tableId, search, sort, filters, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, pageSize]);

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }, []);

  const setFilter = useCallback((key: string, value: ColumnFilterValue | null) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value == null) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSearch("");
    setSort(defaultSort);
    setFilters({});
    setPage(1);
  }, [defaultSort]);

  const processed = useMemo(
    () => processRows(rows, columns, search, filters, sort),
    [rows, columns, search, filters, sort],
  );

  const total = processed.length;
  const pageCount = paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const pageRows = paginated
    ? processed.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : processed;

  const hasActiveState =
    !!search.trim() || Object.keys(filters).length > 0 || !!sort;

  return {
    search,
    setSearch,
    sort,
    toggleSort,
    filters,
    setFilter,
    reset,
    hasActiveState,
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    total,
    rows: pageRows,
    allFilteredRows: processed,
  };
}

export type DataTableApi<T> = ReturnType<typeof useDataTable<T>>;
