import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Crosshair, Maximize2, Redo2, RotateCcw, Undo2, ZoomIn } from "lucide-react";
import {
  CartesianGrid, Label as RLabel, Legend, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { overviewMinMax, sliceRangeExact, xExtent, type MeasurementDataset } from "@/lib/curves/dataset";
import {
  clampRange, initHistory, panBy, pixelToX, pushView, redoView, resetView, undoView, wheelFactor, zoomAt,
  type XRange, type ZoomHistory,
} from "@/lib/curves/zoom";
import { CurveViewerNavigator } from "./CurveViewerNavigator";
import { DraggableMarkerLabel } from "./DraggableMarkerLabel";

export interface CurveSelection {
  xKey: string;
  /** Primäre Y-Kanäle (linke Achse). */
  yKeys: string[];
  /** Optionaler Kanal auf der rechten Achse. */
  y2Key: string | null;
  from: number;
  to: number;
}

/**
 * Gespeicherter Auswertungspunkt, der im Diagramm eingezeichnet wird.
 * Der Graph spiegelt damit exakt die gespeicherte Auswertung wider.
 */
export interface CurveMarker {
  x: number;
  values: { yKey: string; value: number | null }[];
}

interface Props {
  dataset: MeasurementDataset;
  /** Eingezeichnete Auswertungspunkte (X-Position + Kurvenschnittpunkte). */
  markers?: CurveMarker[];
  /** Werte direkt am Punkt anzeigen. */
  showMarkerValues?: boolean;
  /** Container des Diagramms – für Export/Snapshot. */
  chartRef?: React.RefObject<HTMLDivElement>;
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
export default function CurveViewer({ dataset, defaults, onSelectionChange, height = 340, markers = [], showMarkerValues = true, chartRef }: Props) {
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

  const extent = useMemo(() => xExtent(dataset, xKey), [dataset, xKey]);
  const xMin = extent?.min ?? 0;
  const xMax = extent?.max ?? 0;
  const fullRange = useMemo<XRange>(() => ({ from: xMin, to: xMax }), [xMin, xMax]);

  // Fachlicher Auswertungsbereich (evalRange) – unabhängig vom Zoom.
  const [from, setFrom] = useState(xMin);
  const [to, setTo] = useState(xMax);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  // Sichtbereich (viewRange) inkl. Historie – beeinflusst keine Berechnung.
  const [history, setHistory] = useState<ZoomHistory>(() => initHistory(fullRange));
  const [liveView, setLiveView] = useState<XRange | null>(null);
  const view = liveView ?? history.current;
  const [mode, setMode] = useState<"zoom" | "eval">("zoom");

  useEffect(() => { setFrom(xMin); setTo(xMax); setHistory(resetView({ from: xMin, to: xMax })); setLiveView(null); }, [xMin, xMax]);

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


  const activeKeys = useMemo(() => [...yKeys, ...(y2Key ? [y2Key] : [])], [yKeys, y2Key]);

  /**
   * Detaildiagramm: sämtliche Originalmesspunkte im Sichtbereich, je Zeile
   * genau ein Messpunkt (keine Reduktion, kein Zusammenführen gleicher X-Werte).
   */
  const chartData = useMemo(
    () => sliceRangeExact(dataset, xKey, activeKeys, view.from, view.to),
    [dataset, xKey, activeKeys, view.from, view.to],
  );

  /** Gesamtübersicht – einmalig je Kanalwahl aufbereitet (nur optisch reduziert). */
  const overview = useMemo(
    () => activeKeys.map((k) => overviewMinMax(dataset, xKey, k, 400)),
    [dataset, xKey, activeKeys],
  );

  const toggleY = (key: string) =>
    setYKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const commitView = (next: XRange) => {
    setLiveView(null);
    setHistory((h) => pushView(h, clampRange(next, fullRange)));
  };

  // ---------- Pointer-Interaktion im Hauptdiagramm ----------
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const setWrapRef = (el: HTMLDivElement | null) => {
    wrapRef.current = el;
    if (chartRef) (chartRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };
  const dragRef = useRef<{ kind: "select" | "pan"; startClientX: number; origin: XRange; moved: boolean } | null>(null);

  /** Tatsächliche Zeichenfläche (DPI-/Größenunabhängig über getBoundingClientRect). */
  const plotRect = () => {
    const el = wrapRef.current;
    if (!el) return null;
    const grid = el.querySelector(".recharts-cartesian-grid") as SVGGElement | null;
    const r = grid?.getBoundingClientRect();
    if (r && r.width > 0) return { left: r.left, width: r.width };
    const w = el.getBoundingClientRect();
    return { left: w.left, width: w.width };
  };
  const clientToX = (clientX: number, range: XRange = view) => {
    const r = plotRect();
    if (!r) return range.from;
    return pixelToX(clientX - r.left, r.width, range);
  };

  const MIN_DRAG_PX = 5;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || chartData.length === 0) return;
    const r = plotRect();
    if (!r || e.clientX < r.left || e.clientX > r.left + r.width) return;
    const kind = e.shiftKey ? "pan" : "select";
    dragRef.current = { kind, startClientX: e.clientX, origin: view, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (kind === "select") { setDragStart(clientToX(e.clientX)); setDragEnd(null); }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startClientX) >= MIN_DRAG_PX) d.moved = true;
    if (d.kind === "pan") {
      const r = plotRect();
      if (!r) return;
      const dx = -((e.clientX - d.startClientX) / r.width) * (d.origin.to - d.origin.from);
      setLiveView(panBy(d.origin, fullRange, dx));
    } else if (d.moved) {
      setDragEnd(clientToX(e.clientX, d.origin));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.kind === "pan") {
      if (liveView) commitView(liveView);
    } else if (d.moved && dragStart != null && dragEnd != null && dragStart !== dragEnd) {
      const lo = Math.min(dragStart, dragEnd);
      const hi = Math.max(dragStart, dragEnd);
      if (mode === "eval") { setFrom(lo); setTo(hi); }
      else commitView({ from: lo, to: hi });
    }
    setDragStart(null);
    setDragEnd(null);
  };

  // Mausrad-Zoom: nativer, nicht-passiver Listener (Seite scrollt nicht mit).
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  const wheelCommitTimer = useRef<number | undefined>();
  wheelRef.current = (e: WheelEvent) => {
    if (chartData.length === 0 && view.from === fullRange.from && view.to === fullRange.to) return;
    const r = plotRect();
    if (!r) return;
    e.preventDefault();
    const base = liveView ?? history.current;
    const anchor = pixelToX(e.clientX - r.left, r.width, base);
    const next = zoomAt(base, fullRange, anchor, wheelFactor(e.deltaY, e.deltaMode));
    setLiveView(next);
    window.clearTimeout(wheelCommitTimer.current);
    wheelCommitTimer.current = window.setTimeout(() => commitView(next), 300);
  };
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => { el.removeEventListener("wheel", handler); window.clearTimeout(wheelCommitTimer.current); };
  }, [channels.length]);

  const isFullView = view.from === fullRange.from && view.to === fullRange.to;
  const panStep = (dir: -1 | 1) => commitView(panBy(view, fullRange, dir * (view.to - view.from) * 0.25));

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Bedienmodus Diagramm">
          <Button type="button" size="sm" variant={mode === "zoom" ? "default" : "ghost"} className="h-7"
            aria-pressed={mode === "zoom"} onClick={() => setMode("zoom")}>
            <ZoomIn className="h-3.5 w-3.5 mr-1" /> Zoom-Modus
          </Button>
          <Button type="button" size="sm" variant={mode === "eval" ? "secondary" : "ghost"} className="h-7"
            aria-pressed={mode === "eval"} onClick={() => setMode("eval")}>
            <Crosshair className="h-3.5 w-3.5 mr-1" /> Auswertungsmodus
          </Button>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7" title="Zoom rückgängig"
          disabled={!history.past.length} onClick={() => { setLiveView(null); setHistory(undoView); }}>
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7" title="Zoom wiederholen"
          disabled={!history.future.length} onClick={() => { setLiveView(null); setHistory(redoView); }}>
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7" title="Nach links verschieben"
          disabled={isFullView} onClick={() => panStep(-1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7" title="Nach rechts verschieben"
          disabled={isFullView} onClick={() => panStep(1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7" disabled={isFullView}
          onClick={() => commitView(fullRange)}>
          <Maximize2 className="h-3.5 w-3.5 mr-1" /> Gesamter Messbereich
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7"
          disabled={isFullView && !history.past.length && !history.future.length}
          onClick={() => { setLiveView(null); setHistory(resetView(fullRange)); }}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Zoom zurücksetzen
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7" disabled={isFullView}
          title="Auswertungsbereich ausdrücklich auf den sichtbaren Bereich setzen"
          onClick={() => { setFrom(view.from); setTo(view.to); }}>
          Auswertungsbereich an Ansicht anpassen
        </Button>
        <span className="text-xs text-muted-foreground">
          {chartData.length.toLocaleString("de-AT")} Originalmesspunkte sichtbar
        </span>
      </div>

      <div
        ref={setWrapRef}
        data-testid="curve-main-chart"
        data-mode={mode}
        className={`rounded border bg-background p-2 select-none touch-none ${mode === "eval" ? "ring-2 ring-accent cursor-col-resize" : "cursor-crosshair"}`}
        style={{ height: chartHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => { if (!isFullView) commitView(fullRange); }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: y2Channel ? 40 : 24, bottom: 40, left: 24 }}

          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[view.from, view.to]}
              allowDataOverflow
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
                stroke={COLORS[i % COLORS.length]} isAnimationActive={false} connectNulls={false} />
            ))}
            {y2Channel && (
              <Line yAxisId="right" type="monotone" dataKey={y2Channel.key} dot={false} strokeWidth={2}
                strokeDasharray="4 2" stroke={COLORS[(yKeys.length) % COLORS.length]} isAnimationActive={false} connectNulls={false} />
            )}
            {markers.map((m, mi) => (
              <ReferenceLine
                key={`marker-${mi}-${m.x}`}
                yAxisId="left"
                x={m.x}
                stroke="hsl(var(--destructive))"
                strokeWidth={1}
                ifOverflow="hidden"
              >
                <RLabel value={`${fmt(m.x)}${xChannel?.unit ? ` ${xChannel.unit}` : ""}`} position="top" fontSize={10} />
              </ReferenceLine>
            ))}
            {markers.flatMap((m, mi) =>
              m.values
                .filter((v) => v.value != null && (yKeys.includes(v.yKey) || v.yKey === y2Key))
                .map((v, valueIndex) => (
                  <ReferenceDot
                    key={`dot-${mi}-${v.yKey}`}
                    yAxisId={v.yKey === y2Key ? "right" : "left"}
                    x={m.x}
                    y={v.value as number}
                    r={4}
                    fill="hsl(var(--destructive))"
                    stroke="hsl(var(--background))"
                    ifOverflow="hidden"
                  >
                    {showMarkerValues && (
                      <RLabel
                        content={(props) => (
                          <DraggableMarkerLabel
                            viewBox={props.viewBox as { cx?: number; cy?: number; x?: number; y?: number }}
                            value={fmt(v.value as number)}
                            index={mi + valueIndex}
                          />
                        )}
                      />
                    )}
                  </ReferenceDot>
                ))
            )}
            {dragStart != null && dragEnd != null && (
              <ReferenceArea yAxisId="left" x1={dragStart} x2={dragEnd} strokeOpacity={0.3}
                fill={mode === "eval" ? "hsl(var(--accent))" : "hsl(var(--primary))"} fillOpacity={0.15} ifOverflow="hidden" />
            )}
            {dragStart == null && (
              <>
                <ReferenceLine yAxisId="left" x={from} stroke="hsl(var(--primary))" strokeDasharray="4 2" ifOverflow="hidden" />
                <ReferenceLine yAxisId="left" x={to} stroke="hsl(var(--primary))" strokeDasharray="4 2" ifOverflow="hidden" />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Navigator liegt bewusst außerhalb des Diagrammcontainers (chartRef/PDF). */}
      <CurveViewerNavigator
        full={fullRange}
        view={view}
        series={overview}
        colors={COLORS}
        onChange={setLiveView}
        onCommit={commitView}
      />

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
          Auswertung: gesamter Bereich
        </Button>
        <p className="text-xs text-muted-foreground">
          Ausgewählter Bereich: {fmt(from)}–{fmt(to)}{xChannel?.unit ? ` ${xChannel.unit}` : ""} · {mode === "zoom"
            ? "Zoom-Modus: ziehen = vergrößern, Mausrad = zoomen, Umschalt+Ziehen = verschieben, Doppelklick = Gesamtbereich"
            : "Auswertungsmodus: im Diagramm ziehen legt den Auswertungsbereich fest"}
        </p>
      </div>
    </div>
  );
}
