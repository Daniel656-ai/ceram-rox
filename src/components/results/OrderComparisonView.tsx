import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Columns3 } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { buildOrderComparison, type OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup } from "@/lib/results/sampleResultsAggregation";
import { formatResultLabel } from "@/lib/resultLabels";
import { InfoHint } from "@/components/results/InfoHint";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });

/** Proben eines Auftrags nebeneinander: je Analyseart eine Tabelle (nur offizielle Werte). */
export default function OrderComparisonView({
  order,
  onClose,
  onSelectSample,
}: {
  order: OrderGroup;
  onClose: () => void;
  onSelectSample: (sample: SampleGroup) => void;
}) {
  const sections = useMemo(() => buildOrderComparison(order), [order]);
  return (
    <div className="space-y-3">
      {/* Kopf in einer Zeile: Auftrag · Projekt · Schließen */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Columns3 className="h-4 w-4 shrink-0" />
          <span className="truncate text-base font-semibold">
            Auftrag <span className="font-mono">{order.displayNumber}</span>
            <span className="font-normal text-muted-foreground">
              {" "}· Projekt {order.projectNames.join(", ") || "–"}
            </span>
          </span>
          <InfoHint label="Hinweise zur Ergebnisübersicht">
            Je Analyseart eine Tabelle mit den Proben des Auftrags. Es werden nur offizielle Werte gezeigt.
            Klick auf eine Probe öffnet ihre Messungen.
          </InfoHint>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Seitenleiste schließen" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {sections.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Keine Messungen in diesem Auftrag.</p>
      )}
      {sections.map((sec) =>
        sec.columns.length === 0 ? (
          // Analyse ohne offizielle Werte: nur eine kurze Zeile statt einer großen Karte.
          <p
            key={sec.serviceName}
            className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="font-medium text-foreground">{sec.serviceName}</span> – noch keine offiziellen Werte
            {sec.interimCount > 0 ? ` (${sec.interimCount} vorläufig)` : ""}
          </p>
        ) : (
          <Card key={sec.serviceName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{sec.serviceName}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <HorizontalScrollArea className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left font-medium">Probe</th>
                      {sec.columns.map((c) => (
                        <th key={c.key} className="whitespace-nowrap p-2 text-right font-medium">
                          {formatResultLabel(c.label, c.unit)}
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
                        <td className="whitespace-nowrap p-2">
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
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
