import { ColumnFilterPopover, getValue, isFilterActive, type DataTableApi } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import type { OrderFilterRow } from "@/lib/orders/orderFilterColumns";

export function OrderListFilters({ columns, rows, table, filterKeys }: { columns: DataTableColumn<OrderFilterRow>[]; rows: OrderFilterRow[]; table: DataTableApi<OrderFilterRow>; filterKeys: string[] }) {
  const { t } = useTranslation("orders");
  return <div className="inline-flex shrink-0 items-center">
      {columns.filter(c => c.filterable !== false && filterKeys.includes(c.key)).map(column => {
        const options = [...new Set<string>(rows.flatMap(row => {
          const value = getValue(row, column);
          return (Array.isArray(value) ? value : [value]).filter(v => v != null && v !== "").map(String);
        }))].sort((a, b) => (column.statusLabels?.[a] ?? a).localeCompare(column.statusLabels?.[b] ?? b));
        const active = isFilterActive(table.filters[column.key]);
        return <Tooltip key={column.key}>
          <TooltipTrigger asChild>
            <span className={active ? "text-primary" : undefined}>
              <ColumnFilterPopover column={column} options={options} value={table.filters[column.key]} onChange={v => table.setFilter(column.key, v)} labels={{ title: String(column.header), reset: t("filters.reset"), search: t("filters.search"), empty: t("filters.empty"), aria: String(column.header) }} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{column.header}</TooltipContent>
        </Tooltip>;
      })}
  </div>;
}