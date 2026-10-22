import { beforeEach, describe, expect, it, vi } from "vitest";
import { orderIdentity } from "@/lib/orders/orderIdentity";

const state = vi.hoisted(() => ({
  row: {} as Record<string, any>,
  updates: [] as Record<string, any>[],
  fields: vi.fn(),
  error: null as { message: string } | null,
}));

vi.mock("../formFields", () => ({ formFields: { listForForm: state.fields } }));
vi.mock("../client", () => ({ dbClient: {
  from: (table: string) => {
    if (table !== "measurement_orders") throw new Error(`Unexpected table: ${table}`);
    const query = {
      select: () => query,
      eq: (_key: string, id: string) => {
        if (id !== "order-1") throw new Error("Wrong order");
        return query;
      },
      single: async () => ({ data: state.row, error: null }),
      update: (patch: Record<string, any>) => {
        state.updates.push(patch);
        if (!state.error) state.row = { ...state.row, ...patch };
        return query;
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: state.row, error: state.error }).then(resolve, reject),
    };
    return query;
  },
} }));

const { orderSharedFormData } = await import("../workflowDesigner");

beforeEach(() => {
  state.row = { id: "order-1", order_kind: "pilot_plant", order_number: "ABC260001", pp_experiment_number: "manual-27", shared_form_data: { untouched: { value: "keep" } } };
  state.updates = [];
  state.error = null;
  state.fields.mockReset().mockResolvedValue([{ field_key: "versuchsnummer", binding_path: "order.versuchsnummer" }]);
});

describe("order template save boundary", () => {
  it("saves raw form values and the trimmed column in the same order update, then reads back its identity", async () => {
    const template = { form_definition_id: "pp-form", values: { versuchsnummer: "  NC26-028_CC  ", massetyp: ["Heat Media"] } };
    await orderSharedFormData.merge("order-1", { template });
    expect(state.fields).toHaveBeenCalledWith("pp-form");
    expect(state.updates).toEqual([{ shared_form_data: { untouched: { value: "keep" }, template }, pp_experiment_number: "NC26-028_CC" }]);
    expect(await orderSharedFormData.get("order-1")).toEqual({ untouched: { value: "keep" }, template });
    expect(orderIdentity(state.row).number).toBe("NC26-028_CC");
    expect(orderIdentity(state.row).missingExperimentNumber).toBe(false);
  });

  it("preserves the existing column while storing an empty form value unchanged", async () => {
    const template = { form_definition_id: "pp-form", values: { versuchsnummer: "  " } };
    await orderSharedFormData.merge("order-1", { template });
    expect(state.updates[0]).not.toHaveProperty("pp_experiment_number");
    expect(state.row.pp_experiment_number).toBe("manual-27");
    expect(state.row.shared_form_data.template).toEqual(template);
  });

  it("resolves the saved form definition for a later explicit values save", async () => {
    state.row.shared_form_data.template = { form_definition_id: "pp-form", values: { versuchsnummer: "old" } };
    await orderSharedFormData.merge("order-1", { template: { values: { versuchsnummer: "  12345  " } } });
    expect(state.fields).toHaveBeenCalledWith("pp-form");
    expect(state.row.pp_experiment_number).toBe("12345");
  });

  it("does not backfill on reads or unrelated patches", async () => {
    state.row.shared_form_data.template = { form_definition_id: "pp-form", values: { versuchsnummer: "historical" } };
    await orderSharedFormData.get("order-1");
    expect(state.updates).toEqual([]);
    await orderSharedFormData.merge("order-1", { unrelated: "saved" });
    expect(state.fields).not.toHaveBeenCalled();
    expect(state.updates[0]).not.toHaveProperty("pp_experiment_number");
    expect(state.row.pp_experiment_number).toBe("manual-27");
  });

  it("propagates permission failures without retrying or bypassing restrictions", async () => {
    state.error = { message: "permission denied" };
    await expect(orderSharedFormData.merge("order-1", { template: { form_definition_id: "pp-form", values: { versuchsnummer: "12345" } } })).rejects.toEqual(state.error);
    expect(state.updates).toHaveLength(1);
    expect(state.row.pp_experiment_number).toBe("manual-27");
  });
});