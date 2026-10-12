import { describe, it, expect } from "vitest";
import { isProjectRequired, isSampleFormComplete } from "./projectRequirement";

const base = { sample_name: "P", description: "d", post_measurement_action: "aufbewahren", project_id: "" };

describe("isProjectRequired", () => {
  it("customer/production optional, rnd required, empty not yet", () => {
    expect(isProjectRequired("customer")).toBe(false);
    expect(isProjectRequired("production")).toBe(false);
    expect(isProjectRequired("rnd")).toBe(true);
    expect(isProjectRequired("")).toBe(false);
  });
});

describe("isSampleFormComplete", () => {
  it("allows sample without project when not required", () => {
    expect(isSampleFormComplete(base, false)).toBe(true);
  });
  it("blocks sample without project when required", () => {
    expect(isSampleFormComplete(base, true)).toBe(false);
    expect(isSampleFormComplete({ ...base, project_id: "x" }, true)).toBe(true);
  });
  it("keeps other mandatory fields", () => {
    expect(isSampleFormComplete({ ...base, description: " " }, false)).toBe(false);
    expect(isSampleFormComplete({ ...base, post_measurement_action: "" }, false)).toBe(false);
  });
});
