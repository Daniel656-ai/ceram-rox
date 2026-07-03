import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatQuantity } from "@/lib/formatQuantity";
import { toast } from "@/hooks/use-toast";
import {
  useBatchWeighings,
  useBatchCorrections,
  useCorrectWeighing,
  useCorrectProducedQuantity,
} from "@/hooks/useMixtures";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: any;
  mixtureId?: string;
}

export function EditBatchDialog({ open, onOpenChange, batch, mixtureId }: Props) {
  const { data: weighings = [] } = useBatchWeighings(batch?.id);
  const { data: corrections = [] } = useBatchCorrections(batch?.id);
  const correctWeighing = useCorrectWeighing(mixtureId, batch?.id);
  const correctQty = useCorrectProducedQuantity(mixtureId, batch?.id);

  const [rows, setRows] = useState<Record<string, { actual: string; notes: string }>>({});
  const [prodQty, setProdQty] = useState<string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    const init: typeof rows = {};
    for (const w of weighings as any[]) {
      init[w.id] = { actual: String(w.actual_quantity ?? ""), notes: w.notes ?? "" };
    }
    setRows(init);
    setProdQty(String(batch?.produced_quantity ?? ""));
    setReason("");
  }, [open, weighings, batch]);

  const isFinalized = batch?.status === "abgeschlossen" || batch?.execution_status === "abgeschlossen";

  const handleSave = async () => {
    if (!reason.trim()) {
      toast({ title: "Grund erforderlich", description: "Bitte Grund für Korrektur angeben.", variant: "destructive" });
      return;
    }
    try {
      // Weighing changes
      for (const w of weighings as any[]) {
        const r = rows[w.id];
        if (!r) continue;
        const newQty = Number(r.actual || 0);
        const notesChanged = (r.notes ?? "") !== (w.notes ?? "");
        const qtyChanged = newQty !== Number(w.actual_quantity ?? 0);
        if (notesChanged || qtyChanged) {
          await correctWeighing.mutateAsync({
            weighing_id: w.id,
            new_actual_quantity: newQty,
            new_container_id: w.container_id,
            new_notes: r.notes || null,
            reason,
          });
        }
      }
      // Produced quantity change
      const newProd = Number(prodQty || 0);
      if (newProd !== Number(batch?.produced_quantity ?? 0)) {
        await correctQty.mutateAsync({
          batch_id: batch.id,
          new_produced_quantity: newProd,
          reason,
        });
      }
      toast({ title: "Korrektur gespeichert" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Charge korrigieren – {batch?.batch_number}{" "}
            {isFinalized && <Badge variant="secondary" className="ml-2">abgeschlossen</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isFinalized && (
            <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
              Diese Charge ist bereits abgeschlossen. Mengenänderungen werden automatisch als Delta ins Lager gebucht.
            </div>
          )}

          <div>
            <Label className="text-sm font-semibold">Verwiegungen</Label>
            <div className="space-y-2 mt-2">
              {(weighings as any[]).map((w) => {
                const r = rows[w.id] || { actual: "", notes: "" };
                return (
                  <div key={w.id} className="border rounded p-3 bg-muted/20 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <div className="font-medium text-sm">{w.raw_materials?.material_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Soll: {formatQuantity(w.target_quantity)} {w.unit}
                        {w.container_code_snapshot && <> · {w.container_code_snapshot}</>}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Ist-Menge ({w.unit})</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={r.actual}
                        onChange={(e) => setRows((s) => ({ ...s, [w.id]: { ...r, actual: e.target.value } }))}
                      />
                    </div>
                    <div className="col-span-5">
                      <Label className="text-xs">Notiz</Label>
                      <Input
                        value={r.notes}
                        onChange={(e) => setRows((s) => ({ ...s, [w.id]: { ...r, notes: e.target.value } }))}
                      />
                    </div>
                  </div>
                );
              })}
              {(weighings as any[]).length === 0 && (
                <div className="text-sm text-muted-foreground">Keine Verwiegungen erfasst.</div>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Hergestellte Menge ({batch?.unit})</Label>
              <Input
                type="number"
                step="0.001"
                value={prodQty}
                onChange={(e) => setProdQty(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Grund für Korrektur *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="z. B. Nachwiegen ergab Abweichung"
              />
            </div>
          </div>

          {(corrections as any[]).length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-sm font-semibold">Korrekturhistorie</Label>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto text-xs">
                  {(corrections as any[]).map((c) => (
                    <div key={c.id} className="flex justify-between border-b py-1">
                      <div>
                        <span className="font-mono">{c.field}</span>: {c.old_value ?? "—"} → {c.new_value ?? "—"}
                        {c.delta != null && <span className="text-muted-foreground"> (Δ {formatQuantity(c.delta)})</span>}
                        <div className="text-muted-foreground">{c.reason}</div>
                      </div>
                      <div className="text-right text-muted-foreground whitespace-nowrap">
                        {c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : ""}
                        <br />
                        {format(new Date(c.created_at), "dd.MM.yy HH:mm")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            onClick={handleSave}
            disabled={!reason.trim() || correctWeighing.isPending || correctQty.isPending}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
