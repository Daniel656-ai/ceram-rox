import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Sigma } from "lucide-react";
import { toast } from "sonner";
import { findChannel, type MeasurementDataset } from "@/lib/curves/dataset";
import { applicableEvaluations, type EvaluationOutcome } from "@/lib/curves/evaluations";
import type { CurveSelection } from "./CurveViewer";

export interface CurveEvaluationProvenance {
  method: string;
  methodLabel: string;
  xChannel: string;
  xUnit: string | null;
  yChannel: string;
  yUnit: string | null;
  from: number;
  to: number;
  value: number;
  unit: string | null;
  formula: string;
  details: { label: string; value: string }[];
  resultLabel: string;
}

interface Props {
  dataset: MeasurementDataset;
  selection: CurveSelection | null;
  /** Vom Messfall erlaubte Auswertungen (leer/none = alle). */
  allowedEvaluations?: string[] | null;
  /**
   * Übernahme als offizielles Ergebnis. Erst nach Prüfung durch den Benutzer.
   * Die aufrufende Stelle entscheidet, wie das Ergebnis gespeichert wird
   * (bestehende Ergebnislogik – es entsteht keine zweite Ergebnisdatenbank).
   */
  onAdoptOfficial?: (provenance: CurveEvaluationProvenance) => Promise<void> | void;
}

const fmtValue = (v: number) =>
  Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0)
    ? v.toExponential(4).replace(".", ",")
    : v.toLocaleString("de-AT", { maximumFractionDigits: 6 });

export default function CurveEvaluationPanel({
  dataset, selection, allowedEvaluations, onAdoptOfficial,
}: Props) {
  const [methodId, setMethodId] = useState<string>("");
  const [outcome, setOutcome] = useState<EvaluationOutcome | null>(null);
  const [resultLabel, setResultLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [adopted, setAdopted] = useState(false);

  const yKey = selection?.yKeys[0] ?? null;

  const available = useMemo(() => {
    if (!selection || !yKey) return [];
    return applicableEvaluations(dataset, selection.xKey, yKey, allowedEvaluations ?? null);
  }, [dataset, selection, yKey, allowedEvaluations]);

  const method = available.find((e) => e.id === methodId) ?? null;

  const run = () => {
    if (!selection || !yKey || !method) return;
    const res = method.run({ dataset, xKey: selection.xKey, yKey, from: selection.from, to: selection.to });
    setOutcome(res);
    setAdopted(false);
    if (!resultLabel) setResultLabel(`${method.label} (${findChannel(dataset, yKey)?.label ?? yKey})`);
    if (res.error) toast.error(res.error);
  };

  const adopt = async () => {
    if (!selection || !yKey || !method || !outcome || outcome.value == null) return;
    setBusy(true);
    try {
      await onAdoptOfficial?.({
        method: method.id,
        methodLabel: method.label,
        xChannel: selection.xKey,
        xUnit: findChannel(dataset, selection.xKey)?.unit ?? null,
        yChannel: yKey,
        yUnit: findChannel(dataset, yKey)?.unit ?? null,
        from: selection.from,
        to: selection.to,
        value: outcome.value,
        unit: outcome.unit,
        formula: outcome.formula,
        details: outcome.details,
        resultLabel: resultLabel.trim() || method.label,
      });
      setAdopted(true);
    } catch (e) {
      toast.error(`Übernahme fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!selection || !yKey) {
    return <p className="text-xs text-muted-foreground">Bitte eine Messkurve auswählen.</p>;
  }

  const xUnit = findChannel(dataset, selection.xKey)?.unit ?? "";
  const yLabel = findChannel(dataset, yKey)?.label ?? yKey;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1 min-w-56 flex-1">
          <Label className="text-xs">Auswertung</Label>
          <Select value={methodId} onValueChange={(v) => { setMethodId(v); setOutcome(null); }}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Berechnung wählen" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {available.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={!method} onClick={run}>
          <Sigma className="h-3.5 w-3.5 mr-1" /> Berechnen
        </Button>
      </div>

      {method && <p className="text-[11px] text-muted-foreground">{method.description}</p>}

      {outcome && !outcome.error && outcome.value != null && (
        <div className="rounded border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {fmtValue(outcome.value)}{outcome.unit ? ` ${outcome.unit}` : ""}
            </span>
            <Badge variant="secondary">{method?.label}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <dt className="text-muted-foreground">Messkurve</dt>
            <dd>{yLabel}</dd>
            <dt className="text-muted-foreground">Bereich</dt>
            <dd>{fmtValue(selection.from)}–{fmtValue(selection.to)} {xUnit}</dd>
            <dt className="text-muted-foreground">Berechnung</dt>
            <dd className="font-mono">{outcome.formula}</dd>
            {outcome.details.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="font-mono">{d.value}</dd>
              </div>
            ))}
          </dl>

          {onAdoptOfficial && (
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="space-y-1 flex-1 min-w-48">
                <Label className="text-xs">Bezeichnung des Ergebnisses</Label>
                <Input className="h-8" value={resultLabel} onChange={(e) => setResultLabel(e.target.value)} />
              </div>
              <Button type="button" size="sm" disabled={busy || adopted} onClick={() => void adopt()}>
                {adopted
                  ? (<><Check className="h-3.5 w-3.5 mr-1" /> übernommen</>)
                  : "Als offizielles Ergebnis übernehmen"}
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Die Übernahme erfolgt erst nach Ihrer Prüfung. Spätere Änderungen laufen über die
            bestehende Korrektur- und Dokumentationslogik der Ergebnisdatenbank.
          </p>
        </div>
      )}

      {outcome?.error && <p className="text-xs text-destructive">{outcome.error}</p>}
    </div>
  );
}
