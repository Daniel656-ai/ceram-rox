import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { diffAgainstBaseline } from "@/lib/orderTemplateCopy";
import type { OrderDraftPayload } from "@/lib/api/orderDrafts";

interface Props {
  baseline: OrderDraftPayload | null | undefined;
  current: OrderDraftPayload;
  sourceLabel?: string | null;
  serviceCount: number;
  sampleCount: number;
  requiresSamples: boolean;
}

/** Prüfbereich vor dem Absenden eines aus einer Vorlage erstellten Auftrags. */
export default function TemplateReviewPanel({
  baseline, current, sourceLabel, serviceCount, sampleCount, requiresSamples,
}: Props) {
  const { copiedCount, changed } = diffAgainstBaseline(baseline, current);

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Auftrag prüfen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Dieser Auftrag wurde aus einer Vorlage erstellt
            {sourceLabel ? ` (${sourceLabel})` : ""}. Bitte prüfen Sie die übernommenen Angaben.
          </AlertDescription>
        </Alert>

        <ul className="space-y-1.5 text-sm">
          <li className="flex items-start gap-2">
            {serviceCount > 0
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />}
            <span>{serviceCount} Dienstleistung(en) ausgewählt</span>
          </li>
          <li className="flex items-start gap-2">
            {!requiresSamples || sampleCount > 0
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />}
            <span>
              {sampleCount > 0 ? `${sampleCount} Probe(n) ausgewählt` : "Keine Probe ausgewählt"}
            </span>
          </li>
          {copiedCount > 0 && (
            <li className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
              <span>{copiedCount} Angabe(n) wurden aus einer Vorlage übernommen</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            {changed.length > 0
              ? <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
              : <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />}
            <span>
              {changed.length > 0
                ? `${changed.length} Angabe(n) wurden gegenüber der Vorlage geändert`
                : "Keine Angabe gegenüber der Vorlage geändert"}
            </span>
          </li>
        </ul>

        {changed.length > 0 && (
          <div className="rounded-md border divide-y text-xs">
            {changed.map((c, i) => (
              <div key={`${c.uid}-${c.fieldKey}-${i}`} className="px-3 py-1.5">
                <span className="font-medium">{c.serviceName}</span>
                <span className="text-muted-foreground"> · {c.fieldKey}: </span>
                <span className="text-muted-foreground line-through">{c.baseline || "–"}</span>
                <span className="mx-1">→</span>
                <span>{c.current || "–"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
