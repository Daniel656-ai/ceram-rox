import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ColumnFilterValue, DataTableColumn, DatePreset } from "./types";
import { isFilterActive } from "./dataTableUtils";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "today", label: "Heute" },
  { value: "yesterday", label: "Gestern" },
  { value: "this_week", label: "Diese Woche" },
  { value: "last_week", label: "Letzte Woche" },
  { value: "this_month", label: "Dieser Monat" },
  { value: "last_month", label: "Letzter Monat" },
  { value: "this_year", label: "Dieses Jahr" },
  { value: "custom", label: "Benutzerdefiniert" },
];

interface Props<T> {
  column: DataTableColumn<T>;
  value?: ColumnFilterValue;
  onChange: (value: ColumnFilterValue | null) => void;
  /** Distinct values found in the data (used for status filters without explicit order). */
  options?: string[];
}

export function ColumnFilterPopover<T>({ column, value, onChange, options = [] }: Props<T>) {
  const [open, setOpen] = useState(false);
  const active = isFilterActive(value);
  const type = column.type ?? "text";

  const statusValues = column.statusOrder?.length ? column.statusOrder : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter für Spalte`}
          className={cn(
            "ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground/50 hover:text-foreground",
          )}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <p className="text-xs font-medium text-muted-foreground">Spaltenfilter</p>

        {type === "number" ? (
          <div className="flex gap-2">
            <Select
              value={value?.kind === "number" ? value.op : ">"}
              onValueChange={(op) =>
                onChange({
                  kind: "number",
                  op: op as ">" | ">=" | "<" | "<=" | "=",
                  value: value?.kind === "number" ? value.value : "",
                })
              }
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=">">&gt;</SelectItem>
                <SelectItem value=">=">&ge;</SelectItem>
                <SelectItem value="<">&lt;</SelectItem>
                <SelectItem value="<=">&le;</SelectItem>
                <SelectItem value="=">=</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Wert"
              value={value?.kind === "number" ? value.value : ""}
              onChange={(e) =>
                onChange({
                  kind: "number",
                  op: value?.kind === "number" ? value.op : ">",
                  value: e.target.value,
                })
              }
            />
          </div>
        ) : type === "boolean" ? (
          <Select
            value={value?.kind === "boolean" ? value.value : "__all__"}
            onValueChange={(v) =>
              onChange(v === "__all__" ? null : { kind: "boolean", value: v as "true" | "false" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle</SelectItem>
              <SelectItem value="true">Ja</SelectItem>
              <SelectItem value="false">Nein</SelectItem>
            </SelectContent>
          </Select>
        ) : type === "status" ? (
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {statusValues.length === 0 && (
              <p className="text-xs text-muted-foreground">Keine Werte vorhanden.</p>
            )}
            {statusValues.map((s) => {
              const checked = value?.kind === "status" && value.values.includes(s);
              return (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const current = value?.kind === "status" ? value.values : [];
                      const next = c ? [...current, s] : current.filter((x) => x !== s);
                      onChange(next.length ? { kind: "status", values: next } : null);
                    }}
                  />
                  <span>{column.statusLabels?.[s] ?? s}</span>
                </label>
              );
            })}
          </div>
        ) : type === "date" ? (
          <div className="space-y-2">
            <Select
              value={value?.kind === "date" ? value.value.preset : "all"}
              onValueChange={(p) =>
                onChange(
                  p === "all"
                    ? null
                    : {
                        kind: "date",
                        value: {
                          preset: p as DatePreset,
                          from: value?.kind === "date" ? value.value.from : null,
                          to: value?.kind === "date" ? value.value.to : null,
                        },
                      },
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value?.kind === "date" && value.value.preset === "custom" && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Von</Label>
                  <Input
                    type="date"
                    value={value.value.from ?? ""}
                    onChange={(e) =>
                      onChange({
                        kind: "date",
                        value: { ...value.value, from: e.target.value || null },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Bis</Label>
                  <Input
                    type="date"
                    value={value.value.to ?? ""}
                    onChange={(e) =>
                      onChange({
                        kind: "date",
                        value: { ...value.value, to: e.target.value || null },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <Input
            placeholder="enthält …"
            value={value?.kind === "text" ? value.value : ""}
            onChange={(e) =>
              onChange(e.target.value ? { kind: "text", value: e.target.value } : null)
            }
          />
        )}

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Zurücksetzen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
