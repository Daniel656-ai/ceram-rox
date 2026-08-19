import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCorrectResultValue } from "@/hooks/useResultCorrections";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });

export interface CorrectionContext {
  resultId: string;
  parameterLabel: string;
  unit: string | null;
  currentValue: number | null;
  currentText: string | null;
  sampleNumber: string;
  sampleName?: string;
  orderNumber?: string;
  serviceName: string;
  analysisLabel: string;
}

/** Deutsche oder englische Zahleneingabe in eine Zahl überführen. */
function parseInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Korrektur eines einzelnen Messergebnisses mit Pflichtbegründung. */
export default function ResultCorrectionDialog({
  open,
  onOpenChange,
  context,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context: CorrectionContext | null;
}) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const correct = useCorrectResultValue();

  useEffect(() => {
    if (open && context) {
      setValue(context.currentValue !== null ? String(context.currentValue).replace(".", ",") : "");
      setReason("");
    }
  }, [open, context]);

  if (!context) return null;

  const parsed = parseInput(value);
  const reasonOk = reason.trim().length > 0;
  const valueOk = parsed !== null;
  const changed = parsed !== null && parsed !== context.currentValue;

  const submit = async () => {
    if (!valueOk || !reasonOk || !changed) return;
    try {
      await correct.mutateAsync({ resultId: context.resultId, newValue: parsed!, reason: reason.trim() });
      toast.success("Ergebnis korrigiert", { description: "Die Änderung wurde dokumentiert." });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Korrektur nicht möglich", { description: err?.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ergebnis korrigieren</DialogTitle>
          <DialogDescription>
            Der bisherige Wert bleibt in der Änderungshistorie dauerhaft erhalten.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-sm border rounded-md p-3 bg-muted/30">
          <dt className="text-muted-foreground">Probe</dt>
          <dd className="font-mono">
            {context.sampleNumber}
            {context.sampleName ? <span className="font-sans text-muted-foreground"> · {context.sampleName}</span> : null}
          </dd>
          {context.orderNumber && (
            <>
              <dt className="text-muted-foreground">Auftrag</dt>
              <dd className="font-mono">{context.orderNumber}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Dienstleistung</dt>
          <dd>{context.serviceName}</dd>
          <dt className="text-muted-foreground">Analyse</dt>
          <dd>{context.analysisLabel}</dd>
          <dt className="text-muted-foreground">Parameter</dt>
          <dd className="font-medium">{context.parameterLabel}</dd>
          <dt className="text-muted-foreground">Bisheriger Wert</dt>
          <dd className="font-mono">
            {context.currentValue !== null ? nf.format(context.currentValue) : context.currentText ?? "–"}
            {context.unit ? ` ${context.unit}` : ""}
          </dd>
        </dl>

        <div className="space-y-2">
          <Label htmlFor="new-value">
            Neuer Wert {context.unit ? <span className="text-muted-foreground">({context.unit})</span> : null}
          </Label>
          <Input
            id="new-value"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="z. B. 56,324"
          />
          {!valueOk && value.trim() !== "" && (
            <p className="text-xs text-destructive">Bitte einen gültigen numerischen Wert eingeben.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">
            Begründung der Änderung <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="z. B. Zahlendreher bei der manuellen Eingabe."
          />
          {!reasonOk && (
            <p className="text-xs text-muted-foreground">
              Ohne Begründung kann die Korrektur nicht gespeichert werden.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={!valueOk || !reasonOk || !changed || correct.isPending}>
            Korrektur speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
