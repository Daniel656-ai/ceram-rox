import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useUsers } from "@/hooks/useUsers";
import {
  getPersonDisplayName,
  sortAndFilterPersons,
  type PersonLike,
} from "@/lib/personSearch";

interface PersonSelectProps {
  value?: string | null;
  onValueChange: (userId: string) => void;
  users?: PersonLike[];
  excludeIds?: string[];
  activeOnly?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  clearLabel?: string;
  extraFilter?: (u: PersonLike) => boolean;
}

/**
 * Uniform person picker used across the entire app.
 * Wraps the shared search logic from `src/lib/personSearch.ts`
 * (live search on first/last name, alphabetical Lastname, Firstname order)
 * with a searchable combobox trigger.
 */
export function PersonSelect({
  value,
  onValueChange,
  users: providedUsers,
  excludeIds,
  activeOnly = true,
  placeholder,
  searchPlaceholder,
  disabled,
  className,
  allowClear,
  clearLabel,
  extraFilter,
}: PersonSelectProps) {
  const { t } = useTranslation("projects");
  const { data: fetchedUsers = [] } = useUsers();
  const users = (providedUsers ?? (fetchedUsers as PersonLike[])) as PersonLike[];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => sortAndFilterPersons(users, query, { excludeIds, activeOnly, extraFilter }),
    [users, query, excludeIds, activeOnly, extraFilter],
  );

  const selected = users.find((u) => u.user_id === value);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("flex items-center gap-2 truncate", !selected && "text-muted-foreground")}>
            <User className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">
              {selected ? getPersonDisplayName(selected) : (placeholder ?? t("team_select_person"))}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          // Focus the search input, not the first item.
          e.preventDefault();
          const el = (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>("input");
          el?.focus();
        }}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? t("team_search_person")}
              className="pl-9 h-9"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {allowClear && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              onClick={() => {
                onValueChange("");
                setOpen(false);
              }}
            >
              {clearLabel ?? "—"}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("team_no_search_results", { defaultValue: "Keine Personen gefunden" })}
            </div>
          ) : (
            filtered.map((u) => {
              const isSelected = u.user_id === value;
              return (
                <button
                  type="button"
                  key={u.user_id}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/50",
                  )}
                  onClick={() => {
                    onValueChange(u.user_id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{getPersonDisplayName(u)}</span>
                  {u.short_code ? (
                    <span className="ml-auto text-xs text-muted-foreground">{u.short_code}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
