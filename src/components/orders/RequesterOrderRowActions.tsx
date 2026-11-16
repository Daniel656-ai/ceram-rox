import { Pencil, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrderRequesterEditState } from "@/hooks/useOrders";

/**
 * Bearbeiten/Löschen eigener Aufträge in der Übersicht. Die Freigabe kommt
 * ausschließlich serverseitig (tatsächliche Aufgaben-/Bearbeitungsstände).
 */
export function RequesterOrderRowActions({ orderId, renderDelete }: { orderId: string; renderDelete: () => React.ReactNode }) {
  const { t } = useTranslation("orders");
  const navigate = useNavigate();
  const { data } = useOrderRequesterEditState(orderId);
  if (!data) return null;
  if (!data.can_edit) {
    if (data.reason !== "started" && data.reason !== "locked") return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground" aria-label={t("requesterEdit.lockedHint")}>
            <Lock className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{t("requesterEdit.lockedHint")}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <>
      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("requesterEdit.edit")} title={t("requesterEdit.edit")}
        onClick={() => navigate(`/auftraege/neu?edit=${orderId}`)}>
        <Pencil className="h-4 w-4" />
      </Button>
      {renderDelete()}
    </>
  );
}
