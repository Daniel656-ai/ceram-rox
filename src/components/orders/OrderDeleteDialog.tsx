import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteOrder, useOrderDeletePreview } from "@/hooks/useOrders";
import { visibleOrderLinks } from "@/lib/orders/deleteLinks";

/** Delete dialog: shows server-counted links, deletes with the preview hash (server re-checks). */
export function OrderDeleteDialog({ orderId, trigger, onDeleted }: { orderId: string; trigger: ReactNode; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const preview = useOrderDeletePreview(orderId, open);
  const del = useDeleteOrder();
  const links = visibleOrderLinks(preview.data?.links);
  const isForce = preview.data?.mode === "force";
  const internal = preview.data?.blocked_reason === "internal";

  const run = async () => {
    if (del.isPending || !preview.data) return;
    try {
      await del.mutateAsync(isForce ? { id: orderId, hash: preview.data.hash } : orderId);
      toast.success("Auftrag endgültig gelöscht");
      setOpen(false);
      onDeleted?.();
    } catch (e: any) {
      toast.error("Löschen fehlgeschlagen", { description: e?.message });
      preview.refetch();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !del.isPending && setOpen(v)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Auftrag {preview.data?.order_number ?? ""} endgültig löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Der Auftrag wird unwiderruflich gelöscht. Eigenständige Proben, Projekte und Fertigungsfreigaben bleiben erhalten.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-sm space-y-2">
          {preview.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verknüpfungen werden geprüft…</div>}
          {preview.isError && <div className="text-destructive">{(preview.error as any)?.message}</div>}
          {preview.data && (
            <>
              <div className="font-medium">Vorhandene Verknüpfungen</div>
              {links.length === 0 ? (
                <div className="text-muted-foreground">Keine Verknüpfungen vorhanden.</div>
              ) : (
                <ul className="space-y-1">
                  {links.map((l) => (
                    <li key={l.key} className="flex justify-between gap-4 border-b border-border/50 pb-1">
                      <span>{l.label}</span><span className="font-mono tabular-nums">{l.count}</span>
                    </li>
                  ))}
                </ul>
              )}
              {internal && <div className="text-destructive">Interne Prüfaufträge können nur in der Prüfmittelüberwachung abgebrochen werden.</div>}
              {!isForce && !internal && (
                <div className="text-muted-foreground">Als Auftraggeber können nur eigene, noch nicht bearbeitete Aufträge gelöscht werden; der Server prüft dies beim Löschen erneut.</div>
              )}
            </>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Abbrechen</AlertDialogCancel>
          <Button variant="destructive" disabled={!preview.data || internal || del.isPending} onClick={run}>
            {del.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Auftrag endgültig löschen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
