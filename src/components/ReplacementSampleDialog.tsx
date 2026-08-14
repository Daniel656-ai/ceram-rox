import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SampleSelector from "@/components/SampleSelector";

export const REPLACEMENT_REASONS = [
  "Probekörper beschädigt",
  "Probekörper bei Präparation gebrochen",
  "Falsche/andere Seriennummer angeliefert",
  "Probe nicht auffindbar",
  "Sonstiger Grund",
] as const;

/**
 * Bucht eine Ersatzprobe für eine bestehende Auftrags-Probenzuordnung.
 * Die ursprüngliche Zuordnung bleibt unverändert erhalten.
 */
export default function ReplacementSampleDialog({
  open,
  onOpenChange,
  orderId,
  projectId,
  originalSampleId,
  originalSampleNumber,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  projectId?: string;
  originalSampleId: string;
  originalSampleNumber: string;
}) {
  const qc = useQueryClient();
  const [replacementId, setReplacementId] = useState<string>("");
  const [reason, setReason] = useState<string>(REPLACEMENT_REASONS[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setReplacementId("");
    setReason(REPLACEMENT_REASONS[0]);
    setNote("");
  };

  const submit = async () => {
    if (!replacementId) {
      toast.error("Bitte Ersatzprobe auswählen");
      return;
    }
    if (replacementId === originalSampleId) {
      toast.error("Die Ersatzprobe muss sich von der ursprünglichen Probe unterscheiden");
      return;
    }
    if (reason === "Sonstiger Grund" && !note.trim()) {
      toast.error("Bitte Bemerkung zum sonstigen Grund angeben");
      return;
    }
    setSaving(true);
    try {
      await api.orderSamples.bookReplacement({
        orderId,
        originalSampleId,
        replacementSampleId: replacementId,
        reason,
        note: note.trim() || null,
      });
      toast.success("Ersatzprobe gebucht");
      qc.invalidateQueries({ queryKey: ["order-samples", orderId] });
      qc.invalidateQueries({ queryKey: ["order-results-overview", orderId] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["measurements"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Ersatzprobe konnte nicht gebucht werden", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ersatzprobe buchen</DialogTitle>
          <DialogDescription>
            Ursprüngliche Probe <span className="font-mono">{originalSampleNumber}</span> bleibt im
            Auftrag erhalten und wird mit der Ersatzprobe verknüpft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tatsächlich verwendete Probe</Label>
            <SampleSelector
              value={replacementId}
              onSelect={(v: string) => setReplacementId(v)}
              projectId={projectId}
            />
          </div>

          <div className="space-y-2">
            <Label>Grund für Ersatzprobe</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPLACEMENT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Bemerkung{reason === "Sonstiger Grund" ? " (erforderlich)" : " (optional)"}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Wird gebucht…" : "Ersatzprobe buchen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
