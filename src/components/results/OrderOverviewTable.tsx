import { Fragment, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ClipboardList, Columns3 } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { formatSampleDate, type SampleGroup } from "@/lib/results/sampleResultsAggregation";
import type { OrderGroup } from "@/lib/results/orderGroups";

export type OverviewMode = "order" | "sample";

/** Umschalter Auftrag/Probe. */
export function OverviewModeToggle({ mode, onChange }: { mode: OverviewMode; onChange: (m: OverviewMode) => void }) {
  const btn = (m: OverviewMode, label: string) => (
    <Button
      type="button"
      size="sm"
      variant={mode === m ? "default" : "outline"}
      className="h-7 text-xs"
      aria-pressed={mode === m}
      onClick={() => onChange(m)}
    >
      {label}
    </Button>
  );
  return (
    <div className="flex gap-1" role="group" aria-label="Gruppierung">
      {btn("order", "Nach Auftrag")}
      {btn("sample", "Nach Probe")}
    </div>
  );
}

/**
 * Übersicht nach Auftrag: Auftragszeile aufklappbar, darunter die Proben.
 * Klick auf eine Probe öffnet ihre Messungen, „Ergebnisübersicht“ die Ergebnistabelle des Auftrags.
 */
export default function OrderOverviewTable({
  orders,
  expanded,
  onToggle,
  onSelectSample,
  onCompare,
  headerExtra,
}: {
  orders: OrderGroup[];
  expanded: Set<string>;
  onToggle: (orderKey: string) => void;
  onSelectSample: (order: OrderGroup, sample: SampleGroup) => void;
  onCompare: (order: OrderGroup) => void;
  headerExtra?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Aufträge
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Auftrag aufklappen für die Proben · Klick auf eine Probe öffnet ihre Messungen
            </span>
          </CardTitle>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Aufträge mit Ergebnissen für die aktuellen Filter.
          </p>
        ) : (
          <HorizontalScrollArea className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 w-8" />
                  <th className="p-2 text-left font-medium">Auftrag / Probe</th>
                  <th className="p-2 text-left font-medium">Projekt / Bezeichnung</th>
                  <th className="p-2 text-right font-medium">Proben</th>
                  <th className="p-2 text-right font-medium">Analysen</th>
                  <th className="p-2 text-right font-medium">Messwerte</th>
                  <th className="p-2 text-left font-medium">Letzte Aktivität</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const open = expanded.has(o.orderKey);
                  return (
                    <Fragment key={o.orderKey}>
                      <tr
                        className="cursor-pointer border-t bg-muted/20 font-medium transition-colors hover:bg-muted/40"
                        onClick={() => onToggle(o.orderKey)}
                        aria-expanded={open}
                      >
                        <td className="p-2 text-muted-foreground">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="p-2 font-mono">{o.displayNumber || "–"}</td>
                        <td className="p-2 font-normal">{o.projectNames.join(", ") || "–"}</td>
                        <td className="p-2 text-right">{o.samples.length}</td>
                        <td className="p-2 text-right">{o.measurementCount}</td>
                        <td className="p-2 text-right font-normal">
                          <Badge variant="default" className="mr-1 text-[10px]">{o.officialCount} offiziell</Badge>
                          {o.interimCount > 0 && (
                            <Badge variant="secondary" className="text-[10px]">{o.interimCount} vorläufig</Badge>
                          )}
                        </td>
                        <td className="p-2 text-xs font-normal text-muted-foreground">{formatSampleDate(o.lastActivityAt)}</td>
                        <td className="p-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompare(o);
                            }}
                          >
                            <Columns3 className="mr-1 h-3.5 w-3.5" /> Ergebnisübersicht
                          </Button>
                        </td>
                      </tr>
                      {open &&
                        o.samples.map((s) => (
                          <tr
                            key={`${o.orderKey}:${s.sampleKey}`}
                            className="cursor-pointer border-t transition-colors hover:bg-muted/40"
                            onClick={() => onSelectSample(o, s)}
                          >
                            <td className="p-2" />
                            <td className="p-2 pl-6 font-mono">
                              {s.sampleNumber || "–"}
                              {s.originalSampleNumber && (
                                <span className="ml-1 text-[10px] text-muted-foreground">(Ersatz für {s.originalSampleNumber})</span>
                              )}
                            </td>
                            <td className="p-2">{s.sampleName || "–"}</td>
                            <td className="p-2" />
                            <td className="p-2 text-right">{s.measurements.length}</td>
                            <td className="p-2 text-right">
                              <Badge variant="default" className="mr-1 text-[10px]">{s.officialCount} offiziell</Badge>
                              {s.interimCount > 0 && (
                                <Badge variant="secondary" className="text-[10px]">{s.interimCount} vorläufig</Badge>
                              )}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">{formatSampleDate(s.lastActivityAt)}</td>
                            <td className="p-2 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </HorizontalScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
