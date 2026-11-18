import { Fragment, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import { formatSampleDate, type SampleGroup } from "@/lib/results/sampleResultsAggregation";
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
 * Übersicht nach Auftrag. Pfeil links klappt die Proben auf, Klick auf die
 * Auftragszeile öffnet die Ergebnisübersicht des Auftrags (Seitenleiste),
 * Klick auf eine Probe öffnet ihre Messungen.
 * `compact` (Seitenleiste offen): nur Auftrag/Probe und Messwerte, einzeilig.
 */
export default function OrderOverviewTable({
  orders,
  expanded,
  onToggle,
  onSelectSample,
  onOpenOverview,
  headerExtra,
  selected,
  compareOrderKey,
  compact = false,
}: {
  orders: OrderGroup[];
  expanded: Set<string>;
  onToggle: (orderKey: string) => void;
  onSelectSample: (order: OrderGroup, sample: SampleGroup) => void;
  onOpenOverview: (order: OrderGroup) => void;
  headerExtra?: ReactNode;
  /** Aktuell in der Seitenleiste geöffnete Probe bzw. Ergebnisübersicht (Markierung). */
  selected?: { orderKey: string | null; sampleKey: string } | null;
  compareOrderKey?: string | null;
  compact?: boolean;
}) {
  const isSel = (o: OrderGroup, s: SampleGroup) =>
    !!selected && selected.orderKey === o.orderKey && selected.sampleKey === s.sampleKey;

  const table = (
    <table className={`w-full text-sm ${compact ? "table-fixed" : ""}`}>
      <thead className="bg-muted/50">
        <tr>
          <th className="w-8 p-2" />
          <th className="p-2 text-left font-medium">Auftrag / Probe</th>
          {!compact && <th className="p-2 text-left font-medium">Projekt / Bezeichnung</th>}
          <th className={`p-2 text-left font-medium ${compact ? "w-[140px]" : ""}`}>Messarten</th>
          {!compact && <th className="p-2 text-right font-medium">Proben</th>}
          {!compact && <th className="p-2 text-right font-medium">Analysen</th>}
          <th className={`p-2 text-left font-medium ${compact ? "w-[200px]" : ""}`}>Messwerte</th>
          {!compact && <th className="p-2 text-left font-medium">Letzte Aktivität</th>}
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const open = expanded.has(o.orderKey);
          const orderSel = compareOrderKey === o.orderKey;
          return (
            <Fragment key={o.orderKey}>
              <tr
                className={`cursor-pointer border-t font-medium transition-colors hover:bg-muted/40 ${orderSel ? "bg-primary/10" : "bg-muted/20"}`}
                data-selected-row={orderSel ? "true" : undefined}
                onClick={() => onOpenOverview(o)}
                title="Ergebnisübersicht des Auftrags öffnen"
              >
                <td className="p-1 text-muted-foreground">
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-accent"
                    aria-label={open ? "Proben einklappen" : "Proben aufklappen"}
                    aria-expanded={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(o.orderKey);
                    }}
                  >
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </td>
                <td className="truncate whitespace-nowrap p-2 font-mono">
                  {o.displayNumber || "–"}
                  <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                    {o.samples.length} {o.samples.length === 1 ? "Probe" : "Proben"}
                  </span>
                </td>
                {!compact && <td className="p-2 font-normal">{o.projectNames.join(", ") || "–"}</td>}
                <td className="p-2 font-normal"><ServiceChips measurements={o.samples.flatMap((s) => s.measurements)} compact={compact} /></td>
                {!compact && <td className="p-2 text-right">{o.samples.length}</td>}
                {!compact && <td className="p-2 text-right">{o.measurementCount}</td>}
                <td className="whitespace-nowrap p-2 font-normal">
                  <ResultCountBadges official={o.officialCount} interim={o.interimCount} />
                </td>
                {!compact && (
                  <td className="p-2 text-xs font-normal text-muted-foreground">{formatSampleDate(o.lastActivityAt)}</td>
                )}
              </tr>
              {open &&
                o.samples.map((s) => (
                  <tr
                    key={`${o.orderKey}:${s.sampleKey}`}
                    className={`cursor-pointer border-t transition-colors hover:bg-muted/40 ${isSel(o, s) ? "bg-primary/10" : ""}`}
                    data-selected-row={isSel(o, s) ? "true" : undefined}
                    aria-selected={isSel(o, s)}
                    onClick={() => onSelectSample(o, s)}
                  >
                    <td className="p-2" />
                    <td className="truncate whitespace-nowrap p-2 pl-4" title={s.sampleName || undefined}>
                      <span className="font-mono">{s.sampleNumber || "–"}</span>
                      {s.originalSampleNumber && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(Ersatz für {s.originalSampleNumber})</span>
                      )}
                      {compact && s.sampleName && (
                        <span className="ml-2 text-xs text-muted-foreground">{s.sampleName}</span>
                      )}
                    </td>
                    {!compact && <td className="p-2">{s.sampleName || "–"}</td>}
                    <td className="p-2"><ServiceChips measurements={s.measurements} compact={compact} /></td>
                    {!compact && <td className="p-2" />}
                    {!compact && <td className="p-2 text-right">{s.measurements.length}</td>}
                    <td className="whitespace-nowrap p-2">
                      <ResultCountBadges official={s.officialCount} interim={s.interimCount} />
                    </td>
                    {!compact && (
                      <td className="p-2 text-xs text-muted-foreground">{formatSampleDate(s.lastActivityAt)}</td>
                    )}
                  </tr>
                ))}
            </Fragment>
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
              Pfeil links klappt die Proben eines Auftrags auf. Klick auf die Auftragszeile öffnet die
              Ergebnisübersicht des Auftrags, Klick auf eine Probe öffnet ihre Messungen. Die Chips zeigen die
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
