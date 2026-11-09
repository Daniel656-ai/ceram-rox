import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveBilled } from "@/lib/orders/billing";
import { useSetOrderBilled } from "@/hooks/useOrders";

/** Kompakte Anzeige – nur für Kundenaufträge. */
export function BillingStatusText({ order }: { order: { order_type?: string | null; is_billed?: boolean | null } }) {
  const { t } = useTranslation("orders");
  const billed = resolveBilled(order);
  if (billed === null) return null;
  return (
    <div className={billed ? "text-xs text-primary" : "text-xs text-muted-foreground"}>
      {billed ? t("billing.billed_yes") : t("billing.billed_no")}
    </div>
  );
}

/** Detailansicht: änderbar für Ersteller/Master über RPC, sonst nur lesend. */
export function BillingStatusControl({ order, canEdit }: { order: { id: string; order_type?: string | null; is_billed?: boolean | null }; canEdit: boolean }) {
  const { t } = useTranslation("orders");
  const setBilled = useSetOrderBilled();
  const billed = resolveBilled(order);
  if (billed === null) return null;
  if (!canEdit) {
    return <Badge variant="outline" className="font-normal">{billed ? t("billing.billed_yes") : t("billing.billed_no")}</Badge>;
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("billing.billed")}:</span>
      <Select
        value={billed ? "yes" : "no"}
        disabled={setBilled.isPending}
        onValueChange={(v) => {
          const next = v === "yes";
          if (next === billed) return;
          setBilled.mutate(
            { id: order.id, value: next },
            {
              onSuccess: () => toast.success(t("billing.saved")),
              onError: (e: any) => toast.error(`${t("billing.save_error")}: ${e?.message ?? ""}`),
            },
          );
        }}
      >
        <SelectTrigger className="h-8 w-24" aria-label={t("billing.billed")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="no">{t("billing.no")}</SelectItem>
          <SelectItem value="yes">{t("billing.yes")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
