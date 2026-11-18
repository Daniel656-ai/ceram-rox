import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResultCountBadges } from "@/components/results/ResultCountBadges";
import type { SampleMeasurementRecord } from "@/lib/results/sampleResultsAggregation";
import { summarizeServices, VISIBLE_SERVICE_CHIPS, type ServiceSummary } from "@/lib/results/serviceSummary";

const chipClass =
  "inline-flex max-w-[9rem] items-center truncate rounded-full border px-2 py-0.5 text-[11px] leading-tight";

/** Ein Messart-Chip: ruhig (Umriss); Messarten ohne offizielle Werte noch etwas blasser. */
function Chip({ s }: { s: ServiceSummary }) {
  return (
    <span
      className={`${chipClass} ${s.official > 0 ? "text-foreground" : "text-muted-foreground"}`}
      title={s.name}
    >
      {s.name}
    </span>
  );
}

/**
 * Messarten eines Auftrags/einer Probe auf einen Blick.
 *  - normal: bis zu drei Chips, danach „+N“; Klick öffnet die Details je Messart
 *  - compact (Seitenleiste offen): nur ein Chip bzw. „N Messarten“, damit die Zeile einzeilig bleibt
 * Das Fenster listet jede Messart mit Anzahl Analysen und offiziellen/vorläufigen Werten.
 */
export default function ServiceChips({
  measurements,
  compact = false,
}: {
  measurements: SampleMeasurementRecord[];
  compact?: boolean;
}) {
  const services = useMemo(() => summarizeServices(measurements), [measurements]);
  if (services.length === 0) return <span className="text-xs text-muted-foreground">–</span>;

  const single = services.length === 1;
  const visible = compact ? (single ? services : []) : services.slice(0, VISIBLE_SERVICE_CHIPS);
  const rest = services.length - visible.length;

  return (
    // Der Klick darf nicht die Zeile (Seitenleiste öffnen) auslösen.
    <div className="flex flex-nowrap items-center gap-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      {visible.map((s) => (
        <Chip key={s.name} s={s} />
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-[11px] leading-tight text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Messarten anzeigen (${services.length})`}
          >
            {compact && !single ? `${services.length} Messarten` : rest > 0 ? `+${rest}` : ""}
            <ChevronDown className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs font-medium">Messarten ({services.length})</p>
          <ul className="space-y-1.5">
            {services.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate" title={s.name}>
                  {s.name}
                  <span className="ml-1 text-muted-foreground">
                    · {s.analyses} {s.analyses === 1 ? "Analyse" : "Analysen"}
                  </span>
                </span>
                <ResultCountBadges official={s.official} interim={s.interim} />
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
