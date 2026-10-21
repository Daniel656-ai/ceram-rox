import { describe, expect, it } from "vitest";
import { orderSampleLinks, orderSamples } from "@/lib/orders/orderSamples";

const sample = (id: string, name = "Probe", number = "P260001") => ({ id, sample_name: name, sample_number: number });

describe("readable current order samples", () => {
  it("links one readable direct sample to its existing detail route", () => {
    expect(orderSampleLinks({ id: "o1", sample_id: "s1", current_sample: sample("s1") }))
      .toEqual([{ id: "s1", href: "/proben/s1", label: "Probe" }]);
  });
  it("includes all distinct samples from all five valid relationships", () => {
    const order = {
      id: "o1", sample_id: "s1", current_sample: sample("s1"),
      order_samples: [{ sample_id: "s2", samples: sample("s2") }],
      order_measurements: [{ sample_id: "s3", current_sample: sample("s3") }],
      linked_samples: [{ ...sample("s4"), order_id: "o1" }],
      produced_samples: [{ ...sample("s5"), pilot_plant_order_id: "o1" }],
    };
    expect(orderSamples(order).map(s => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });
  it("deduplicates the same UUID across relationships", () => {
    expect(orderSamples({ id: "o1", sample_id: "s1", current_sample: sample("s1"),
      order_samples: [{ sample_id: "s1", samples: sample("s1") }],
      order_measurements: [{ sample_id: "s1", current_sample: sample("s1") }],
      linked_samples: [{ ...sample("s1"), order_id: "o1" }],
    })).toHaveLength(1);
  });
  it("distinguishes different UUIDs with equal names using existing numbers", () => {
    expect(orderSampleLinks({ id: "o1", order_samples: [
      { sample_id: "s1", samples: sample("s1", "Gleich", "P260001") },
      { sample_id: "s2", samples: sample("s2", "Gleich", "P260002") },
    ] }).map(s => s.label)).toEqual(["Gleich (P260001)", "Gleich (P260002)"]);
  });
  it("returns no links without sample associations", () => {
    expect(orderSampleLinks({ id: "o1" })).toEqual([]);
  });
  it("never creates a name or link from IDs when RLS removed the sample", () => {
    expect(orderSampleLinks({ id: "o1", sample_id: "hidden", current_sample: null,
      order_samples: [{ sample_id: "hidden", samples: null }],
      order_measurements: [{ sample_id: "hidden", current_sample: null }],
    })).toEqual([]);
  });
  it("does not include original_sample_id without independent current association", () => {
    const order = { id: "o1", order_measurements: [{ sample_id: "s2", current_sample: sample("s2"),
      original_sample_id: "s1", original_sample: sample("s1") }] };
    expect(orderSamples(order).map(s => s.id)).toEqual(["s2"]);
  });
  it("retains an original sample if independently linked as an order sample", () => {
    const order = { id: "o1", sample_id: "s1", current_sample: sample("s1"),
      order_measurements: [{ original_sample_id: "s1", sample_id: "s2", current_sample: sample("s2") }] };
    expect(orderSamples(order).map(s => s.id)).toEqual(["s1", "s2"]);
  });
  it("rejects mismatched UUIDs and unrelated reverse links", () => {
    expect(orderSamples({ id: "o1", sample_id: "s1", current_sample: sample("s2"),
      linked_samples: [{ ...sample("s3"), order_id: "o2" }],
      produced_samples: [{ ...sample("s4"), pilot_plant_order_id: "o2" }],
    })).toEqual([]);
  });
  it("does not use the UUID as a label for an unnamed sample", () => {
    expect(orderSampleLinks({ id: "o1", sample_id: "s1", current_sample: sample("s1", " ") })).toEqual([]);
  });
  it("preserves input data, order fields and measurement metadata", () => {
    const order = { id: "o1", order_number: "ABC260001", order_kind: "labor", status: "open", ranking: 2,
      sample_id: "s1", current_sample: sample("s1"),
      order_measurements: [{ assigned_to: "user", sample_id: "s1", current_sample: sample("s1"), measurement_services: { category: "labor" } }] };
    const before = structuredClone(order);
    orderSampleLinks(order);
    expect(order).toEqual(before);
  });
});