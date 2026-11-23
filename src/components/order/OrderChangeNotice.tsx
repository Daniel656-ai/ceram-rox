import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { api } from "@/lib/api";
import { describeOrderUpdate } from "@/lib/orders/orderEdit";
import { useUsers } from "@/hooks/useUsers";

/** Felder, die für Messdienstleister relevant sind (siehe Migration 0041). */
export const RELEVANT_ORDER_UPDATE_FIELDS = [
  "samples_added", "samples_removed", "services_added", "services_removed", "template", "due_date", "priority",
];

export const isRelevantOrderUpdate = (e: { event_type?: string; metadata?: any }) =>
  e?.event_type === "order_updated" &&
  Array.isArray(e.metadata?.fields) &&
  e.metadata.fields.some((f: string) => RELEVANT_ORDER_UPDATE_FIELDS.includes(f));

/**
 * Hinweisleiste in der Messaufgabe: „Auftrag wurde am … von … geändert: …“ aus dem Änderungsprotokoll.
 * Nur lesend; zeigt die letzten relevanten Änderungen (neueste zuerst, höchstens drei).
 */
export default function OrderChangeNotice({ orderId }: { orderId: string | null | undefined }) {
  const { data: users = [] } = useUsers();
  const { data: events = [] } = useQuery({
    queryKey: ["order-activity", orderId],
    queryFn: () => api.activityLog.listForOrder(orderId!) as Promise<any[]>,
    enabled: !!orderId,
  });
  const relevant = (events as any[]).filter(isRelevantOrderUpdate).slice(0, 3);
  if (relevant.length === 0) return null;
  const name = (id?: string | null) => {
    const u = (users as any[]).find((x) => x.user_id === id);
    return (u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "") || "unbekannt";
  };
  return (
    <div role="status" className="rounded border border-warning bg-warning/10 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <History className="h-4 w-4" /> Der Auftrag wurde nachträglich geändert
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {relevant.map((e) => (
          <li key={e.id}>
            {new Date(e.created_at).toLocaleString("de-AT")} von {name(e.actor_user_id)}: {describeOrderUpdate(e.metadata)}
          </li>
        ))}
      </ul>
    </div>
  );
}
