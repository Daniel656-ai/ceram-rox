import { describe, expect, it } from "vitest";
import { LABEL_HEIGHT, LABEL_WIDTH, automaticLabelPosition, clampLabel, leaderLineEnd } from "@/lib/curves/labelLayout";

const bounds = { left: 10, top: 10, right: 310, bottom: 210 };

describe("curve marker label layout", () => {
  it("prefers a position above the selected point when space is available", () => {
    expect(automaticLabelPosition({ x: 120, y: 100 }, 0, bounds)).toEqual({ x: 132, y: 68 });
  });

  it("uses another side near the upper chart boundary", () => {
    const placed = automaticLabelPosition({ x: 120, y: 15 }, 0, bounds);
    expect(placed.y).toBeGreaterThan(15);
  });

  it("keeps dragged labels inside the visible chart", () => {
    expect(clampLabel({ x: 999, y: -20 }, bounds)).toEqual({
      x: bounds.right - LABEL_WIDTH,
      y: bounds.top,
    });
    const lower = clampLabel({ x: -20, y: 999 }, bounds);
    expect(lower).toEqual({ x: bounds.left, y: bounds.bottom - LABEL_HEIGHT });
  });

  it("connects to the nearest point on the label box", () => {
    expect(leaderLineEnd({ x: 100, y: 100 }, { x: 120, y: 60 })).toEqual({ x: 120, y: 82 });
  });
});