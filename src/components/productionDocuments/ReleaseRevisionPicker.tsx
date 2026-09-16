/**
 * Auswahl einer KONKRETEN Fertigungsfreigabe-Revision als Quelle der m³-Liste.
 *
 * Verwendet die bestehende Command-/Combobox-Komponente. Jede Revision ist ein
 * eigener Treffer (Rev1 und Rev2 sind unterscheidbar); gespeichert wird
 * ausschließlich die konkrete `production_releases.id`.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useOrders } from "@/hooks/useOrders";
import { useReleaseRevisionOptions } from "@/hooks/useProductionDocuments";
import {
  matchesReleaseSearch, releaseRevisionLabel, releaseRevisionState, type ReleaseRevisionOption,
} from "@/lib/productionReleaseRef";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useReleaseRevisionList(): ReleaseRevisionOption[] {
  const { data: rows = [] } = useReleaseRevisionOptions();
  const { data: orders = [] } = useOrders();
  return useMemo(() => {
    const orderNumber = new Map<string, string>();
    for (const o of orders as any[]) orderNumber.set(o.id, String(o.order_number ?? ""));
    return (rows as any[]).map((r) => ({
      id: String(r.id),
      release_number: r.release_number ?? null,
      revision_number: r.revision_number ?? null,
      project_name: r.project_name ?? null,
      customer_name: r.customer_name ?? null,
      article_number: r.article_number ?? null,
      order_id: r.order_id ?? null,
      order_number: r.order_id ? (orderNumber.get(String(r.order_id)) ?? null) : null,
      is_current: r.is_current ?? null,
      superseded_at: r.superseded_at ?? null,
    })) as ReleaseRevisionOption[];
  }, [rows, orders]);
}

interface Props {
  value: string | null;
  onChange: (option: ReleaseRevisionOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ReleaseRevisionPicker({ value, onChange, disabled, placeholder }: Props) {
  const options = useReleaseRevisionList();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(
    () => options.filter((o) => matchesReleaseSearch(o, query)).slice(0, 80),
    [options, query]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? releaseRevisionLabel(selected) : (placeholder ?? "Fertigungsfreigabe suchen …")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Auftrag, Projekt, Kunde, Artikelnummer, Revision …"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Keine passende Fertigungsfreigabe gefunden.</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{releaseRevisionLabel(o)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[o.customer_name, o.order_number, o.release_number].filter(Boolean).join(" · ") || "–"}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                    {releaseRevisionState(o)}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
