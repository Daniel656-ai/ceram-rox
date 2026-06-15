import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  HAZARD_CLASSES,
  type HazardClassMeta,
  getHazardMeta,
  normalizeHazardClasses,
} from "@/lib/hazardClasses";

import ghs01 from "@/assets/ghs/ghs01.svg";
import ghs02 from "@/assets/ghs/ghs02.svg";
import ghs03 from "@/assets/ghs/ghs03.svg";
import ghs04 from "@/assets/ghs/ghs04.svg";
import ghs05 from "@/assets/ghs/ghs05.svg";
import ghs06 from "@/assets/ghs/ghs06.svg";
import ghs07 from "@/assets/ghs/ghs07.svg";
import ghs08 from "@/assets/ghs/ghs08.svg";
import ghs09 from "@/assets/ghs/ghs09.svg";

const GHS_SVG: Record<string, string> = {
  GHS01: ghs01,
  GHS02: ghs02,
  GHS03: ghs03,
  GHS04: ghs04,
  GHS05: ghs05,
  GHS06: ghs06,
  GHS07: ghs07,
  GHS08: ghs08,
  GHS09: ghs09,
};

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, number> = {
  sm: 28,
  md: 40,
  lg: 60,
};

interface GhsPictogramProps {
  hazardKey: string;
  size?: Size;
  className?: string;
  showTooltip?: boolean;
}

/**
 * Offizielles GHS-Piktogramm aus dem zentralen SVG-Asset-Ordner.
 * Wiederverwendbar in Listen, Detailansichten, Etiketten, PDF-Berichten.
 */
export function GhsPictogram({ hazardKey, size = "md", className, showTooltip = true }: GhsPictogramProps) {
  const { t } = useTranslation("hazard");
  const meta = getHazardMeta(hazardKey);
  if (!meta) return null;

  const src = GHS_SVG[meta.ghsCode];
  const box = SIZES[size];
  const label = t(`class_${meta.key}`);

  const node = (
    <img
      src={src}
      alt={`${meta.ghsCode} – ${label}`}
      width={box}
      height={box}
      className={cn("inline-block shrink-0 select-none", className)}
      draggable={false}
      loading="lazy"
    />
  );

  if (!showTooltip) return node;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs font-medium">
            {meta.ghsCode} · {label}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface GhsPictogramListProps {
  hazardClasses: readonly string[] | null | undefined;
  size?: Size;
  className?: string;
  max?: number;
}

export function GhsPictogramList({
  hazardClasses,
  size = "md",
  className,
  max,
}: GhsPictogramListProps) {
  const normalized = normalizeHazardClasses(hazardClasses);
  if (normalized.length === 0) return null;
  const shown = max ? normalized.slice(0, max) : normalized;
  const hiddenCount = normalized.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((k) => (
        <GhsPictogram key={k} hazardKey={k} size={size} />
      ))}
      {hiddenCount > 0 && (
        <span className="text-xs text-muted-foreground font-medium">+{hiddenCount}</span>
      )}
    </span>
  );
}

export { HAZARD_CLASSES };
export type { HazardClassMeta };
