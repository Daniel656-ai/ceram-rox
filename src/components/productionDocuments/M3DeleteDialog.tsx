import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useDeleteM3List } from "@/hooks/useProductionDocuments";
import { describeM3Delete, type M3DeletePlan } from "@/lib/productionDocuments/m3Delete";

interface Row {
  id: string;
  order_id: string | null;
}

/**
 * Löschdialog für eine m³-Liste: zeigt vorab, was mitgelöscht wird (Beprobungsauftrag, Dateien,
 * nur dafür erzeugte Proben), was stehen bleibt und – falls das Löschen nicht möglich ist – den Grund.
 * Die Fertigungsfreigabe bleibt immer erhalten.
 */
export function M3DeleteDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const del = useDeleteM3List();
  const { data: plan, isLoading, isError, error } = useQuery({
    queryKey: ["m3-delete-plan", row?.id],
    queryFn: () => api.productionDocuments.deletePlan(row!.id) as Promise<M3DeletePlan>,
    enabled: !!row,
    staleTime: 0,
    gcTime: 0,
  });

  const lines = describeM3Delete(plan);
  const blocked = plan?.blocked_reason ?? null;
  const canConfirm = !!plan && !blocked && !del.isPending;

  const confirm = async () => {
    if (!row || !canConfirm) return;
    try {
      const r = await del.mutateAsync({ id: row.id, orderId: row.order_id });
      toast.success(r.order_deleted ? "m³-Liste und Beprobungsauftrag gelöscht" : "m³-Liste gelöscht");
      if (r.kept_samples?.length) {
        toast.info(`${r.kept_samples.length} Probe(n) wurden nicht gelöscht, weil sie anderweitig verwendet werden.`);
      }
      if (r.orphaned > 0) toast.warning(`${r.orphaned} Datei(en) konnten im Speicher nicht entfernt werden.`);
      onClose();
    } catch (e: any) {
      toast.error("Löschen fehlgeschlagen", { description: e?.message ?? String(e) });
    }
  };

  return (
    <AlertDialog open={!!row} onOpenChange={(v) => !v && !del.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>m³-Liste wirklich löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Gelöscht wird die m³-Liste. Das kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Prüfe, was an der m³-Liste hängt …</p>}
        {isError && (
          <p className="text-sm text-destructive">
            Die Prüfung ist fehlgeschlagen: {(error as any)?.message ?? "Unbekannter Fehler"}. Löschen ist nicht möglich.
          </p>
        )}
        {blocked && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">Löschen nicht möglich</p>
            <p>{blocked}</p>
          </div>
        )}
        {plan && !blocked && (
          <div className="space-y-2 text-sm">
            {lines.some((l) => l.kind === "delete") && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="font-medium">Mit der m³-Liste werden gelöscht:</p>
                <ul className="mt-1 list-disc pl-5">
                  {lines.filter((l) => l.kind === "delete").map((l) => <li key={l.text}>{l.text}</li>)}
                </ul>
              </div>
            )}
            {lines.some((l) => l.kind === "keep") && (
              <div className="rounded-md border p-3">
                <p className="font-medium">Bleibt bestehen:</p>
                <ul className="mt-1 list-disc pl-5">
                  {lines.filter((l) => l.kind === "keep").map((l) => <li key={l.text}>{l.text}</li>)}
                </ul>
              </div>
            )}
            {lines.filter((l) => l.kind === "info").map((l) => (
              <p key={l.text} className="text-muted-foreground">{l.text}</p>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Abbrechen</AlertDialogCancel>
          <Button variant="destructive" disabled={!canConfirm} onClick={confirm}>
            {del.isPending ? "Lösche …" : "Löschen"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
