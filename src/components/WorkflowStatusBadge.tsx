import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Props {
  status: string | null | undefined;
  className?: string;
}

const CONFIG: Record<string, { labelKey: string; className: string }> = {
  entwurf: { labelKey: "orders:workflow.entwurf", className: "bg-muted text-muted-foreground" },
  geplant: { labelKey: "orders:workflow.geplant", className: "bg-muted text-muted-foreground" },
  pp_in_progress: { labelKey: "orders:workflow.pp_in_progress", className: "bg-warning/15 text-warning border-warning/30" },
  pp_completed: { labelKey: "orders:workflow.pp_completed", className: "bg-primary/15 text-primary border-primary/30" },
  samples_created: { labelKey: "orders:workflow.samples_created", className: "bg-primary/15 text-primary border-primary/30" },
  waiting_analysis: { labelKey: "orders:workflow.waiting_analysis", className: "bg-warning/15 text-warning border-warning/30" },
  analysis_in_progress: { labelKey: "orders:workflow.analysis_in_progress", className: "bg-warning/15 text-warning border-warning/30" },
  results_complete: { labelKey: "orders:workflow.results_complete", className: "bg-success/15 text-success border-success/30" },
  abgeschlossen: { labelKey: "orders:workflow.abgeschlossen", className: "bg-success/15 text-success border-success/30" },
};

export function WorkflowStatusBadge({ status, className }: Props) {
  const { t } = useTranslation(["orders"]);
  if (!status) return null;
  const cfg = CONFIG[status] || { labelKey: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-medium", cfg.className, className)}>
      {t(cfg.labelKey, status)}
    </Badge>
  );
}
