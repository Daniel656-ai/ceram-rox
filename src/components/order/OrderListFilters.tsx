import { ColumnFilterPopover } from "@/components/data-table/ColumnFilterPopover";
import type { DataTableColumn, ColumnFilterValue } from "@/components/data-table/types";
import { getValue, isFilterActive } from "@/components/data-table/dataTableUtils";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function OrderListFilters({ columns, rows, filters, setFilter }: {
  columns: DataTableColumn<any>[]; rows: any[]; filters: Record<string, ColumnFilterValue>;
  setFilter: (key: string, value: ColumnFilterValue | null) => void;
}) {
  const { t } = useTranslation("orders");
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    {columns.filter(c => c.filterable !== false && c.key !== "mine").map(column => {
      const values = [...new Set(rows.flatMap(row => {
        const value = getValue(row, column);
        return (Array.isArray(value) ? value : [value]).filter(v => v != null && v !== "").map(String);
      }))].sort();
      return <div key={column.key} className="flex items-center text-sm">
        <span>{column.header}</span>
        <ColumnFilterPopover column={column} value={filters[column.key]} options={values} onChange={v => setFilter(column.key, v)}
          labels={{ title: String(column.header), trigger: t("filters.open", { name: column.header }), reset: t("filters.reset"), search: t("filters.search"), empty: t("filters.empty") }} />
        {filters[column.key]?.kind === "status" && <span className="ml-1 max-w-48 truncate text-xs text-primary" title={(filters[column.key] as { values: string[] }).values.map(v => column.statusLabels?.[v] ?? v).join(", ")}>{(filters[column.key] as { values: string[] }).values.map(v => column.statusLabels?.[v] ?? v).join(", ")}</span>}
        {isFilterActive(filters[column.key]) && <Button variant="ghost" size="icon" className="h-6 w-6" title={t("filters.remove", { name: column.header })} onClick={() => setFilter(column.key, null)}><X className="h-3 w-3" /></Button>}
      </div>;
    })}
    <SearchableSelect value={filters.mine?.kind === "status" ? filters.mine.values[0] : "__none__"}
      onValueChange={v => setFilter("mine", v === "__none__" ? null : { kind: "status", values: [v] })}
      triggerClassName="w-[240px]" options={[{ value: "__none__", label: t("filters.mine_all") },
        ...["created", "assigned", "either"].map(v => ({ value: v, label: t(`filters.mine_${v}`) }))]} />
    {filters.mine && <Button variant="ghost" size="icon" className="h-6 w-6" title={t("filters.remove", { name: t("filters.mine") })} onClick={() => setFilter("mine", null)}><X className="h-3 w-3" /></Button>}
  </div>;
}