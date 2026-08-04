import { type ReactNode, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ColumnFilterPopover } from "./ColumnFilterPopover";
import { getValue, toSearchString } from "./dataTableUtils";
import { useDataTable } from "./useDataTable";
import type { DataTableColumn, SortState } from "./types";

export interface DataTableProps<T> {
  /** Unique id – used to persist search/sort/filters per user. */
  tableId: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  defaultSort?: SortState | null;
  defaultPageSize?: number;
  paginated?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  /** Extra controls rendered on the right side of the toolbar. */
  toolbarActions?: ReactNode;
  className?: string;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function DataTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  isLoading,
  emptyMessage = "Keine Einträge gefunden.",
  searchPlaceholder = "Suchen …",
  defaultSort = null,
  defaultPageSize = 25,
  paginated = true,
  onRowClick,
  rowClassName,
  toolbarActions,
  className,
}: DataTableProps<T>) {
  const table = useDataTable<T>({
    tableId,
    rows,
    columns,
    defaultSort,
    defaultPageSize,
    paginated,
  });

  const distinctByColumn = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      if ((col.type ?? "text") !== "status") continue;
      const set = new Set<string>();
      for (const row of rows) {
        const v = getValue(row, col);
        if (v != null && v !== "") set.add(String(v));
      }
      map[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
    }
    return map;
  }, [columns, rows]);

  const from = table.total === 0 ? 0 : (table.page - 1) * table.pageSize + 1;
  const to = Math.min(table.page * table.pageSize, table.total);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={table.reset}
          disabled={!table.hasActiveState}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Filter zurücksetzen
        </Button>
        <div className="ml-auto flex items-center gap-2">{toolbarActions}</div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const sortable = col.sortable !== false;
                const active = table.sort?.key === col.key;
                const Icon = active
                  ? table.sort!.dir === "asc"
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;
                return (
                  <TableHead key={col.key} className={col.headClassName}>
                    <div className="flex items-center">
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => table.toggleSort(col.key)}
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                        >
                          {col.header}
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5",
                              active ? "text-foreground" : "text-muted-foreground/60",
                            )}
                          />
                        </button>
                      ) : (
                        <span>{col.header}</span>
                      )}
                      {col.filterable !== false && (col.type ?? "text") !== "custom" && (
                        <ColumnFilterPopover
                          column={col}
                          value={table.filters[col.key]}
                          onChange={(v) => table.setFilter(col.key, v)}
                          options={distinctByColumn[col.key]}
                        />
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Lade …
                </TableCell>
              </TableRow>
            ) : table.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-muted/50 transition-colors",
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell ? col.cell(row) : toSearchString(getValue(row, col)) || "–"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {table.total === 0 ? "0 Einträge" : `${from}–${to} von ${table.total} Einträgen`}
        </span>
        {paginated && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Pro Seite</span>
            <Select
              value={String(table.pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={table.page <= 1}
              onClick={() => table.setPage(table.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              {table.page} / {table.pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={table.page >= table.pageCount}
              onClick={() => table.setPage(table.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

