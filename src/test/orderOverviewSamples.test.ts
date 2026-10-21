import { describe, expect, it } from "vitest";
import { orderOverviewSamples, overviewSampleLabel, orderSamplesMatchSearch, orderSampleSortValue } from "@/lib/orders/overviewSamples";

const a = { id: "a", sample_name: "Alpha", sample_number: "P260001" };
const b = { id: "b", sample_name: "Beta", sample_number: "P260002" };
const linked = { order_samples: [
  { id: "2", created_at: "2026-10-02", samples: b },
  { id: "1", created_at: "2026-10-01", samples: a },
] };

describe("order overview sample associations", () => {
  it("returns no samples for an unassigned order", () => {
    expect(orderOverviewSamples({})).toEqual([]);
    expect(orderSampleSortValue({})).toBe("");
  });
  it("uses the historical single sample when no primary links exist", () => {
    expect(orderOverviewSamples({ order_samples: [], samples: a })).toEqual([a]);
  });
  it("keeps all primary samples in stable association order without mutating input", () => {
    expect(orderOverviewSamples(linked)).toEqual([a, b]);
    expect(linked.order_samples[0].samples).toEqual(b);
  });
  it("deduplicates by sample ID and does not add a different fallback to primary links", () => {
    expect(orderOverviewSamples({ order_samples: [{ samples: a }, { samples: a }], samples: b })).toEqual([a]);
  });
  it("ignores unreadable relations and retains a readable fallback", () => {
    expect(orderOverviewSamples({ order_samples: [{ samples: null }], samples: b })).toEqual([b]);
  });
  it("uses sample number when the name is blank", () => {
    expect(overviewSampleLabel({ ...a, sample_name: "  " })).toBe("P260001");
  });
  it("finds any associated sample by name or number, case-insensitively", () => {
    expect(orderSamplesMatchSearch(linked, "BETA")).toBe(true);
    expect(orderSamplesMatchSearch(linked, "p260002")).toBe(true);
    expect(orderSamplesMatchSearch(linked, "missing")).toBe(false);
    expect(orderSamplesMatchSearch({ samples: a }, "Alpha")).toBe(true);
  });
  it("sorts on the first stable associated name ascending and descending", () => {
    const orders = [{ samples: b }, linked];
    const compare = (x: typeof orders[number], y: typeof orders[number]) =>
      orderSampleSortValue(x).localeCompare(orderSampleSortValue(y));
    expect([...orders].sort(compare)).toEqual([linked, { samples: b }]);
    expect([...orders].sort((x, y) => -compare(x, y))).toEqual([{ samples: b }, linked]);
  });
});