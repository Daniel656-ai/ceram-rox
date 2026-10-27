import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPayloadFromDraft, buildPayloadFromOrder, DEFAULT_COPY_OPTIONS } from "@/lib/orderTemplateCopy";
import { copyTemplateInputs } from "@/lib/orderTemplateInputs";
const mocks = vi.hoisted(() => ({ get: vi.fn(), fields: vi.fn(), links: vi.fn(), formFields: vi.fn(), definitions: vi.fn(), layout: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { orders: { get: mocks.get }, serviceDataFields: { listForService: mocks.fields }, serviceFormLinks: { listForService: mocks.links }, formFields: { listForForm: mocks.formFields }, serviceParameters: { listForService: mocks.definitions }, serviceFormLayouts: { get: mocks.layout } } }));
const f = (key: string, type = "text", extras = {}) => ({ id: key, form_id: "f", field_key: key, display_name: key, field_type: type, is_result: false, parent_field_id: null, metadata: {}, ...extras });
const source = () => ({ id: "source", order_number: "OLD", order_kind: "pilot_plant", pp_experiment_number: "OLD-TE", due_date: "2020-01-01", assigned_to: "old-user", shared_form_data: { template: { form_definition_id: "f", values: { text: "014", versuchsnummer: "old", points: [{ temperature: 0, enabled: false, result: 88, __instance_id: "OLD-POINT" }] } } }, order_measurements: [1,2].map(i => ({ id: `old-${i}`, service_id: "s", measurement_services: { service_name: "S" }, source_package_id: "pkg", measurement_results: [{ result_value: 100 }], work_logs: [{ hours: 8 }], measurement_parameters: [{ parameter_name: "text", parameter_value: "014" }, { parameter_name: "temperature", parameter_value: "0" }, { parameter_name: "enabled", parameter_value: "false" }, { parameter_name: "result", parameter_value: "88" }] })) });
beforeEach(() => {
  mocks.get.mockResolvedValue(source());
  mocks.fields.mockResolvedValue([f("text")]);
  mocks.links.mockResolvedValue([{ form_definition_id: "f" }]);
  mocks.formFields.mockResolvedValue([f("temperature", "decimal"), f("enabled", "boolean"), f("result", "decimal", { is_result: true }), f("versuchsnummer"), f("points", "repeater", { metadata: { repeater: { layout: { version: 1, gap: "md", items: ["temperature", "enabled", "result"].map(key => ({ id: `p-${key}`, type: "field", field_id: key, key, width: 12 })) } } } })]);
  mocks.definitions.mockResolvedValue([]); mocks.layout.mockResolvedValue(null);
});
describe("safe independent templates", () => {
  it("copies block to repeater nesting using each placement storage key and original definition scope", () => {
    const placement = (id: string, key: string, value_key = key) => ({ id: `p-${id}`, type: "field", field_id: id, key, value_key, width: 12 });
    const layout = (items: unknown[]) => ({ version: 1, gap: "md", items });
    const fields = [
      f("runs", "measurement_block", { metadata: { measurement_block: { layout: layout([placement("points", "points", "temperatures")]) } } }),
      f("points", "repeater", { metadata: { repeater: { layout: layout([placement("temperature", "temperature", "t")]) } } }), f("temperature", "decimal"),
    ];
    const copied = copyTemplateInputs({ runs: [{ temperatures: [{ t: 0, result: 7 }] }] }, fields);
    const rows = copied.runs as { temperatures: { t: number; result?: number }[] }[];
    expect(rows[0].temperatures[0].t).toBe(0);
    expect(rows[0].temperatures[0]).not.toHaveProperty("result");
  });
  it("keeps duplicate service/package positions with distinct new identities and linked input values, not results", async () => {
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    expect(payload.measurements).toHaveLength(2);
    const ids = payload.measurements?.map(m => m.uid) ?? [];
    expect(new Set(ids).size).toBe(2);
    expect(payload.measurementFormValues?.[ids[0]]).toEqual({ text: "014", "form:f:temperature": 0, "form:f:enabled": false });
    expect(payload.dueDate).toBe(""); expect(payload.selectedSampleIds).toEqual([]);
    expect(payload.dynamicValues).not.toHaveProperty("versuchsnummer");
    expect(JSON.stringify(payload)).not.toContain("old-user");
    expect(JSON.stringify(payload)).not.toContain("result_value");
  });
  it("copies nested input rows without old point identities or computed results", async () => {
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    const points = payload.dynamicValues?.points as Record<string, unknown>[];
    expect(points[0]).toMatchObject({ temperature: 0, enabled: false });
    expect(points[0]).not.toHaveProperty("result");
    expect(points[0].__instance_id).not.toBe("OLD-POINT");
  });
  it("repeated use never changes the source and produces independent drafts", async () => {
    const order = source(); const before = JSON.stringify(order); mocks.get.mockResolvedValue(order);
    const a = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    const b = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    expect(JSON.stringify(order)).toBe(before);
    expect(a.payload.measurements?.[0].uid).not.toBe(b.payload.measurements?.[0].uid);
  });
  it("refuses ambiguous labels instead of guessing or losing a requirement", async () => {
    mocks.fields.mockResolvedValue([f("text"), f("temperature")]);
    await expect(buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS)).rejects.toThrow("nicht eindeutig");
  });
  it("copies draft duplicates and false/zero, clears old date, number and sample by default", () => {
    const old = { dueDate: "2020-01-01", selectedSampleIds: ["sample"], dynamicValues: { versuchsnummer: "OLD", points: [{ value: 0, flag: false }] }, measurements: [1,2].map(n => ({ uid: String(n), service_id: "s", service_name: "S", origin: "template" as const })) };
    const copied = buildPayloadFromDraft(old, DEFAULT_COPY_OPTIONS);
    expect(copied.measurements).toHaveLength(2); expect(copied.dueDate).toBe(""); expect(copied.selectedSampleIds).toEqual([]);
    expect(copied.dynamicValues).toEqual({ points: [{ value: 0, flag: false }] });
    expect(old.dynamicValues.versuchsnummer).toBe("OLD");
  });
  it("only copies sample links when explicitly selected", async () => {
    mocks.get.mockResolvedValue({ ...source(), order_samples: [{ sample_id: "selected" }] });
    const result = await buildPayloadFromOrder("source", { ...DEFAULT_COPY_OPTIONS, samples: true });
    expect(result.payload.selectedSampleIds).toEqual(["selected"]);
  });
});
