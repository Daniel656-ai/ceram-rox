import { beforeEach, describe, expect, it, vi } from "vitest";
import { measurementResults } from "../measurementResults";

const state = vi.hoisted(() => ({
  ids: [] as string[], selections: [] as string[], repeated: false, failure: false,
}));
vi.mock("../serviceFormLinks", () => ({ serviceFormLinks: { listForService: async () => {
  if (state.failure) throw new Error("unreadable metadata");
  return [{ form_definition_id: "form" }];
} } }));
vi.mock("../serviceFormLayouts", () => ({ serviceFormLayouts: { get: async () => null } }));
vi.mock("../formFields", () => ({ formFields: { listForForm: async () => [{ field_type: state.repeated ? "measurement_block" : "number" }] } }));
vi.mock("../client", () => ({ dbClient: { from: (table: string) => {
  const q = {
    select: (s: string) => { state.selections.push(s); return q; },
    in: (key: string, ids: string[]) => { if (key !== "id") throw new Error("wrong scope"); state.ids = ids; return q; },
    eq: () => q,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, data: table === "service_data_fields" ? [] : [{
      id: "m1", order_id: "o1", sample_id: "s1", service_id: "svc",
      measurement_parameters: [{ id: "p", order_measurement_id: "m1", parameter_name: "AV", parameter_value: "0.00", unit: null }],
      measurement_results: [{ id: "official", result_name: "eta", instance_key: null }, { id: "nonofficial", result_name: "hidden", instance_key: "run2" }],
    }] }).then(resolve),
  }; return q;
} } }));
beforeEach(() => { state.ids = []; state.selections = []; state.repeated = false; state.failure = false; });
describe("supplemental requester source read", () => {
  it("reads exact measurement IDs with all result identities and scoped parameters", async () => {
    const rows = await measurementResults.listRequesterTaskSources(["m1"]);
    expect(state.ids).toEqual(["m1"]);
    expect(rows[0].measurementId).toBe("m1");
    expect(rows[0].parameters[0].order_measurement_id).toBe("m1");
    expect(rows[0].results.map(r => r.id)).toEqual(["official", "nonofficial"]);
    expect(state.selections[0]).toContain("instance_context");
    expect(rows[0].structureChecked).toBe(true);
  });
  it("recognizes linked measurement blocks even without a keyed official result", async () => {
    state.repeated = true;
    expect((await measurementResults.listRequesterTaskSources(["m1"]))[0].repeatedStructure).toBe(true);
  });
  it("does not authorize fallback after failed metadata loading", async () => {
    state.failure = true;
    expect((await measurementResults.listRequesterTaskSources(["m1"]))[0].structureChecked).toBe(false);
  });
  it("does not read when there is no selected measurement", async () => {
    expect(await measurementResults.listRequesterTaskSources([])).toEqual([]);
    expect(state.selections).toEqual([]);
  });
});