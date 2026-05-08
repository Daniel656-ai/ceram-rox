import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PriorityBadgeProps {
  priority: number | string | null | undefined;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { t } = useTranslation("common");

  // Normalize: support both numeric (0/1/2) and string ("normal"/"important"/"highest") values
  const normalize = (p: number | string | null | undefined): "normal" | "important" | "highest" => {
    if (p === 1 || p === "1" || p === "important") return "important";
    if (p === 2 || p === "2" || p === "highest" || p === "high") return "highest";
    return "normal";
  };

  const priorityConfig: Record<string, { labelKey: string; className: string }> = {
    normal: { labelKey: "priority_normal", className: "bg-muted text-muted-foreground" },
    important: { labelKey: "priority_important", className: "bg-warning/15 text-warning border-warning/30" },
    highest: { labelKey: "priority_highest", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };

  const config = priorityConfig[normalize(priority)];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {t(config.labelKey)}
    </Badge>
  );
}
