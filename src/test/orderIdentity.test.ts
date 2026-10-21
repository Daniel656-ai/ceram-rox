import { describe, expect, it } from "vitest";
import { orderIdentity } from "@/lib/orders/orderIdentity";
import { matchesOrderKindFilter } from "@/lib/orders/orderKind";

const services = (...categories: string[]) => categories.map(category => ({ measurement_services: { category } }));

describe("Pilot Plant display identity", () => {
  it("leads with an existing manual experiment number without changing it", () => {
    const order = { id: "order-uuid", order_kind: "pilot_plant", order_number: "ABC260001", pp_experiment_number: "V26-027_custom_CC" };
    const before = JSON.stringify(order);
    expect(orderIdentity(order)).toEqual({ number: "V26-027_custom_CC", technicalNumber: "ABC260001", hasExperimentNumber: true, missingExperimentNumber: false });
    expect(JSON.stringify(order)).toBe(before);
    expect(order.id).toBe("order-uuid");
  });

  it("does not invent a number or derive one from reference_number", () => {
    const order = { order_kind: "pilot_plant", order_number: "SW-260025", reference_number: "V26-027", pp_experiment_number: null };
    expect(orderIdentity(order)).toEqual({ number: "SW-260025", technicalNumber: "SW-260025", hasExperimentNumber: false, missingExperimentNumber: true });
    expect(order.pp_experiment_number).toBeNull();
  });

  it("treats an empty experiment number as missing", () => {
    expect(orderIdentity({ order_kind: "pilot_plant", order_number: "ABC260001", pp_experiment_number: "   " }).number).toBe("ABC260001");
  });

  it("does not introduce prefixes for customer, production or research orders", () => {
    for (const order_type of ["customer", "production", "rnd"]) {
      const order = { order_kind: "pilot_plant", order_type, order_number: "ABC260001", pp_experiment_number: null };
      expect(orderIdentity(order).number).toBe("ABC260001");
      expect(order.pp_experiment_number).toBeNull();
    }
  });

  it("keeps the technical number for lab orders", () => {
    expect(orderIdentity({ order_kind: "labor", order_number: "ABC260002", pp_experiment_number: "V26-027" }).number).toBe("ABC260002");
  });

  it("uses the central classification for historical PP orders", () => {
    expect(orderIdentity({ order_kind: "legacy", order_number: "ABC260003", pp_experiment_number: "V26-028", order_measurements: services("pilot_plant", "pilot_plant") }).number).toBe("V26-028");
  });

  it("DGA260005 remains classic and is excluded from both specific filters", () => {
    const order = { order_kind: "legacy", order_number: "DGA260005", pp_experiment_number: "V26-029", order_measurements: services("labor", "pilot_plant") };
    expect(orderIdentity(order).number).toBe("DGA260005");
    expect(matchesOrderKindFilter(order, "all")).toBe(true);
    expect(matchesOrderKindFilter(order, "labor")).toBe(false);
    expect(matchesOrderKindFilter(order, "pilot_plant")).toBe(false);
  });

  it("the same order has the same identity in overview and result metadata", () => {
    const order = { order_kind: "pilot_plant", order_number: "ABC260004", pp_experiment_number: "NC26-028_CC" };
    const overview = orderIdentity(order);
    const result = orderIdentity({ ...order, order_measurements: services("labor") });
    expect(result).toEqual(overview);
    expect(result.number).toBe("NC26-028_CC");
  });

  it("orders missing classification stay technical rather than guessing from a measurement", () => {
    expect(orderIdentity({ order_number: "ABC260005", pp_experiment_number: "TE26-030" }).number).toBe("ABC260005");
  });
});