import { useTranslation } from "react-i18next";
import {
  Bomb,
  Flame,
  Cylinder,
  TestTube2,
  Skull,
  AlertTriangle,
  HeartPulse,
  Leaf,
  Sparkles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  HAZARD_CLASSES,
  type HazardClassMeta,
  getHazardMeta,
  normalizeHazardClasses,
} from "@/lib/hazardClasses";

const ICON_MAP = {
  bomb: Bomb,
  flame: Flame,
  "circle-flame": Sparkles, // Flamme über Kreis (Oxidierend) – Lucide-Annäherung
  cylinder: Cylinder,
  "test-tube": TestTube2,
  skull: Skull,
  alert: AlertTriangle,
  health: HeartPulse,
  leaf: Leaf,
} as const;

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { box: number; icon: number }> = {
  sm: { box: 28, icon: 14 },
  md: { box: 40, icon: 20 },
  lg: { box: 60, icon: 30 },
};

interface GhsPictogramProps {
  hazardKey: string;
  size?: Size;
  className?: string;
  showTooltip?: boolean;
}

/**
 * GHS-Piktogramm: rot umrandete weiße Raute mit zentriertem Symbol.
 * Standardisierte Annäherung (kein offizielles GHS-Asset, aber sofort erkennbar).
 */
export function GhsPictogram({ hazardKey, size = "md", className, showTooltip = true }: GhsPictogramProps) {
  const { t } = useTranslation("hazard");
  const meta = getHazardMeta(hazardKey);
  if (!meta) return null;

  const Icon = ICON_MAP[meta.iconKey];
  const { box, icon } = SIZES[size];
  const label = t(`class_${meta.key}`);

  const node = (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        className,
      )}
      style={{ width: box, height: box }}
      aria-label={`${meta.ghsCode} – ${label}`}
      role="img"
    >
      <span
        className="relative flex items-center justify-center"
        style={{
          width: box,
          height: box,
          transform: "rotate(45deg)",
          background: "white",
          border: `2px solid #DC2626`, // GHS-Rot
          borderRadius: 3,
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }}
      >
        <Icon
          style={{
            width: icon,
            height: icon,
            transform: "rotate(-45deg)",
            color: "#111827",
          }}
          strokeWidth={2.25}
        />
      </span>
    </span>
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
