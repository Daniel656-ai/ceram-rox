import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { formatSampleDate } from "@/lib/results/sampleResultsAggregation";
import type { OrderGroup } from "@/lib/results/orderGroups";
import { InfoHint } from "@/components/results/InfoHint";
import { ResultCountBadges } from "@/components/results/ResultCountBadges";
import ServiceChips from "@/components/results/ServiceChips";

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
 * Übersicht nach Auftrag: nur Aufträge. Klick auf die Auftragszeile öffnet rechts die Ergebnisübersicht
 * des Auftrags mit allen Proben und Werten; von dort aus öffnet man die Details einer Probe.
 * `compact` (Seitenleiste offen): nur Auftrag und Messwerte, einzeilig.
 */
export default function OrderOverviewTable({
  orders,
  onOpenOverview,
  headerExtra,
  compareOrderKey,
  compact = false,
}: {
  orders: OrderGroup[];
  onOpenOverview: (order: OrderGroup) => void;
  headerExtra?: ReactNode;
  compareOrderKey?: string | null;
  compact?: boolean;
}) {
  const table = (
    <table className={`w-full text-sm ${compact ? "table-fixed" : ""}`}>
      <thead className="bg-muted/50">
        <tr>
          <th className="p-2 text-left font-medium">Auftrag</th>
          {!compact && <th className="p-2 text-left font-medium">Projekt / Bezeichnung</th>}
          <th className={`p-2 text-left font-medium ${compact ? "w-[140px]" : ""}`}>Messarten</th>
          <th className={`p-2 text-left font-medium ${compact ? "w-[200px]" : ""}`}>Messwerte</th>
          {!compact && <th className="p-2 text-left font-medium">Letzte Aktivität</th>}
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const orderSel = compareOrderKey === o.orderKey;
          return (
            <tr
              key={o.orderKey}
                className={`cursor-pointer border-t font-medium transition-colors hover:bg-muted/40 ${orderSel ? "bg-primary/10" : "bg-muted/20"}`}
                data-selected-row={orderSel ? "true" : undefined}
                onClick={() => onOpenOverview(o)}
                title="Ergebnisübersicht des Auftrags öffnen"
              >
                <td className="truncate whitespace-nowrap p-2 font-mono">
                  {o.displayNumber || "–"}
                  <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                    {o.samples.length} {o.samples.length === 1 ? "Probe" : "Proben"}
                  </span>
                </td>
                {!compact && <td className="p-2 font-normal">{o.projectNames.join(", ") || "–"}</td>}
                <td className="p-2 font-normal"><ServiceChips measurements={o.samples.flatMap((s) => s.measurements)} compact={compact} /></td>
                <td className="whitespace-nowrap p-2 font-normal">
                  <ResultCountBadges official={o.officialCount} interim={o.interimCount} />
                </td>
                {!compact && (
                  <td className="p-2 text-xs font-normal text-muted-foreground">{formatSampleDate(o.lastActivityAt)}</td>
                )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Aufträge
            <InfoHint label="Hinweise zur Auftragsliste">
              Klick auf einen Auftrag öffnet rechts die Ergebnisübersicht mit allen Proben und Werten; dort
              öffnet ein Klick auf eine Probe ihre Details. Die Chips zeigen die
              Messarten; ein Klick darauf zeigt Anzahl offizieller und vorläufiger Werte je Messart.
            </InfoHint>
          </CardTitle>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Aufträge mit Ergebnissen für die aktuellen Filter.
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
