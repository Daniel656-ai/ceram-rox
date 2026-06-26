import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";
import { useMergedSymbols } from "@/hooks/useMergedSymbols";
import { cn } from "@/lib/utils";

interface PsaSymbolSelectorProps {
  value: readonly string[] | null | undefined;
  onChange: (next: string[]) => void;
  label?: string | null;
  className?: string;
  idPrefix?: string;
}

/**
 * Multi-Select für PSA-Symbole. Lädt System- und benutzerdefinierte Symbole
 * aus der zentralen Symbolverwaltung (`useMergedSymbols("psa")`).
 */
export function PsaSymbolSelector({
  value,
  onChange,
  label = "PSA-Schutzausrüstung",
  className,
  idPrefix = "psa",
}: PsaSymbolSelectorProps) {
  const symbols = useMergedSymbols("psa");
  const selected = Array.isArray(value) ? value : [];

  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  return (
    <div className={cn("space-y-2 rounded-md border p-3", className)}>
      {label !== null && (
        <Label className="font-semibold flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {label}
        </Label>
      )}
      {symbols.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine PSA-Symbole konfiguriert.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {symbols.map((s) => {
            const id = `${idPrefix}-${s.key}`;
            const isOn = selected.includes(s.key);
            return (
              <label
                key={s.key}
                htmlFor={id}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer transition-colors",
                  isOn ? "border-primary/60 bg-primary/5" : "border-input hover:bg-muted/50",
                )}
              >
                <Checkbox id={id} checked={isOn} onCheckedChange={() => toggle(s.key)} />
                <img src={s.src} alt={s.label} width={32} height={32} className="shrink-0" loading="lazy" />
                <span className="text-xs leading-tight font-medium truncate">{s.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
