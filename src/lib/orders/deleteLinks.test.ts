import { describe, it, expect } from "vitest";
import { visibleOrderLinks } from "./deleteLinks";

describe("visibleOrderLinks", () => {
  it("shows only links that actually exist", () => {
    const r = visibleOrderLinks({ samples: 2, services: 0, results_official: 3 });
    expect(r.map((e) => e.key)).toEqual(["samples", "results_official"]);
    expect(r[0].count).toBe(2);
  });
  it("returns empty list when no links", () => {
    expect(visibleOrderLinks({ samples: 0 })).toEqual([]);
    expect(visibleOrderLinks(null)).toEqual([]);
  });
});
