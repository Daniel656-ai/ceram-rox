import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Offen", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Bearbeitung", className: "bg-warning/15 text-warning border-warning/30" },
  completed: { label: "Abgeschlossen", className: "bg-success/15 text-success border-success/30" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}
