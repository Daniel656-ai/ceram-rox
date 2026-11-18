import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { describeOrderAttachments, describeOrderDeletion, type OrderDeleteSummary } from "@/lib/orders/orderDeleteSummary";

function useOrderDeleteSummary(orderId: string) {
  return useQuery({
    queryKey: ["order-delete-summary", orderId],
    queryFn: () => api.orders.deleteSummary(orderId) as Promise<OrderDeleteSummary>,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Zeigt im Löschdialog, was am Auftrag hängt. Lädt erst, wenn der Dialog offen ist (wird darin gerendert). */
export function OrderDeleteInfo({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useOrderDeleteSummary(orderId);
  return <DeleteInfoView data={data} isLoading={isLoading} isError={isError} />;
}

function List({ title, items, tone }: { title: string; items: string[]; tone: "danger" | "neutral" | "block" }) {
  if (!items.length) return null;
  const cls =
    tone === "block"
      ? "border-destructive bg-destructive/10"
      : tone === "danger"
        ? "border-destructive/40 bg-destructive/5"
        : "border-border bg-muted/40";
  return (
    <div className={`rounded-md border p-3 text-sm ${cls}`}>
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-5">
        {items.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function DeleteInfoView({ data, isLoading, isError }: { data: OrderDeleteSummary | undefined; isLoading: boolean; isError: boolean }) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Prüfe, was am Auftrag hängt …</p>;
  if (isError) return <p className="text-sm text-destructive">Anhänge konnten nicht geprüft werden. Beim Löschen werden evtl. angehängte Dateien mit entfernt.</p>;
  // Ältere Datenbankstände liefern die neuen Felder nicht: dann die bisherige Darstellung.
  if (data && data.blockers === undefined) {
    const lines = describeOrderAttachments(data);
    if (!lines.length) return <p className="text-sm text-muted-foreground">Am Auftrag hängen keine Dateien oder Unterlagen.</p>;
    return <List title="Beim Löschen werden mit entfernt bzw. gelöst:" items={lines} tone="danger" />;
  }
  const d = describeOrderDeletion(data);
  if (d.blockers.length) {
    return (
      <div role="alert" className="space-y-2">
        <List title="Löschen nicht möglich:" items={d.blockers} tone="block" />
      </div>
    );
  }
  const nothing = !d.removed.length && !d.released.length && !d.kept.length;
  if (nothing) return <p className="text-sm text-muted-foreground">Am Auftrag hängen keine Dateien oder Unterlagen.</p>;
  return (
    <div className="space-y-2">
      <List title="Beim Löschen werden mitgelöscht:" items={d.removed} tone="danger" />
      <List title="Beim Löschen werden gelöst (bleiben bestehen):" items={d.released} tone="neutral" />
      <List title="Bleiben bestehen:" items={d.kept} tone="neutral" />
    </div>
  );
}

/** Inhalt des Löschdialogs: Info + Schaltflächen. Bei Sperrgründen (z. B. Messdaten) ist „Löschen“ gesperrt. */
export function OrderDeleteBody({ orderId, pending, onConfirm }: { orderId: string; pending: boolean; onConfirm: () => void }) {
  const { data, isLoading, isError } = useOrderDeleteSummary(orderId);
  const blocked = !!data && (data.blockers?.length ?? 0) > 0;
  return (
    <>
      <DeleteInfoView data={data} isLoading={isLoading} isError={isError} />
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <AlertDialogAction
          disabled={pending || isLoading || blocked}
          onClick={onConfirm}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Löschen
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
