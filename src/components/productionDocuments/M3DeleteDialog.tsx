import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteM3List, useM3DeletePreview } from "@/hooks/useProductionDocuments";

/** Master-only m³ list delete: shows real links; only the list itself is removed. */
export function M3DeleteDialog({ row, label, onClose }: { row: { id: string } | null; label: string; onClose: () => void }) {
  const preview = useM3DeletePreview(row?.id ?? null);
  const del = useDeleteM3List();
  const d = preview.data;
  const run = async () => {
    if (!row || !d || del.isPending) return;
    try {
      await del.mutateAsync({ id: row.id, hash: d.hash });
      toast.success("m³-Liste endgültig gelöscht");
      onClose();
    } catch (e: any) {
      toast.error("Löschen fehlgeschlagen", { description: e?.message });
      preview.refetch();
    }
  };
  const items: string[] = [];
  if (d?.release) {
    items.push(`Fertigungsfreigabe ${d.release.release_number ?? "–"} · Rev${d.release.revision_number ?? "–"} (bleibt erhalten)`);
    if (d.release.project_name || d.release.customer_name)
      items.push(`Fertigungsprojekt ${d.release.project_name ?? "–"}${d.release.customer_name ? ` · Kunde ${d.release.customer_name}` : ""} (bleibt erhalten)`);
  }
  if (d?.order) items.push(`Beprobungsauftrag ${d.order.order_number ?? ""} (bleibt erhalten)`);
  if (d && d.samples > 0) items.push(`${d.samples} Proben des Beprobungsauftrags (bleiben erhalten)`);
  if (d && d.form_value_keys > 0) items.push(`Erfasste Listeninhalte (werden mit der Liste gelöscht, im Protokoll gesichert)`);

  return (
    <AlertDialog open={!!row} onOpenChange={(v) => !v && !del.isPending && onClose()}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>m³-Liste „{label}“ endgültig löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Es wird ausschließlich diese m³-Liste gelöscht. Versuche, Proben, Aufträge, Fertigungsfreigaben und Projekte bleiben erhalten.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-sm space-y-2">
          {preview.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verknüpfungen werden geprüft…</div>}
          {preview.isError && <div className="text-destructive">{(preview.error as any)?.message}</div>}
          {d && (
            <>
              <div className="font-medium">Vorhandene Verknüpfungen</div>
              {items.length === 0 ? <div className="text-muted-foreground">Keine Verknüpfungen vorhanden.</div> : (
                <ul className="list-disc pl-5 space-y-1">{items.map((t) => <li key={t}>{t}</li>)}</ul>
              )}
              <div className="text-muted-foreground">Zugehörige Versuche: keine (m³-Listen sind nicht mit Versuchen verknüpft).</div>
            </>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Abbrechen</AlertDialogCancel>
          <Button variant="destructive" disabled={!d || del.isPending} onClick={run}>
            {del.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}m³-Liste endgültig löschen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
