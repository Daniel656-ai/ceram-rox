import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterOptions, shouldShowSearch, type SelectOption } from "@/lib/ui/optionFilter";

export interface SearchableSelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

/**
 * Dropdown mit automatischer Live-Suche bei > 10 Einträgen. Bis 10 Einträge
 * wird das bestehende Select unverändert verwendet. Werte (inkl. `__none__`)
 * werden nie verändert; deaktivierte Einträge bleiben nicht auswählbar.
 */
export function SearchableSelect({
  value, onValueChange, options, placeholder, disabled, triggerClassName,
  searchPlaceholder = "Suchen …", emptyText = "Keine Treffer",
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Optionen geändert (z. B. abhängiges Feld) → keinen veralteten Filter behalten.
  const optionsKey = options.map((o) => `${o.value}\u0000${o.label}\u0000${o.disabled ? 1 : 0}`).join("\u0001");
  React.useEffect(() => { setQuery(""); }, [optionsKey]);

  if (!shouldShowSearch(options.length)) {
    return (
      <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o, i) => (
            <SelectItem key={`${o.value}-${i}`} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const selected = options.find((o) => o.value === value);
  const visible = filterOptions(options, query);

  return (
    // modal: eigene Scroll-Ebene, sonst blockiert ein umgebender Dialog das Mausrad in der Liste.
    <Popover modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
            triggerClassName,
          )}
        >
          <span className={cn(!selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-48" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {visible.map((o, i) => (
                <CommandItem
                  key={`${o.value}-${i}`}
                  value={`${i}:${o.value}`}
                  disabled={o.disabled}
                  onSelect={() => {
                    if (o.disabled) return;
                    onValueChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
