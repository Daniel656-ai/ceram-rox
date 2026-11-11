import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useUpdateOrder } from "@/hooks/useOrders";
import {
  PRIORITY_LEVELS,
  normalizePriority,
  priorityLabelKey,
  priorityBadgeVariant,
  type PriorityLevel,
} from "@/lib/orders/priority";
import { cn } from "@/lib/utils";

/** Orange für "hoch" über semantisches Warning-Token; übrige Stufen über Badge-Varianten. */
const LEVEL_CLASS: Partial<Record<PriorityLevel, string>> = {
  hoch: "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
};

export function OrderPriorityBadge({ priority, className }: { priority?: string | null; className?: string }) {
  const { t } = useTranslation("common");
  const level = normalizePriority(priority);
  return (
    <Badge variant={priorityBadgeVariant(level)} className={cn("font-medium whitespace-nowrap", LEVEL_CLASS[level], className)}>
      {t(priorityLabelKey(level))}
    </Badge>
  );
}

/**
 * Auftragspriorität (measurement_orders.priority) in der Auftragsliste.
 * Bearbeitbar nur, wenn `editable` (Master); Speichern über api.orders.update.
 */
export function OrderPriorityCell({ orderId, priority, editable }: { orderId: string; priority?: string | null; editable: boolean }) {
  const { t } = useTranslation(["common", "orders"]);
  const update = useUpdateOrder();
  const [optimistic, setOptimistic] = useState<PriorityLevel | null>(null);
  const current = optimistic ?? normalizePriority(priority);

  if (!editable) return <OrderPriorityBadge priority={priority} />;

  const onChange = async (val: string) => {
    const next = val as PriorityLevel;
    if (next === normalizePriority(priority) || update.isPending) return;
    setOptimistic(next);
    try {
      await update.mutateAsync({ id: orderId, priority: next } as any);
      toast.success(t("orders:priority_saved", { defaultValue: "Priorität gespeichert" }));
    } catch (err: any) {
      toast.error(t("orders:priority_save_error", { defaultValue: "Priorität konnte nicht gespeichert werden" }), {
        description: err?.message,
      });
    } finally {
      setOptimistic(null);
    }
  };

  return (
    <Select value={current} onValueChange={onChange} disabled={update.isPending}>
      <SelectTrigger className="h-8 w-[130px] border-none bg-transparent px-1 text-xs shadow-none" aria-label={t("orders:priority")}>
        <span className="flex items-center gap-1">
          <OrderPriorityBadge priority={current} />
          {update.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </span>
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_LEVELS.map((l) => (
          <SelectItem key={l} value={l}>{t(priorityLabelKey(l))}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
