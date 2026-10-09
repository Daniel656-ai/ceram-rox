import { describe, it, expect } from "vitest";
import { buildSampleOrderMap, orderLabel } from "@/lib/samples/orderLinks";

const o = (id: string, n: string | null, extra: any = {}) => ({ id, order_number: n, ...extra });

describe("sample ↔ order links", () => {
  it("dedupliziert über IDs aus mehreren Quellen und sortiert", () => {
    const m = buildSampleOrderMap([
      { sample_id: "s1", order: o("b", "FG-260002") },
      { sample_id: "s1", order: o("a", "FG-260001") },
      { sample_id: "s1", order: o("b", "FG-260002") },
      { sample_id: "s2", order: null },
      { sample_id: null, order: o("c", "X") },
    ]);
    expect(m.get("s1")!.map((x) => x.id)).toEqual(["a", "b"]);
    expect(m.has("s2")).toBe(false);
  });
  it("Beschriftung je Auftragstyp ohne Namensraten", () => {
    expect(orderLabel(o("1", "FG-260001", { pp_experiment_number: "TE-123" }))).toBe("FG-260001 – TE-123");
    expect(orderLabel(o("2", "FG-260002", { customer_name: "Miratech" }))).toBe("FG-260002 – Miratech");
    expect(orderLabel(o("3", "FG-260003"))).toBe("FG-260003");
    expect(orderLabel(o("abcdef1234", null))).toBe("#abcdef12");
  });
});
