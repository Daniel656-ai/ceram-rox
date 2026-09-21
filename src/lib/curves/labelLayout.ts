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

export interface LabelRect extends LabelPoint {
  width: number;
  height: number;
}

export interface LabelObstacles {
  points?: LabelPoint[];
  labels?: LabelRect[];
}

export const LABEL_WIDTH = 72;
export const LABEL_HEIGHT = 22;

const CANDIDATES: LabelPoint[] = [
  { x: -LABEL_WIDTH / 2, y: -LABEL_HEIGHT - 12 },
  { x: 12, y: -LABEL_HEIGHT - 10 },
  { x: -LABEL_WIDTH - 12, y: -LABEL_HEIGHT - 10 },
  { x: 12, y: 12 },
  { x: -LABEL_WIDTH - 12, y: 12 },
  { x: -LABEL_WIDTH / 2, y: 14 },
  { x: 16, y: -LABEL_HEIGHT / 2 },
  { x: -LABEL_WIDTH - 16, y: -LABEL_HEIGHT / 2 },
];

function pointDistanceFromRect(point: LabelPoint, rect: LabelRect) {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function overlapArea(a: LabelRect, b: LabelRect) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

export function clampLabel(point: LabelPoint, bounds: LabelBounds): LabelPoint {
  return {
    x: Math.min(Math.max(point.x, bounds.left), bounds.right - LABEL_WIDTH),
    y: Math.min(Math.max(point.y, bounds.top), bounds.bottom - LABEL_HEIGHT),
  };
}

export function automaticLabelPosition(
  anchor: LabelPoint,
  index: number,
  bounds: LabelBounds,
  obstacles: LabelObstacles = {},
): LabelPoint {
  const ordered = CANDIDATES.map((_, offset) => CANDIDATES[(index + offset) % CANDIDATES.length]);
  let best = clampLabel({ x: anchor.x + ordered[0].x, y: anchor.y + ordered[0].y }, bounds);
  let bestScore = Number.POSITIVE_INFINITY;

  ordered.forEach((candidate, candidateIndex) => {
    const raw = { x: anchor.x + candidate.x, y: anchor.y + candidate.y };
    const placed = clampLabel(raw, bounds);
    const rect = { ...placed, width: LABEL_WIDTH, height: LABEL_HEIGHT };
    const clampPenalty = Math.hypot(raw.x - placed.x, raw.y - placed.y) * 30;
    const pointPenalty = (obstacles.points ?? []).reduce((sum, point) => {
      const distance = pointDistanceFromRect(point, rect);
      return sum + (distance < 8 ? (8 - distance) * 80 : distance < 20 ? 20 - distance : 0);
    }, 0);
    const labelPenalty = (obstacles.labels ?? []).reduce(
      (sum, label) => sum + overlapArea(rect, label) * 100,
      0,
    );
    const score = clampPenalty + pointPenalty + labelPenalty + candidateIndex;
    if (score < bestScore) {
      best = placed;
      bestScore = score;
    }
  });

  return best;
}

export function leaderLineEnd(anchor: LabelPoint, label: LabelPoint): LabelPoint {
  return {
    x: Math.min(Math.max(anchor.x, label.x), label.x + LABEL_WIDTH),
    y: Math.min(Math.max(anchor.y, label.y), label.y + LABEL_HEIGHT),
  };
}