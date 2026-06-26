import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMergedSymbols } from "@/hooks/useMergedSymbols";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";
const SIZES: Record<Size, number> = { sm: 32, md: 48, lg: 64 };

interface PsaSymbolListProps {
  psaSymbols: readonly string[] | null | undefined;
  size?: Size;
  className?: string;
  max?: number;
}

/**
 * Zeigt PSA-Symbole eines Rohstoffs als Piktogramm-Reihe (System- und
 * benutzerdefinierte Symbole aus der zentralen Symbolverwaltung).
 */
export function PsaSymbolList({ psaSymbols, size = "md", className, max }: PsaSymbolListProps) {
  const symbols = useMergedSymbols("psa");
  const keys = Array.isArray(psaSymbols) ? psaSymbols : [];
  if (keys.length === 0) return null;
  const lookup = new Map(symbols.map((s) => [s.key, s]));
  const resolved = keys.map((k) => lookup.get(k)).filter((s): s is NonNullable<typeof s> => !!s);
  if (resolved.length === 0) return null;
  const shown = max ? resolved.slice(0, max) : resolved;
  const hiddenCount = resolved.length - shown.length;
  const box = SIZES[size];

  return (
    <TooltipProvider delayDuration={150}>
      <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
        {shown.map((s) => (
          <Tooltip key={s.key}>
            <TooltipTrigger asChild>
              <img
                src={s.src}
                alt={s.label}
                width={box}
                height={box}
                className="inline-block shrink-0 select-none"
                draggable={false}
                loading="lazy"
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="text-xs font-medium">PSA · {s.label}</span>
            </TooltipContent>
          </Tooltip>
        ))}
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-foreground font-medium">+{hiddenCount}</span>
        )}
      </span>
    </TooltipProvider>
  );
}
