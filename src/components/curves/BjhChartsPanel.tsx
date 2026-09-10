import { useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { buildBjhCharts, type BjhChart, type BjhChartId } from "@/lib/curves/bjhCharts";
import type { MeasurementDataset } from "@/lib/curves/dataset";

export type BjhAxisScale = "linear" | "log";

interface Props {
  dataset: MeasurementDataset;
  /** Aktuelle Achsenwahl melden – z. B. für Ergebnisbericht/Export. */
  onScalesChange?: (scales: Record<string, BjhAxisScale>) => void;
  /** Diagrammcontainer für Snapshot/Export bereitstellen. */
  onChartRef?: (id: BjhChartId, el: HTMLDivElement | null) => void;
  height?: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 25 90% 55%))",
  "hsl(var(--chart-3, 200 70% 45%))",
  "hsl(var(--chart-4, 340 65% 55%))",
];

const fmt = (v: number) =>
  Math.abs(v) >= 1000 || (Math.abs(v) < 0.001 && v !== 0)
    ? v.toExponential(2)
    : v.toLocaleString("de-AT", { maximumFractionDigits: 4 });

const axisLabel = (label: string, unit: string | null) => (unit ? `${label} [${unit}]` : label);

function ChartCard({
  chart, scale, onScale, onRef, height,
}: {
  chart: BjhChart;
  scale: BjhAxisScale;
  onScale: (s: BjhAxisScale) => void;
  onRef?: (el: HTMLDivElement | null) => void;
  height: number;
}) {
  /** Echte logarithmische Achse: Werte ≤ 0 sind darauf mathematisch nicht darstellbar. */
  const { data, skipped } = useMemo(() => {
    const byX = new Map<number, Record<string, number>>();
    let skipped = 0;
    for (const s of chart.series) {
      for (const p of s.points) {
        if (scale === "log" && p.x <= 0) { skipped++; continue; }
        const row = byX.get(p.x) ?? { x: p.x };
        row[s.key] = p.y;
        byX.set(p.x, row);
      }
    }
    return { data: [...byX.values()].sort((a, b) => a.x - b.x), skipped };
  }, [chart, scale]);

  const yUnit = chart.series[0]?.unit ?? null;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium">{chart.definition.title}</p>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">X-Achse</span>
          {(["linear", "log"] as const).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={scale === s ? "default" : "outline"}
              className="h-6 px-2 text-[11px]"
              onClick={() => onScale(s)}
            >
              {s === "linear" ? "Linear" : "Log"}
            </Button>
          ))}
        </div>
      </div>

      <div ref={onRef} className="bg-background" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 36, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="x"
              type="number"
              scale={scale === "log" ? "log" : "linear"}
              domain={["dataMin", "dataMax"]}
              allowDataOverflow={false}
              tickFormatter={fmt}
              tick={{ fontSize: 10 }}
              label={{
                value: axisLabel(chart.xLabel, chart.xUnit),
                position: "insideBottom", offset: -22, fontSize: 10,
              }}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 10 }}
              width={68}
              label={{
                value: axisLabel(chart.definition.yLabel, yUnit),
                angle: -90, position: "insideLeft", offset: -4, fontSize: 10,
              }}
            />
            <Tooltip
              formatter={(v: unknown, name: unknown) => {
                const s = chart.series.find((x) => x.key === name);
                return [`${fmt(Number(v))}${s?.unit ? ` ${s.unit}` : ""}`, s?.label ?? String(name)];
              }}
              labelFormatter={(l) => `${axisLabel(chart.xLabel, chart.xUnit)}: ${fmt(Number(l))}`}
            />
            {chart.series.length > 1 && (
              <Legend
                verticalAlign="top"
                height={20}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(name) => chart.series.find((s) => s.key === name)?.label ?? String(name)}
              />
            )}
            {chart.series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} dot={false} strokeWidth={2}
                stroke={COLORS[i % COLORS.length]} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {skipped > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {skipped} Messpunkt(e) mit Porengröße ≤ 0 sind auf einer logarithmischen Achse nicht darstellbar.
        </p>
      )}
    </div>
  );
}

/**
 * Die vier festen Diagramme der BJH-Auswertung (2×2, einspaltig auf schmalen
 * Bildschirmen). Alle Diagramme greifen auf dieselben gespeicherten Messpunkte
 * zu; die Umschaltung Linear/Log verändert ausschließlich die Darstellung.
 */
export default function BjhChartsPanel({ dataset, onScalesChange, onChartRef, height = 260 }: Props) {
  const charts = useMemo(() => buildBjhCharts(dataset), [dataset]);
  const [scales, setScales] = useState<Record<string, BjhAxisScale>>({});

  if (charts.length === 0) return null;

  const setScale = (id: BjhChartId, s: BjhAxisScale) =>
    setScales((prev) => {
      const next = { ...prev, [id]: s };
      onScalesChange?.(next);
      return next;
    });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Porengrößenverteilung (BJH)</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {charts.map((c) => (
          <ChartCard
            key={c.definition.id}
            chart={c}
            scale={scales[c.definition.id] ?? "log"}
            onScale={(s) => setScale(c.definition.id, s)}
            onRef={onChartRef ? (el) => onChartRef(c.definition.id, el) : undefined}
            height={height}
          />
        ))}
      </div>
    </div>
  );
}
