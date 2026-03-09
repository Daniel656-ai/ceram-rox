import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PriorityBadgeProps {
  priority: number;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { t } = useTranslation("common");

  const priorityConfig: Record<number, { labelKey: string; className: string }> = {
    0: { labelKey: "priority_normal", className: "bg-muted text-muted-foreground" },
    1: { labelKey: "priority_important", className: "bg-warning/15 text-warning border-warning/30" },
    2: { labelKey: "priority_highest", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };

  const config = priorityConfig[priority] || priorityConfig[0];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {t(config.labelKey)}
    </Badge>
  );
}
