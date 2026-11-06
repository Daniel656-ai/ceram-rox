import { useEffect, useRef, useState } from "react";
import type { OverviewSeries } from "@/lib/curves/dataset";
import { clampRange, type XRange } from "@/lib/curves/zoom";

interface Props {
  full: XRange;
  view: XRange;
  series: OverviewSeries[];
  colors: string[];
  /** Live-Änderung während des Ziehens (ohne Historie). */
  onChange: (r: XRange) => void;
  /** Abschluss einer Navigator-Aktion (mit Historie). */
  onCommit: (r: XRange) => void;
  height?: number;
}

type DragMode = "move" | "left" | "right";
const HANDLE_PX = 6;

/**
 * Gesamtübersicht der Messung mit verschiebbarem/skalierbarem Sichtfenster.
 * Die Kurven sind hier ausschließlich optisch reduziert (Min-Max-Buckets).
 */
export function CurveViewerNavigator({ full, view, series, colors, onChange, onCommit, height = 56 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ mode: DragMode; startX: number; origin: XRange; last: XRange; w: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const span = full.to - full.from || 1;
  const toPx = (x: number) => ((x - full.from) / span) * width;

  const left = toPx(view.from);
  const right = toPx(view.to);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const w = rect.width || 1;
    const px = e.clientX - rect.left;
    const left = ((view.from - full.from) / span) * w;
    const right = ((view.to - full.from) / span) * w;
    let mode: DragMode;
    let origin = view;
    if (Math.abs(px - left) <= HANDLE_PX) mode = "left";
    else if (Math.abs(px - right) <= HANDLE_PX) mode = "right";
    else if (px > left && px < right) mode = "move";
    else {
      // Klick außerhalb: Fenster auf diese Stelle zentrieren.
      const c = full.from + (px / w) * span;
      const vw = view.to - view.from;
      origin = clampRange({ from: c - vw / 2, to: c + vw / 2 }, full);
      onChange(origin);
      mode = "move";
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, origin, last: origin, w };
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / d.w) * span;
    const minW = span * 1e-6;
    let next: XRange;
    if (d.mode === "move") next = clampRange({ from: d.origin.from + dx, to: d.origin.to + dx }, full);
    else if (d.mode === "left") next = { from: Math.max(full.from, Math.min(d.origin.from + dx, d.origin.to - minW)), to: d.origin.to };
    else next = { from: d.origin.from, to: Math.min(full.to, Math.max(d.origin.to + dx, d.origin.from + minW)) };
    d.last = next;
    onChange(next);
  };

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onCommit(d.last);
  };

  const pad = 3;
  const h = height - pad * 2;

  return (
    <div
      ref={ref}
      data-testid="curve-navigator"
      aria-label="Gesamtübersicht der Messung"
      className="relative select-none rounded border bg-muted/30 touch-none"
      style={{ height, cursor: drag.current?.mode === "move" ? "grabbing" : "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0 pointer-events-none">
          {series.map((s, i) => {
            const yr = s.yMax - s.yMin || 1;
            const d = s.points
              .map((p, j) => `${j ? "L" : "M"}${toPx(p.x).toFixed(1)},${(pad + h - ((p.y - s.yMin) / yr) * h).toFixed(1)}`)
              .join("");
            return <path key={s.key} d={d} fill="none" stroke={colors[i % colors.length]} strokeWidth={1} opacity={0.8} />;
          })}
          <rect x={0} y={0} width={Math.max(0, left)} height={height} className="fill-background" opacity={0.65} />
          <rect x={right} y={0} width={Math.max(0, width - right)} height={height} className="fill-background" opacity={0.65} />
          <rect x={left} y={0.5} width={Math.max(1, right - left)} height={height - 1}
            fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
          <rect x={left - 2} y={height / 2 - 10} width={4} height={20} rx={1} fill="hsl(var(--primary))" />
          <rect x={right - 2} y={height / 2 - 10} width={4} height={20} rx={1} fill="hsl(var(--primary))" />
        </svg>
      )}
      {/* Zieh-Zonen für Cursor-Hinweise */}
      <div className="absolute top-0 bottom-0 cursor-ew-resize" style={{ left: left - HANDLE_PX, width: HANDLE_PX * 2 }} />
      <div className="absolute top-0 bottom-0 cursor-grab" style={{ left: left + HANDLE_PX, width: Math.max(0, right - left - HANDLE_PX * 2) }} />
      <div className="absolute top-0 bottom-0 cursor-ew-resize" style={{ left: right - HANDLE_PX, width: HANDLE_PX * 2 }} />
    </div>
  );
}
