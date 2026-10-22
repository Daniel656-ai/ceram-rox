import { describe, expect, it } from "vitest";
import { experimentNumberPatch } from "@/lib/orders/experimentNumber";
import { orderIdentity } from "@/lib/orders/orderIdentity";

describe("explicit experiment-number form saves", () => {
  it("sets the trimmed number and makes it the leading display identity", () => {
    const fields = [{ field_key: "versuchsnummer", binding_path: "order.versuchsnummer" }];
    const values = { versuchsnummer: "  TE26-027_CC  ", massetyp: ["DK"] };
    const before = JSON.stringify(values);
    const order = { order_kind: "pilot_plant", order_number: "ABC260001", ...experimentNumberPatch(fields, values) };
    expect(order.pp_experiment_number).toBe("TE26-027_CC");
    expect(orderIdentity(order).number).toBe("TE26-027_CC");
    expect(orderIdentity(order).missingExperimentNumber).toBe(false);
    expect(order.order_number).toBe("ABC260001");
    expect(JSON.stringify(values)).toBe(before);
  });

  it("uses binding_path before the fallback key", () => {
    expect(experimentNumberPatch([
      { field_key: "actual_number", binding_path: "order.versuchsnummer" },
      { field_key: "versuchsnummer" },
    ], { actual_number: "  12345  ", versuchsnummer: "wrong" })).toEqual({ pp_experiment_number: "12345" });
  });

  it("uses the exact fallback key if no bound field exists", () => {
    expect(experimentNumberPatch([{ field_key: "versuchsnummer" }], { versuchsnummer: "  NC26-028  " }))
      .toEqual({ pp_experiment_number: "NC26-028" });
  });

  it.each(["", "   ", null, undefined])("preserves an existing column number for empty input %s", (value) => {
    const saved = { pp_experiment_number: "manual-27", ...experimentNumberPatch([{ field_key: "versuchsnummer" }], { versuchsnummer: value }) };
    expect(saved.pp_experiment_number).toBe("manual-27");
  });

  it("replaces the column only with an explicitly filled form value", () => {
    expect({ pp_experiment_number: "old", ...experimentNumberPatch([{ field_key: "versuchsnummer" }], { versuchsnummer: "new" }) }.pp_experiment_number).toBe("new");
  });

  it("does not use an unbound value without an existing field definition", () => {
    expect(experimentNumberPatch([], { versuchsnummer: "12345" })).toEqual({});
  });

  it("does not fall back when the authoritative bound field is empty", () => {
    expect(experimentNumberPatch([{ field_key: "actual", binding_path: "order.versuchsnummer" }, { field_key: "versuchsnummer" }], { actual: "", versuchsnummer: "wrong" })).toEqual({});
  });

  it("does not invent a number from malformed or ambiguous values", () => {
    expect(experimentNumberPatch([{ field_key: "versuchsnummer" }], { versuchsnummer: { value: "12345" } })).toEqual({});
    expect(experimentNumberPatch([{ field_key: "a", binding_path: "order.versuchsnummer" }, { field_key: "b", binding_path: "order.versuchsnummer" }], { a: "123", b: "456" })).toEqual({});
  });
});