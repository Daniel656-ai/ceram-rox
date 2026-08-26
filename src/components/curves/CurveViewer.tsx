import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downsample, curveOf, type MeasurementDataset } from "@/lib/curves/dataset";

export interface CurveSelection {
  xKey: string;
  /** Primäre Y-Kanäle (linke Achse). */
  yKeys: string[];
  /** Optionaler Kanal auf der rechten Achse. */
  y2Key: string | null;
  from: number;
  to: number;
}

interface Props {
  dataset: MeasurementDataset;
  /** Vorbelegung, z. B. aus der Messfall-Konfiguration. */
  defaults?: Partial<Pick<CurveSelection, "xKey" | "yKeys" | "y2Key">>;
  onSelectionChange?: (selection: CurveSelection) => void;
  height?: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 25 90% 55%))",
  "hsl(var(--chart-3, 200 70% 45%))",
  "hsl(var(--chart-4, 340 65% 55%))",
  "hsl(var(--chart-5, 145 55% 40%))",
];

const fmt = (v: number) =>
  Math.abs(v) >= 1000 || (Math.abs(v) < 0.001 && v !== 0)
    ? v.toExponential(3)
    : v.toLocaleString("de-AT", { maximumFractionDigits: 4 });

const axisLabel = (label: string, unit: string | null) => (unit ? `${label} [${unit}]` : label);

/**
 * Generischer, verfahrensunabhängiger Kurvenviewer.
 * Achsen, Einheiten und Kurven stammen ausschließlich aus den importierten
 * Kanälen – es sind keine gerätespezifischen Spalten fest hinterlegt.
 */
export default function CurveViewer({ dataset, defaults, onSelectionChange, height = 340 }: Props) {
  const channels = dataset.channels ?? [];
  const numericKeys = channels.map((c) => c.key);

  const [xKey, setXKey] = useState<string>(defaults?.xKey && numericKeys.includes(defaults.xKey) ? defaults.xKey : numericKeys[0] ?? "");
  const [yKeys, setYKeys] = useState<string[]>(() => {
    const wanted = (defaults?.yKeys ?? []).filter((k) => numericKeys.includes(k));
    if (wanted.length) return wanted;
    const first = numericKeys.find((k) => k !== (defaults?.xKey ?? numericKeys[0]));
    return first ? [first] : [];
  });
  const [y2Key, setY2Key] = useState<string | null>(
    defaults?.y2Key && numericKeys.includes(defaults.y2Key) ? defaults.y2Key : null
  );

  const xChannel = channels.find((c) => c.key === xKey) ?? null;

  const xValues = useMemo(() => {
    const idx = channels.findIndex((c) => c.key === xKey);
    if (idx < 0) return [] as number[];
    return dataset.rows.map((r) => r[idx]).filter((v) => Number.isFinite(v));
  }, [dataset, channels, xKey]);

  const xMin = xValues.length ? Math.min(...xValues) : 0;
  const xMax = xValues.length ? Math.max(...xValues) : 0;

  const [from, setFrom] = useState(xMin);
  const [to, setTo] = useState(xMax);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  useEffect(() => { setFrom(xMin); setTo(xMax); }, [xMin, xMax]);

  /**
   * Gespeicherte Signalzuordnung übernehmen, sobald sie (z. B. nach dem Laden
   * der Rohdaten) verfügbar wird. Danach entscheidet allein der Benutzer.
   */
  const defaultsKey = `${defaults?.xKey ?? ""}|${(defaults?.yKeys ?? []).join(",")}|${defaults?.y2Key ?? ""}`;
  useEffect(() => {
    if (!defaults) return;
    const keys = channels.map((c) => c.key);
    if (defaults.xKey && keys.includes(defaults.xKey)) setXKey(defaults.xKey);
    const wantedY = (defaults.yKeys ?? []).filter((k) => keys.includes(k));
    if (wantedY.length) setYKeys(wantedY);
    setY2Key(defaults.y2Key && keys.includes(defaults.y2Key) ? defaults.y2Key : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsKey, channels.length]);

  useEffect(() => {
    onSelectionChange?.({ xKey, yKeys, y2Key, from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xKey, yKeys.join("|"), y2Key, from, to]);


  /** Alle gewählten Kurven auf gemeinsame X-Werte gelegt. */
  const chartData = useMemo(() => {
    const active = [...yKeys, ...(y2Key ? [y2Key] : [])];
    const byX = new Map<number, Record<string, number>>();
    for (const key of active) {
      for (const p of downsample(curveOf(dataset, xKey, key), 1500)) {
        const row = byX.get(p.x) ?? { x: p.x };
        row[key] = p.y;
        byX.set(p.x, row);
      }
    }
    return [...byX.values()].sort((a, b) => a.x - b.x);
  }, [dataset, xKey, yKeys, y2Key]);

  const toggleY = (key: string) =>
    setYKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const commitDrag = () => {
    if (dragStart != null && dragEnd != null && dragStart !== dragEnd) {
      setFrom(Math.min(dragStart, dragEnd));
      setTo(Math.max(dragStart, dragEnd));
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const leftUnits = [...new Set(yKeys.map((k) => channels.find((c) => c.key === k)?.unit ?? "").filter(Boolean))];
  const y2Channel = y2Key ? channels.find((c) => c.key === y2Key) ?? null : null;

  /**
   * Die Legende steht über der Zeichenfläche und darf Achsenbeschriftungen nie
   * überdecken: die Diagrammhöhe wächst mit der Anzahl der Legendenzeilen.
   */
  const seriesCount = yKeys.length + (y2Channel ? 1 : 0);
  const legendRows = Math.max(1, Math.ceil(seriesCount / 3));
  const chartHeight = height + legendRows * 22;


  if (channels.length === 0) {
    return <p className="text-xs text-muted-foreground">Keine Messkanäle vorhanden.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">X-Achse</Label>
          <Select value={xKey} onValueChange={setXKey}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.key} value={c.key}>{axisLabel(c.label, c.unit)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Zweite Y-Achse (rechts)</Label>
          <Select value={y2Key ?? "__none__"} onValueChange={(v) => setY2Key(v === "__none__" ? null : v)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— keine —</SelectItem>
              {channels.filter((c) => c.key !== xKey).map((c) => (
                <SelectItem key={c.key} value={c.key}>{axisLabel(c.label, c.unit)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Messkurven (linke Achse)</Label>
        <div className="flex flex-wrap gap-3">
          {channels.filter((c) => c.key !== xKey).map((c) => (
            <label key={c.key} className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={yKeys.includes(c.key)} onCheckedChange={() => toggleY(c.key)} />
              <span>{axisLabel(c.label, c.unit)}</span>
              {c.derived && <Badge variant="outline" className="text-[10px]">berechnet</Badge>}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border p-2" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: y2Channel ? 40 : 24, bottom: 40, left: 24 }}

            onMouseDown={(e: any) => e?.activeLabel != null && setDragStart(Number(e.activeLabel))}
            onMouseMove={(e: any) => dragStart != null && e?.activeLabel != null && setDragEnd(Number(e.activeLabel))}
            onMouseUp={commitDrag}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmt}
              tick={{ fontSize: 11 }}
              label={{
                value: axisLabel(xChannel?.label ?? "", xChannel?.unit ?? null),
                position: "insideBottom", offset: -24, fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={fmt}
              tick={{ fontSize: 11 }}
              width={72}
              label={{ value: leftUnits.join(" / "), angle: -90, position: "insideLeft", offset: -8, fontSize: 11 }}
            />
            {y2Channel && (
              <YAxis
                yAxisId="right" orientation="right" tickFormatter={fmt} tick={{ fontSize: 11 }}
                width={72}
                label={{ value: y2Channel.unit ?? "", angle: 90, position: "insideRight", offset: -8, fontSize: 11 }}
              />
            )}
            <Tooltip
              formatter={(v: any, name: any) => {
                const ch = channels.find((c) => c.key === name);
                return [`${fmt(Number(v))}${ch?.unit ? ` ${ch.unit}` : ""}`, ch?.label ?? name];
              }}
              labelFormatter={(l) => `${axisLabel(xChannel?.label ?? "", xChannel?.unit ?? null)}: ${fmt(Number(l))}`}
            />
            <Legend
              verticalAlign="top"
              align="center"
              height={legendRows * 22}
              wrapperStyle={{ fontSize: 11, lineHeight: "18px", paddingBottom: 4 }}
              formatter={(name) => {
                const ch = channels.find((c) => c.key === name);
                return ch ? axisLabel(ch.label, ch.unit) : String(name);
              }}
            />

            {yKeys.map((k, i) => (
              <Line key={k} yAxisId="left" type="monotone" dataKey={k} dot={false} strokeWidth={2}
                stroke={COLORS[i % COLORS.length]} isAnimationActive={false} connectNulls />
            ))}
            {y2Channel && (
              <Line yAxisId="right" type="monotone" dataKey={y2Channel.key} dot={false} strokeWidth={2}
                strokeDasharray="4 2" stroke={COLORS[(yKeys.length) % COLORS.length]} isAnimationActive={false} connectNulls />
            )}
            {dragStart != null && dragEnd != null && (
              <ReferenceArea yAxisId="left" x1={dragStart} x2={dragEnd} strokeOpacity={0.3} />
            )}
            {dragStart == null && (
              <>
                <ReferenceLine yAxisId="left" x={from} stroke="hsl(var(--primary))" strokeDasharray="4 2" />
                <ReferenceLine yAxisId="left" x={to} stroke="hsl(var(--primary))" strokeDasharray="4 2" />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Bereich von{xChannel?.unit ? ` [${xChannel.unit}]` : ""}</Label>
          <Input className="h-8 w-32" type="number" value={from}
            onChange={(e) => setFrom(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">bis{xChannel?.unit ? ` [${xChannel.unit}]` : ""}</Label>
          <Input className="h-8 w-32" type="number" value={to}
            onChange={(e) => setTo(Number(e.target.value))} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { setFrom(xMin); setTo(xMax); }}>
          Gesamter Bereich
        </Button>
        <p className="text-xs text-muted-foreground">
          Ausgewählter Bereich: {fmt(from)}–{fmt(to)}{xChannel?.unit ? ` ${xChannel.unit}` : ""} · im Diagramm ziehen zum Markieren
        </p>
      </div>
    </div>
  );
}
