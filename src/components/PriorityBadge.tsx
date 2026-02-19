import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: number;
  className?: string;
}

const priorityConfig: Record<number, { label: string; className: string }> = {
  0: { label: "Normal", className: "bg-muted text-muted-foreground" },
  1: { label: "Wichtig", className: "bg-warning/15 text-warning border-warning/30" },
  2: { label: "Höchste", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig[0];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}
