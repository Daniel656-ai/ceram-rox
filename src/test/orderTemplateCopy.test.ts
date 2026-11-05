import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPayloadFromDraft, buildPayloadFromOrder, consolidateTemplateRows, DEFAULT_COPY_OPTIONS, diffAgainstBaseline, templateRowFingerprint } from "@/lib/orderTemplateCopy";
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

describe("consolidation of per-sample fanned-out rows", () => {
  const fanOutSource = (opts?: { differingValue?: boolean; duplicateSample?: boolean }) => {
    const samples = ["p1", "p2", "p3", "p4", "p5"];
    const mk = (serviceId: string, serviceName: string, sampleId: string, textValue: string) => ({
      id: `${serviceId}-${sampleId}-${textValue}`,
      service_id: serviceId,
      sample_id: sampleId,
      measurement_services: { service_name: serviceName },
      source_package_id: null,
      measurement_parameters: [{ parameter_name: "text", parameter_value: textValue }],
    });
    const rows = [
      ...samples.map((s) => mk("s1", "Leistung A", s, "014")),
      ...samples.map((s) => mk("s2", "Leistung B", s, "014")),
    ];
    if (opts?.differingValue) rows[2] = mk("s1", "Leistung A", "p3", "999");
    if (opts?.duplicateSample) rows[1] = mk("s1", "Leistung A", "p1", "014");
    return { id: "source", order_number: "OLD", order_kind: "labor", shared_form_data: null, order_measurements: rows };
  };

  it("5 samples with 2 identical services become exactly 2 template cards", async () => {
    mocks.get.mockResolvedValue(fanOutSource());
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    expect(payload.measurements).toHaveLength(2);
    expect(payload.measurements?.map((m) => m.service_id).sort()).toEqual(["s1", "s2"]);
    // Full conditions are kept on every card.
    for (const m of payload.measurements ?? []) {
      expect(payload.measurementFormValues?.[m.uid]).toEqual({ text: "014" });
    }
  });

  it("new sample count is independent of the original sample count", async () => {
    mocks.get.mockResolvedValue(fanOutSource());
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    // 5 source samples still yield 2 cards; no sample is preselected, so 3 or 5
    // new samples create 6 or 10 tasks in the unchanged creation loop (2 × N).
    expect(payload.measurements).toHaveLength(2);
    expect(payload.selectedSampleIds).toEqual([]);
  });

  it("differing measurement conditions are detected and never merged", async () => {
    mocks.get.mockResolvedValue(fanOutSource({ differingValue: true }));
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    // The 4 identical s1 rows still merge; the differing row stays separate → 3 cards.
    expect(payload.measurements).toHaveLength(3);
    const values = (payload.measurements ?? []).map((m) => payload.measurementFormValues?.[m.uid]);
    expect(values.filter((v) => v?.text === "999")).toHaveLength(1);
    expect(values.filter((v) => v?.text === "014")).toHaveLength(2);
  });

  it("consciously double-booked services on the same sample are preserved", async () => {
    mocks.get.mockResolvedValue(fanOutSource({ duplicateSample: true }));
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    // p1 appears twice for s1 → no fan-out merge for s1; s2 still merges.
    expect(payload.measurements).toHaveLength(6);
    expect(payload.measurements?.filter((m) => m.service_id === "s1")).toHaveLength(5);
    expect(payload.measurements?.filter((m) => m.service_id === "s2")).toHaveLength(1);
  });

  it("rows without any sample reference are never auto-merged", async () => {
    const src = fanOutSource();
    for (const m of src.order_measurements) m.sample_id = null;
    mocks.get.mockResolvedValue(src);
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    expect(payload.measurements).toHaveLength(10);
  });

  it("baseline diff ignores a changed sample count but reports changed conditions", async () => {
    mocks.get.mockResolvedValue(fanOutSource());
    const { payload } = await buildPayloadFromOrder("source", DEFAULT_COPY_OPTIONS);
    const baseline = JSON.parse(JSON.stringify(payload));
    // Changed sample count (0 → 3) must not count as a condition change.
    const withSamples = { ...payload, selectedSampleIds: ["n1", "n2", "n3"] };
    expect(diffAgainstBaseline(baseline, withSamples).changed).toEqual([]);
    // A changed condition is reported.
    const uid = payload.measurements?.[0].uid ?? "";
    const modified = JSON.parse(JSON.stringify(payload));
    modified.measurementFormValues[uid].text = "999";
    const diff = diffAgainstBaseline(baseline, modified);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toMatchObject({ fieldKey: "text", baseline: "014", current: "999" });
  });

  it("existing drafts restore unchanged (buildPayloadFromDraft keeps every card)", () => {
    const draft = {
      measurements: [1, 2, 3].map((n) => ({ uid: String(n), service_id: "s", service_name: "S", origin: "manual" as const })),
      measurementFormValues: { "1": { text: "014" }, "2": { text: "014" }, "3": { text: "999" } },
      selectedSampleIds: ["a", "b", "c"],
    };
    const copied = buildPayloadFromDraft(draft, DEFAULT_COPY_OPTIONS);
    expect(copied.measurements).toHaveLength(3);
    expect(Object.keys(copied.measurementFormValues ?? {})).toHaveLength(3);
  });
});

describe("pure consolidation helpers", () => {
  it("fingerprint ignores volatile identities but reacts to value changes", () => {
    const a = templateRowFingerprint("s", { rows: [{ t: 1, __id: "x" }] }, {});
    const b = templateRowFingerprint("s", { rows: [{ t: 1, __id: "y", __instance_id: "z" }] }, {});
    const c = templateRowFingerprint("s", { rows: [{ t: 2, __id: "x" }] }, {});
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(templateRowFingerprint("s1", {}, {})).not.toBe(templateRowFingerprint("s2", {}, {}));
  });

  it("consolidateTemplateRows merges only clear per-sample fan-outs", () => {
    const row = (sample_id: string | null, fingerprint = "f") => ({ sample_id, fingerprint });
    expect(consolidateTemplateRows([row("p1"), row("p2"), row("p3")])).toEqual([[0]]);
    expect(consolidateTemplateRows([row("p1"), row("p1")])).toEqual([[0], [1]]);
    expect(consolidateTemplateRows([row(null), row(null)])).toEqual([[0], [1]]);
    expect(consolidateTemplateRows([row("p1", "a"), row("p2", "b")])).toEqual([[0], [1]]);
    // Order of first occurrence is kept.
    expect(consolidateTemplateRows([row("p1", "a"), row("p9", "b"), row("p2", "a")])).toEqual([[0], [1]]);
  });
});
