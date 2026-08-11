import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wert eines Rohstoff-Feldes.
 * - mode "db": Referenz auf einen bestehenden Rohstoff der Rohstoffverwaltung.
 * - mode "external": frei eingegebener, noch nicht angelegter Rohstoff.
 * Es wird bewusst KEIN neuer Stammdatensatz erzeugt.
 */
export interface RawMaterialRef {
  mode: "db" | "external";
  raw_material_id?: string | null;
  material_number?: string | null;
  material_name: string;
}

export const normalizeRawMaterialRef = (v: unknown): RawMaterialRef | null => {
  if (!v) return null;
  if (typeof v === "string") return { mode: "external", material_name: v };
  const o = v as Record<string, any>;
  if (!o.material_name && !o.raw_material_id) return null;
  return {
    mode: o.mode === "db" || o.raw_material_id ? "db" : "external",
    raw_material_id: o.raw_material_id ?? null,
    material_number: o.material_number ?? null,
    material_name: o.material_name ?? "",
  };
};

interface Props {
  value: unknown;
  onChange: (v: RawMaterialRef | null) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Auswahl eines Rohstoffs aus der bestehenden Rohstoffverwaltung –
 * inklusive Suche über Name und Rohstoffcode. Alternativ kann ein externer,
 * noch nicht angelegter Rohstoff frei erfasst werden.
 */
export default function RawMaterialSelectField({ value, onChange, disabled, className }: Props) {
  const current = normalizeRawMaterialRef(value);
  const [open, setOpen] = useState(false);
  const [externalMode, setExternalMode] = useState(current?.mode === "external");

  const { data: materials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => api.rawMaterials.list(),
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(
    () =>
      (materials as any[]).map((m) => ({
        id: m.id as string,
        name: (m.material_name ?? "") as string,
        number: (m.material_number ?? null) as string | null,
      })),
    [materials]
  );

  if (externalMode) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Input
          placeholder="Externen / noch nicht angelegten Rohstoff eingeben…"
          disabled={disabled}
          value={current?.mode === "external" ? current.material_name : ""}
          onChange={(e) =>
            onChange(e.target.value ? { mode: "external", material_name: e.target.value } : null)
          }
        />
        <Badge variant="outline" className="text-[10px] shrink-0">extern</Badge>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => { setExternalMode(false); onChange(null); }}
          >
            Aus Stammdaten
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="h-9 flex-1 justify-between font-normal"
          >
            <span className="truncate">
              {current?.material_name
                ? `${current.material_name}${current.material_number ? ` (${current.material_number})` : ""}`
                : "Rohstoff auswählen…"}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput placeholder="Suche nach Rohstoff / Rohstoffcode…" />
            <CommandList>
              <CommandEmpty>Kein Rohstoff gefunden.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.name} ${o.number ?? ""}`}
                    onSelect={() => {
                      onChange({
                        mode: "db",
                        raw_material_id: o.id,
                        material_number: o.number,
                        material_name: o.name,
                      });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        current?.raw_material_id === o.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{o.name}</span>
                    {o.number && (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">{o.number}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {current && !disabled && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(null)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-xs"
          onClick={() => { setExternalMode(true); onChange(null); }}
        >
          Extern
        </Button>
      )}
    </div>
  );
}
