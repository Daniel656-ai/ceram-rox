import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SlaResult } from "@/lib/sla/slaCalculator";

/**
 * SLA-Ampel (Phase 1): kompakter Farbpunkt mit erklärendem Tooltip.
 * Der Tooltip ist per Maus und Tastaturfokus erreichbar (fokussierbarer
 * Trigger + aria-label). Farben ausschließlich über Design-Tokens.
 */
export function SlaBadge({
  result,
  dueDate,
  className,
}: {
  result: SlaResult;
  /** Fälligkeitsdatum (YYYY-MM-DD) für die konkrete Tooltip-Angabe. */
  dueDate?: string | null;
  className?: string;
}) {
  const { t, i18n } = useTranslation("orders");

  const dotClass: Record<string, string> = {
    green: "bg-success",
    yellow: "bg-warning",
    red: "bg-destructive",
    neutral: "bg-muted-foreground/40",
    completed: "bg-success/40",
  };

  const label = t(`sla.label_${result.color}`);

  const details: string[] = [];
  if (dueDate && result.color !== "neutral" && result.color !== "completed") {
    const formatted = new Intl.DateTimeFormat(i18n.language === "en" ? "en-GB" : "de-DE").format(
      new Date(`${dueDate}T12:00:00`),
    );
    details.push(t("sla.due_on", { date: formatted }));
  }
  if (result.daysUntilDue !== null) {
    details.push(
      result.daysUntilDue >= 0
        ? t("sla.days_remaining", { count: result.daysUntilDue })
        : t("sla.days_overdue", { count: -result.daysUntilDue }),
    );
  }
  if (result.warningDays !== null && (result.color === "yellow" || result.color === "green")) {
    details.push(t("sla.warning_days", { count: result.warningDays }));
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          aria-label={`${label}. ${t(`sla.tooltip_${result.color}`)}`}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <span className={cn("h-3 w-3 rounded-full", dotClass[result.color])} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">{label}</p>
        <p className="text-xs">{t(`sla.tooltip_${result.color}`)}</p>
        {details.length > 0 && <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
