import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ServiceOption {
  id: string;
  service_name: string | null;
  category?: string | null;
}

/** Mehrfachauswahl der Dienstleistungen für den persönlichen Aufgabenfilter (nur Anzeige). */
export function TaskServiceFilterPopover({
  services,
  selectedIds,
  onChange,
}: {
  services: ServiceOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t, i18n } = useTranslation(["orders"]);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const sorted = useMemo(
    () =>
      [...services].sort(
        (a, b) =>
          (a.category || "").localeCompare(b.category || "", i18n.language) ||
          (a.service_name || "").localeCompare(b.service_name || "", i18n.language, { numeric: true, sensitivity: "base" }),
      ),
    [services, i18n.language],
  );
  const q = query.trim().toLowerCase();
  const visible = q ? sorted.filter((s) => (s.service_name || "").toLowerCase().includes(q)) : sorted;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("gap-2", selectedIds.length > 0 && "border-primary text-primary")}>
          <Filter className="h-4 w-4" />
          {t("orders:task_filter_services")}
          {selectedIds.length > 0 && <Badge variant="secondary" className="ml-1 px-1.5">{selectedIds.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <Input
            autoFocus
            placeholder={t("orders:task_filter_service_search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t("orders:task_filter_no_services")}</p>
          ) : (
            visible.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted">
                <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                <span className="flex-1 truncate">{s.service_name || "–"}</span>
                {s.category && <span className="text-xs text-muted-foreground">{s.category}</span>}
              </label>
            ))
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="border-t p-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>{t("orders:task_filter_clear_services")}</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
