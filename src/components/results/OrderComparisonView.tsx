import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Columns3 } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { buildOrderComparison, type OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup } from "@/lib/results/sampleResultsAggregation";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });

/** Proben eines Auftrags nebeneinander: je Analyseart eine Tabelle (nur offizielle Werte). */
export default function OrderComparisonView({
  order,
  onBack,
  onSelectSample,
}: {
  order: OrderGroup;
  onBack: () => void;
  onSelectSample: (sample: SampleGroup) => void;
}) {
  const sections = useMemo(() => buildOrderComparison(order), [order]);
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Zurück zur Übersicht
      </Button>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <Columns3 className="h-4 w-4" /> Auftrag <span className="font-mono">{order.displayNumber}</span>
            <span className="font-normal text-muted-foreground">· Probenvergleich</span>
            <Badge variant="outline" className="text-[10px]">{order.samples.length} Proben</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Projekt: {order.projectNames.join(", ") || "–"} · nur offizielle Werte · Klick auf eine Probe öffnet ihre Details
          </p>
        </CardHeader>
      </Card>
      {sections.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Keine Messungen in diesem Auftrag.</p>
      )}
      {sections.map((sec) => (
        <Card key={sec.serviceName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{sec.serviceName}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {sec.columns.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine offiziellen Werte.</p>
            ) : (
              <HorizontalScrollArea className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left font-medium">Probe</th>
                      {sec.columns.map((c) => (
                        <th key={c.key} className="p-2 text-right font-medium whitespace-nowrap">
                          {c.label}
                          {c.unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">[{c.unit}]</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((row, i) => (
                      <tr
                        key={`${row.sample.sampleKey}-${i}`}
                        className="cursor-pointer border-t hover:bg-muted/40"
                        onClick={() => onSelectSample(row.sample)}
                      >
                        <td className="p-2 whitespace-nowrap">
                          <span className="font-mono">{row.sample.sampleNumber || "–"}</span>
                          {row.sample.sampleName && (
                            <span className="ml-1 text-xs text-muted-foreground">{row.sample.sampleName}</span>
                          )}
                        </td>
                        {sec.columns.map((c) => {
                          const vals = row.cells[c.key];
                          return (
                            <td key={c.key} className="p-2 text-right font-mono">
                              {vals && vals.length
                                ? vals.map((v) => (typeof v === "number" ? nf.format(v) : v)).join(" / ")
                                : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </HorizontalScrollArea>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
