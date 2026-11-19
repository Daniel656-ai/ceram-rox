import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical, ChevronRight } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { formatSampleDate, type SampleGroup } from "@/lib/results/sampleResultsAggregation";
import { InfoHint } from "@/components/results/InfoHint";
import { ResultCountBadges } from "@/components/results/ResultCountBadges";
import ServiceChips from "@/components/results/ServiceChips";
import SampleLabel from "@/components/results/SampleLabel";

/**
 * Ebene 1: Probenübersicht. Dient ausschließlich der Navigation – die
 * Gruppierung verändert keine Messwerte.
 * `compact` (Seitenleiste offen): nur Probe und Messwerte, einzeilig.
 */
export default function SampleOverviewTable({
  groups,
  headerExtra,
  onSelect,
  selectedSampleKey,
  compact = false,
}: {
  groups: SampleGroup[];
  onSelect: (group: SampleGroup) => void;
  headerExtra?: ReactNode;
  selectedSampleKey?: string | null;
  compact?: boolean;
}) {
  const table = (
    <table className={`w-full text-sm ${compact ? "table-fixed" : ""}`}>
      <thead className="bg-muted/50">
        <tr>
          <th className="p-2 text-left font-medium">Probe</th>
          {!compact && <th className="p-2 text-left font-medium">Projekt</th>}
          {!compact && <th className="p-2 text-left font-medium">Auftrag</th>}
          <th className={`p-2 text-left font-medium ${compact ? "w-[140px]" : ""}`}>Messarten</th>
          <th className={`p-2 text-left font-medium ${compact ? "w-[200px]" : ""}`}>Messwerte</th>
          {!compact && <th className="p-2 text-left font-medium">Letzte Aktivität</th>}
          {!compact && <th className="p-2" />}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr
            key={g.sampleKey}
            className={`cursor-pointer border-t transition-colors hover:bg-muted/40 ${g.sampleKey === selectedSampleKey ? "bg-primary/10" : ""}`}
            data-selected-row={g.sampleKey === selectedSampleKey ? "true" : undefined}
            aria-selected={g.sampleKey === selectedSampleKey}
            onClick={() => onSelect(g)}
          >
            <td className={`p-2 ${compact ? "truncate whitespace-nowrap" : ""}`} title={g.sampleName || undefined}>
              <SampleLabel number={g.sampleNumber} name={g.sampleName} />
              {g.originalSampleNumber && (
                <span className="ml-1 text-[10px] text-muted-foreground">(Ersatz für {g.originalSampleNumber})</span>
              )}
            </td>
            {!compact && <td className="p-2">{g.projectNames.join(", ") || "–"}</td>}
            {!compact && <td className="p-2 font-mono text-xs">{g.orderDisplayNumbers.join(", ") || "–"}</td>}
            <td className="p-2"><ServiceChips measurements={g.measurements} compact={compact} /></td>
            <td className="whitespace-nowrap p-2">
              <ResultCountBadges official={g.officialCount} interim={g.interimCount} />
            </td>
            {!compact && <td className="p-2 text-xs text-muted-foreground">{formatSampleDate(g.lastActivityAt)}</td>}
            {!compact && (
              <td className="p-2 text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" /> Probenübersicht
            <InfoHint label="Hinweise zur Probenübersicht">
              Eine Probe = eine Zeile. Klick öffnet alle Messungen der Probe. Die Chips zeigen die Messarten; ein Klick darauf zeigt Anzahl offizieller und vorläufiger Werte je Messart.
            </InfoHint>
          </CardTitle>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Proben mit Ergebnissen für die aktuellen Filter.
          </p>
        ) : compact ? (
          <div className="overflow-hidden rounded-md border">{table}</div>
        ) : (
          <HorizontalScrollArea className="rounded-md border">{table}</HorizontalScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
