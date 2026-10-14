import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  BLOCKER_LABELS, MIN_DELETE_REASON, canSubmitDelete, deleteErrorText, describeSideEffects,
} from "@/lib/measurementRun/deleteMeasurement";

/** Nur für ROX-Admin (Basisrolle master) eingeblendet; Server prüft verbindlich. */
export default function AdminDeleteMeasurementsCard({ orderId, measurements }: { orderId: string; measurements: any[] }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ["measurement-delete-preview", target?.id],
    queryFn: () => api.measurements.previewDelete(target!.id),
    enabled: !!target,
    staleTime: 0,
  });

  if (!measurements.length) return null;

  const close = () => { setTarget(null); setReason(""); };
  const submit = async () => {
    setBusy(true);
    try {
      await api.measurements.deleteWithReason(target.id, reason.trim());
      // Leistung entfernt: Regel „Mundstück 293/1“ anwenden.
      try { await api.mundstueck293.syncOrder(orderId); } catch (err) { console.warn("Mundstück 293/1", err); }
      toast.success(`Dienstleistung ${target.measurement_number ?? ""} gelöscht`);
      close();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["order", orderId] }),
        qc.invalidateQueries({ queryKey: ["order-audit-log", orderId] }),
      ]);
    } catch (e: any) {
      toast.error(deleteErrorText(e?.message ?? ""));
      qc.invalidateQueries({ queryKey: ["measurement-delete-preview", target?.id] });
    } finally {
      setBusy(false);
    }
  };

  const blockers: string[] = preview?.blockers ?? [];
  const effects = preview ? describeSideEffects(preview.counts ?? {}) : [];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Dienstleistungen verwalten (Admin)</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {measurements.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{m.measurement_number ?? "—"} · {m.measurement_services?.service_name ?? "Dienstleistung"} · {m.status}</span>
            <Button variant="ghost" size="sm" onClick={() => setTarget(m)} aria-label="Dienstleistung löschen">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dienstleistung löschen: {target?.measurement_number}</DialogTitle>
          </DialogHeader>
          {isLoading && <p className="text-sm text-muted-foreground">Abhängigkeiten werden geprüft …</p>}
          {error && <p className="text-sm text-destructive">{deleteErrorText((error as any).message)}</p>}
          {preview && (
            <div className="space-y-3 text-sm">
              <p>Auftrag {preview.order_number} · {preview.service_name} · Status {preview.status}</p>
              {blockers.length > 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="font-medium">Löschen nicht möglich:</p>
                  <ul className="list-disc pl-5">{blockers.map((b) => <li key={b}>{BLOCKER_LABELS[b] ?? b}</li>)}</ul>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium">Automatische Folgen:</p>
                    {effects.length ? (
                      <ul className="list-disc pl-5">{effects.map((e) => <li key={e}>{e}</li>)}</ul>
                    ) : <p className="text-muted-foreground">Keine weiteren abhängigen Daten.</p>}
                  </div>
                  <div>
                    <Label>Begründung * (mind. {MIN_DELETE_REASON} Zeichen)</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                    <p className="text-xs text-muted-foreground">{reason.trim().length} Zeichen</p>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close}>Abbrechen</Button>
            <Button variant="destructive" disabled={busy || !canSubmitDelete(!!preview?.allowed, reason)} onClick={submit}>
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
