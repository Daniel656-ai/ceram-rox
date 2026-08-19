import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useReassignMeasurementSample } from "@/hooks/useResultCorrections";

export interface ReassignContext {
  measurementId: string;
  measurementNumber: string;
  orderId: string;
  orderNumber?: string;
  serviceName: string;
  analysisLabel: string;
  currentSampleId: string | null;
  currentSampleNumber: string;
  resultCount: number;
}

/**
 * Ordnet einen kompletten Messdatensatz einer anderen – für den Auftrag
 * zulässigen – Probe zu. Die Messwerte selbst bleiben unverändert.
 */
export default function SampleReassignDialog({
  open,
  onOpenChange,
  context,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context: ReassignContext | null;
}) {
  const [sampleId, setSampleId] = useState("__none__");
  const [reason, setReason] = useState("");
  const reassign = useReassignMeasurementSample();

  const { data: orderSampleRows = [] } = useQuery({
    queryKey: ["order-samples", context?.orderId],
    queryFn: () => api.orderSamples.list(context!.orderId) as Promise<any[]>,
    enabled: open && !!context?.orderId,
  });

  useEffect(() => {
    if (open) {
      setSampleId("__none__");
      setReason("");
    }
  }, [open]);

  if (!context) return null;

  const options = (orderSampleRows as any[])
    .map((r) => r.samples)
    .filter((s) => s && s.id !== context.currentSampleId);

  const reasonOk = reason.trim().length > 0;
  const sampleOk = sampleId !== "__none__";

  const submit = async () => {
    if (!sampleOk || !reasonOk) return;
    try {
      await reassign.mutateAsync({
        measurementId: context.measurementId,
        newSampleId: sampleId,
        reason: reason.trim(),
      });
      toast.success("Probenzuordnung geändert", { description: "Die Änderung wurde dokumentiert." });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Umzuordnung nicht möglich", { description: err?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Probenzuordnung korrigieren</DialogTitle>
          <DialogDescription>
            Der gesamte Messdatensatz wird gemeinsam einer anderen Probe zugeordnet. Die Messwerte
            bleiben unverändert erhalten.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 text-sm border rounded-md p-3 bg-muted/30">
          {context.orderNumber && (
            <>
              <dt className="text-muted-foreground">Auftrag</dt>
              <dd className="font-mono">{context.orderNumber}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Dienstleistung</dt>
          <dd>{context.serviceName}</dd>
          <dt className="text-muted-foreground">Messdatensatz</dt>
          <dd>
            {context.analysisLabel} <span className="font-mono text-xs">{context.measurementNumber}</span>
          </dd>
          <dt className="text-muted-foreground">Aktuelle Probe</dt>
          <dd className="font-mono">{context.currentSampleNumber}</dd>
          <dt className="text-muted-foreground">Betroffene Ergebnisse</dt>
          <dd>{context.resultCount}</dd>
        </dl>

        <div className="space-y-2">
          <Label>
            Neue Probe <span className="text-destructive">*</span>
          </Label>
          <Select value={sampleId} onValueChange={setSampleId}>
            <SelectTrigger>
              <SelectValue placeholder="Probe des Auftrags wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" disabled>
                Probe des Auftrags wählen
              </SelectItem>
              {options.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.sample_number} · {s.sample_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Für diesen Auftrag ist keine weitere zulässige Probe verfügbar.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reassign-reason">
            Begründung der Umzuordnung <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reassign-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z. B. Messdatensatz wurde beim Import versehentlich der falschen Probe zugeordnet."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={!sampleOk || !reasonOk || reassign.isPending}>
            Umzuordnung speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
