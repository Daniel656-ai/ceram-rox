import { ColumnFilterPopover, getValue, isFilterActive, type DataTableApi } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { X, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OrderFilterRow } from "@/lib/orders/orderFilterColumns";

export function OrderListFilters({ columns, rows, table }: { columns: DataTableColumn<OrderFilterRow>[]; rows: OrderFilterRow[]; table: DataTableApi<OrderFilterRow> }) {
  const { t } = useTranslation("orders");
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {columns.filter(c => c.filterable !== false).map(column => {
        const options = [...new Set<string>(rows.flatMap(row => {
          const value = getValue(row, column);
          return (Array.isArray(value) ? value : [value]).filter(v => v != null && v !== "").map(String);
        }))].sort((a, b) => (column.statusLabels?.[a] ?? a).localeCompare(column.statusLabels?.[b] ?? b));
        const active = isFilterActive(table.filters[column.key]);
        return <div key={column.key} className="flex items-center gap-1 text-sm">
          <span className={active ? "font-semibold text-primary" : "text-muted-foreground"}>{column.header}</span>
          <ColumnFilterPopover column={column} options={options} value={table.filters[column.key]} onChange={v => table.setFilter(column.key, v)} labels={{ title: String(column.header), reset: t("filters.reset"), search: t("filters.search"), empty: t("filters.empty"), aria: String(column.header) }} />
          {active && <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={`${column.header}: ${t("filters.reset")}`} onClick={() => table.setFilter(column.key, null)}><X className="h-3 w-3" /></Button>}
        </div>;
      })}
      <Button size="sm" variant="outline" onClick={table.reset} disabled={!table.hasActiveState}><RotateCcw className="mr-2 h-3.5 w-3.5" />{t("filters.reset")}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t("filters.count", { count: table.total, total: rows.length })}</p>
  </div>;
}