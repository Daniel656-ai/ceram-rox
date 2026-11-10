import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, ChevronRight } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { formatSampleDate, type SampleGroup } from "@/lib/results/sampleResultsAggregation";

/**
 * Ebene 1: Probenübersicht. Dient ausschließlich der Navigation – die
 * Gruppierung verändert keine Messwerte.
 */
export default function SampleOverviewTable({
  groups,
  onSelect,
}: {
  groups: SampleGroup[];
  onSelect: (group: SampleGroup) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> Probenübersicht
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Eine Probe = eine Zeile · Klick öffnet alle Messungen der Probe
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Proben mit Ergebnissen für die aktuellen Filter.
          </p>
        ) : (
          <HorizontalScrollArea className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left font-medium">Probe</th>
                  <th className="p-2 text-left font-medium">Probenbezeichnung</th>
                  <th className="p-2 text-left font-medium">Projekt</th>
                  <th className="p-2 text-left font-medium">Auftrag</th>
                  <th className="p-2 text-right font-medium">Analysen</th>
                  <th className="p-2 text-right font-medium">Messwerte</th>
                  <th className="p-2 text-left font-medium">Letzte Aktivität</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr
                    key={g.sampleKey}
                    className="cursor-pointer border-t transition-colors hover:bg-muted/40"
                    onClick={() => onSelect(g)}
                  >
                    <td className="p-2 font-mono">
                      {g.sampleNumber || "–"}
                      {g.originalSampleNumber && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          (Ersatz für {g.originalSampleNumber})
                        </span>
                      )}
                    </td>
                    <td className="p-2">{g.sampleName || "–"}</td>
                    <td className="p-2">{g.projectNames.join(", ") || "–"}</td>
                    <td className="p-2 font-mono text-xs">{g.orderDisplayNumbers.join(", ") || "–"}</td>
                    <td className="p-2 text-right">{g.measurements.length}</td>
                    <td className="p-2 text-right">
                      <Badge variant="default" className="mr-1 text-[10px]">
                        {g.officialCount} offiziell
                      </Badge>
                      {g.interimCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {g.interimCount} vorläufig
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {formatSampleDate(g.lastActivityAt)}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
