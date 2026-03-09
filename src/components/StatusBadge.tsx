import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation("common");

  const statusConfig: Record<string, { labelKey: string; className: string }> = {
    open: { labelKey: "status_open", className: "bg-muted text-muted-foreground" },
    in_progress: { labelKey: "status_in_progress", className: "bg-warning/15 text-warning border-warning/30" },
    completed: { labelKey: "status_completed", className: "bg-success/15 text-success border-success/30" },
  };

  const config = statusConfig[status] || { labelKey: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {t(config.labelKey)}
    </Badge>
  );
}
