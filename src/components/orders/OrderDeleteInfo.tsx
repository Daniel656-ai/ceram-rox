import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { describeOrderAttachments, type OrderDeleteSummary } from "@/lib/orders/orderDeleteSummary";

/** Zeigt im Löschdialog, was am Auftrag hängt. Lädt erst, wenn der Dialog offen ist (wird darin gerendert). */
export function OrderDeleteInfo({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["order-delete-summary", orderId],
    queryFn: () => api.orders.deleteSummary(orderId) as Promise<OrderDeleteSummary>,
    staleTime: 0,
    gcTime: 0,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Prüfe, was am Auftrag hängt …</p>;
  if (isError) return <p className="text-sm text-destructive">Anhänge konnten nicht geprüft werden. Beim Löschen werden evtl. angehängte Dateien mit entfernt.</p>;
  const lines = describeOrderAttachments(data);
  if (!lines.length) return <p className="text-sm text-muted-foreground">Am Auftrag hängen keine Dateien oder Unterlagen.</p>;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium">Beim Löschen werden mit entfernt bzw. gelöst:</p>
      <ul className="mt-1 list-disc pl-5">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
