import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  /** Ranking value: 1 = highest, 2 = high, 3 = normal. Null/undefined => "–". */
  ranking?: number | string | null;
  className?: string;
}

/**
 * Resolves the effective ranking for a measurement row.
 * Priority order: measurement.ranking -> order.ranking.
 */
export function getEffectiveRanking(measurement: any): number | null {
  const r = measurement?.ranking ?? measurement?.measurement_orders?.ranking ?? null;
  if (r == null) return null;
  const n = typeof r === "string" ? parseInt(r, 10) : r;
  return Number.isFinite(n) ? n : null;
}

export function PriorityBadge({ ranking, className }: PriorityBadgeProps) {
  const r = ranking == null ? null : (typeof ranking === "string" ? parseInt(ranking, 10) : ranking);

  if (!r || !Number.isFinite(r)) {
    return <span className={cn("text-muted-foreground", className)}>–</span>;
  }

  const variant: "destructive" | "default" | "secondary" =
    r === 1 ? "destructive" : r === 2 ? "default" : "secondary";

  return (
    <Badge variant={variant} className={cn("font-medium", className)}>
      Prio {r}
    </Badge>
  );
}
