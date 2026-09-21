import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  LABEL_HEIGHT,
  LABEL_WIDTH,
  automaticLabelPosition,
  clampLabel,
  leaderLineEnd,
  type LabelBounds,
  type LabelPoint,
  type LabelRect,
} from "@/lib/curves/labelLayout";

interface DraggableMarkerLabelProps {
  viewBox?: { cx?: number; cy?: number; x?: number; y?: number };
  value: string;
  index: number;
}

export function DraggableMarkerLabel({ viewBox, value, index }: DraggableMarkerLabelProps) {
  const anchor = useMemo<LabelPoint>(() => ({
    x: viewBox?.cx ?? viewBox?.x ?? 0,
    y: viewBox?.cy ?? viewBox?.y ?? 0,
  }), [viewBox?.cx, viewBox?.cy, viewBox?.x, viewBox?.y]);
  const groupRef = useRef<SVGGElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; origin: LabelPoint } | null>(null);
  const [bounds, setBounds] = useState<LabelBounds>({ left: 4, top: 4, right: 1000, bottom: 1000 });
  const [manualPosition, setManualPosition] = useState<LabelPoint | null>(null);
  const [obstacles, setObstacles] = useState<{ points: LabelPoint[]; labels: LabelRect[] }>({ points: [], labels: [] });

  useEffect(() => {
    const svg = groupRef.current?.ownerSVGElement;
    if (!svg) return;
    const next = { left: 4, top: 4, right: svg.clientWidth - 4, bottom: svg.clientHeight - 4 };
    setBounds(next);
    setManualPosition((current) => current ? clampLabel(current, next) : null);
  }, [anchor.x, anchor.y]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const svg = group?.ownerSVGElement;
    if (!group || !svg) return;

    const collect = () => {
      const points: LabelPoint[] = [];
      svg.querySelectorAll<SVGGeometryElement>(".recharts-line-curve").forEach((path) => {
        const length = path.getTotalLength?.() ?? 0;
        for (let offset = 0; offset <= length; offset += 10) {
          const point = path.getPointAtLength(offset);
          points.push({ x: point.x, y: point.y });
        }
      });
      svg.querySelectorAll<SVGCircleElement>(".recharts-reference-dot circle").forEach((circle) => {
        points.push({ x: circle.cx.baseVal.value, y: circle.cy.baseVal.value });
      });
      const labels = Array.from(svg.querySelectorAll<SVGGElement>("[data-marker-label]"))
        .filter((candidate) => candidate !== group)
        .map((candidate) => candidate.querySelector("rect"))
        .filter((rect): rect is SVGRectElement => rect !== null)
        .map((rect) => ({
          x: rect.x.baseVal.value,
          y: rect.y.baseVal.value,
          width: rect.width.baseVal.value,
          height: rect.height.baseVal.value,
        }));
      setObstacles({ points, labels });
    };

    const frame = requestAnimationFrame(collect);
    return () => cancelAnimationFrame(frame);
  }, [anchor.x, anchor.y, index, value]);

  const automatic = automaticLabelPosition(anchor, index, bounds, obstacles);
  const position = manualPosition ?? automatic;
  const lineEnd = leaderLineEnd(anchor, position);

  const startDrag = (event: ReactPointerEvent<SVGGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, origin: position };
  };
  const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    setManualPosition(clampLabel({
      x: drag.origin.x + event.clientX - drag.pointerX,
      y: drag.origin.y + event.clientY - drag.pointerY,
    }, bounds));
  };
  const stopDrag = (event: ReactPointerEvent<SVGGElement>) => {
    event.stopPropagation();
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <g
      ref={groupRef}
      data-marker-label={index}
      role="button"
      aria-label={`${value} verschieben`}
      tabIndex={0}
      className="cursor-move outline-none"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <line
        x1={anchor.x}
        y1={anchor.y}
        x2={lineEnd.x}
        y2={lineEnd.y}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={1}
        strokeDasharray="2 2"
        pointerEvents="none"
      />
      <rect
        x={position.x}
        y={position.y}
        width={LABEL_WIDTH}
        height={LABEL_HEIGHT}
        rx={3}
        fill="hsl(var(--background))"
        stroke="hsl(var(--border))"
      />
      <text
        x={position.x + LABEL_WIDTH / 2}
        y={position.y + LABEL_HEIGHT / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={10}
        pointerEvents="none"
      >
        {value}
      </text>
    </g>
  );
}