/**
 * Klickbarer Spaltenkopf mit Sortierpfeil – identisches Verhalten wie in der
 * Rohstoffliste, nur als wiederverwendbare Komponente.
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortDir } from "@/lib/list/listSorting";

export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3 inline ml-1" />
  ) : (
    <ArrowDown className="h-3 w-3 inline ml-1" />
  );
}

export function SortableHead<K extends string>({
  columnKey,
  sortKey,
  sortDir,
  onToggle,
  className,
  children,
}: {
  columnKey: K;
  sortKey: K;
  sortDir: SortDir;
  onToggle: (key: K) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center hover:underline"
        onClick={() => onToggle(columnKey)}
      >
        {children}
        <SortIcon active={sortKey === columnKey} dir={sortDir} />
      </button>
    </TableHead>
  );
}
