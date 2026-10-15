import { describe, it, expect } from "vitest";
import { withHistoricalOption } from "@/lib/masterData/inactiveOptions";

const active = [{ label: "M1", item_value: "m1" }, { label: "M2", item_value: "m2" }];

describe("withHistoricalOption", () => {
  it("bietet nur aktive Einträge bei Neuanlage an", () => {
    expect(withHistoricalOption(active, null)).toEqual([
      { label: "M1", value: "m1" }, { label: "M2", value: "m2" },
    ]);
  });
  it("aktiver gespeicherter Wert bleibt normale Option", () => {
    expect(withHistoricalOption(active, "m2").some((o) => o.inactive)).toBe(false);
  });
  it("inaktiver gespeicherter Wert bleibt sichtbar, aber nicht neu auswählbar", () => {
    const opts = withHistoricalOption(active, "m3");
    expect(opts[0]).toEqual({ label: "m3 (inaktiv)", value: "m3", inactive: true });
    expect(opts).toHaveLength(3);
  });
});
