export interface LabelPoint {
  x: number;
  y: number;
}

export interface LabelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const LABEL_WIDTH = 72;
export const LABEL_HEIGHT = 22;

const CANDIDATES: LabelPoint[] = [
  { x: 12, y: -32 },
  { x: -LABEL_WIDTH - 12, y: -32 },
  { x: 12, y: 12 },
  { x: -LABEL_WIDTH - 12, y: 12 },
];

export function clampLabel(point: LabelPoint, bounds: LabelBounds): LabelPoint {
  return {
    x: Math.min(Math.max(point.x, bounds.left), bounds.right - LABEL_WIDTH),
    y: Math.min(Math.max(point.y, bounds.top), bounds.bottom - LABEL_HEIGHT),
  };
}

export function automaticLabelPosition(anchor: LabelPoint, index: number, bounds: LabelBounds): LabelPoint {
  const ordered = CANDIDATES.map((_, offset) => CANDIDATES[(index + offset) % CANDIDATES.length]);
  const fitting = ordered.find((candidate) => {
    const x = anchor.x + candidate.x;
    const y = anchor.y + candidate.y;
    return x >= bounds.left && y >= bounds.top && x + LABEL_WIDTH <= bounds.right && y + LABEL_HEIGHT <= bounds.bottom;
  });
  const candidate = fitting ?? ordered[0];
  return clampLabel({ x: anchor.x + candidate.x, y: anchor.y + candidate.y }, bounds);
}

export function leaderLineEnd(anchor: LabelPoint, label: LabelPoint): LabelPoint {
  return {
    x: Math.min(Math.max(anchor.x, label.x), label.x + LABEL_WIDTH),
    y: Math.min(Math.max(anchor.y, label.y), label.y + LABEL_HEIGHT),
  };
}