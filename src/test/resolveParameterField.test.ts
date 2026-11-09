import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), fields: vi.fn(), links: vi.fn(), formFields: vi.fn(), definitions: vi.fn(), layout: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { orders: { get: mocks.get }, serviceDataFields: { listForService: mocks.fields }, serviceFormLinks: { listForService: mocks.links }, formFields: { listForForm: mocks.formFields }, serviceParameters: { listForService: mocks.definitions }, serviceFormLayouts: { get: mocks.layout } } }));

import { buildPayloadFromOrder, DEFAULT_COPY_OPTIONS, resolveParameterField } from "@/lib/orderTemplateCopy";

const fld = (field_key: string, display_name: string, extra: Record<string, unknown> = {}) =>
  ({ id: field_key, field_key, display_name, field_type: "decimal", is_result: false, metadata: {}, archived: false, ...extra });
const form = (fields: ReturnType<typeof fld>[]) => [{ formId: "F", fields }];

describe("resolveParameterField", () => {
  it("1: direktes Dienstleistungsfeld NO hat Vorrang vor gleichnamigem Formularfeld", () => {
    const r = resolveParameterField("NO", [fld("no_36cd", "NO")], form([fld("no", "NO")]));
    expect(r?.key).toBe("no_36cd");
  });
  it("2: archiviertes Feld NO wird ignoriert", () => {
    const r = resolveParameterField("NO", [fld("no_old", "NO", { archived: true }), fld("no_36cd", "NO")], []);
    expect(r?.key).toBe("no_36cd");
  });
  it("3: zwei aktive direkte Felder mit gleichem Anzeigenamen → Abbruch", () => {
    expect(() => resolveParameterField("NO", [fld("a", "NO"), fld("b", "NO")], [])).toThrow("nicht eindeutig");
  });
  it("4: ohne direktes Feld wird genau ein Formularfeld verwendet", () => {
    expect(resolveParameterField("NO", [fld("co", "CO")], form([fld("no", "NO")]))?.key).toBe("form:F:no");
  });
  it("5: mehrere gleichrangige Formularfelder → Abbruch", () => {
    expect(() => resolveParameterField("NO", [], form([fld("x", "NO"), fld("y", "NO")]))).toThrow("nicht eindeutig");
    expect(() => resolveParameterField("NO", [], [{ formId: "A", fields: [fld("NO", "x")] }, { formId: "B", fields: [fld("NO", "y")] }])).toThrow("nicht eindeutig");
  });
  it("6: exakter field_key schlägt display_name", () => {
    expect(resolveParameterField("NO", [fld("NO", "Stickstoff"), fld("z", "NO")], [])?.key).toBe("NO");
    expect(resolveParameterField("NO", [], form([fld("NO", "a"), fld("z", "NO")]))?.key).toBe("form:F:NO");
  });
  it("archiviertes Formularfeld zählt nicht", () => {
    expect(resolveParameterField("NO", [], form([fld("x", "NO", { archived: true }), fld("y", "NO")]))?.key).toBe("form:F:y");
  });
  it("kein Treffer → undefined (bestehender Legacy-Pfad greift)", () => {
    expect(resolveParameterField("NO", [fld("co", "CO")], [])).toBeUndefined();
  });
});

describe("Vorlagenübernahme NOX-Messung", () => {
  const params = [["NO", "0"], ["NH3", "240"], ["SO2", ""], ["O2", "12"], ["H2O", "12"], ["Temperatur 1", "250"], ["Flag", "false"]];
  beforeEach(() => {
    mocks.get.mockResolvedValue({ id: "o", order_measurements: [{ id: "m", service_id: "nox", sample_id: null, measurement_services: { service_name: "NOX-Messung" },
      measurement_parameters: params.map(([parameter_name, parameter_value]) => ({ parameter_name, parameter_value })) }] });
    mocks.fields.mockResolvedValue([
      fld("no_36cd", "NO"), fld("no_old", "NO", { archived: true }), fld("nh3_09e9", "NH3"), fld("so2_a4fa", "SO2"),
      fld("o2_3147", "O2"), fld("h2o_ac6f", "H2O"), fld("temperatur_1_5f0d", "Temperatur 1"), fld("flag", "Flag", { field_type: "boolean" }),
    ]);
    mocks.links.mockResolvedValue([{ form_definition_id: "F" }]);
    mocks.formFields.mockResolvedValue([fld("no_in_ppm", "NO"), fld("NO", "NO in ppm"), fld("o2", "O2")]);
    mocks.definitions.mockResolvedValue([]); mocks.layout.mockResolvedValue(null);
  });
  it("7+8+9: alle Vorgaben eindeutig, 0/false/leer bleiben unterscheidbar", async () => {
    const { payload } = await buildPayloadFromOrder("o", DEFAULT_COPY_OPTIONS);
    const uid = payload.measurements?.[0]?.uid ?? "";
    expect(payload.measurementFormValues?.[uid]).toEqual({
      no_36cd: 0, nh3_09e9: 240, so2_a4fa: "", o2_3147: 12, h2o_ac6f: 12, temperatur_1_5f0d: 250, flag: false,
    });
  });
});

describe("exact linked identities without result-value copying", () => {
  const gases = [["no", "NO"], ["nh3", "NH₃"], ["o2", "O₂"], ["h2o", "H₂O"]];
  const linked = ["A", "B"].map(formId => ({ formId, fields: gases.map(([key, label]) => fld(key, label)) }));
  beforeEach(() => {
    mocks.fields.mockResolvedValue([fld("temperature", "Temperatur")]);
    mocks.links.mockResolvedValue(linked.map(link => ({ form_definition_id: link.formId })));
    mocks.formFields.mockImplementation(async id => linked.find(link => link.formId === id)?.fields ?? []);
    mocks.definitions.mockResolvedValue([]);
    mocks.layout.mockResolvedValue(null);
  });
  const row = (id: string, refs: string[] = [], parameters = [{ parameter_name: "NO", parameter_value: "0" }]) => ({
    id, service_id: id, measurement_services: { service_name: `Gas ${id}` },
    measurement_parameters: [...parameters, { parameter_name: "Temperatur", parameter_value: "250" }],
    measurement_results: refs.map(result_name => ({ result_name, result_value: 999, is_official: true })),
  });
  const copy = async (rows: ReturnType<typeof row>[]) => {
    mocks.get.mockResolvedValue({ id: "o", order_measurements: rows });
    return buildPayloadFromOrder("o", DEFAULT_COPY_OPTIONS);
  };
  it.each(gases)("disambiguates %s in two forms by exact result_name", (key, label) => {
    expect(resolveParameterField(label, [], linked, [{ result_name: `form:B:${key}` }])?.key).toBe(`form:B:${key}`);
  });
  it("uses parameter zero, never official result value 999", async () => {
    const { payload, warnings } = await copy([row("s", ["form:B:no"])]);
    const uid = payload.measurements?.[0]?.uid ?? "";
    expect(payload.measurementFormValues?.[uid]).toEqual({ "form:B:no": 0, temperature: 250 });
    expect(warnings).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain("999");
  });
  it("missing references skip only ambiguous NO", async () => {
    const { payload, warnings } = await copy([row("s")]);
    expect(warnings).toEqual([{ serviceId: "s", serviceName: "Gas s", measurementId: "s", parameterName: "NO", formIds: ["A", "B"] }]);
    expect(payload.measurementFormValues?.[payload.measurements?.[0]?.uid ?? ""]).toEqual({ temperature: 250 });
  });
  it("conflicting references never choose the first candidate", async () => {
    const { payload, warnings } = await copy([row("s", ["form:A:no", "form:B:no"])]);
    expect(warnings).toHaveLength(1);
    expect(payload.measurementFormValues?.[payload.measurements?.[0]?.uid ?? ""]).toEqual({ temperature: 250 });
  });
  it("direct service fields retain priority even with a linked identity", () => {
    expect(resolveParameterField("NO", [fld("direct_no", "NO")], linked, [{ result_name: "form:B:no" }])?.key).toBe("direct_no");
  });
  it("keeps empty optional values", async () => {
    const { payload } = await copy([row("s", ["form:A:no"], [{ parameter_name: "NO", parameter_value: "" }])]);
    expect(payload.measurementFormValues?.[payload.measurements?.[0]?.uid ?? ""]?.["form:A:no"]).toBe("");
  });
  it("services use only their own identity index and preserve all other gas inputs", async () => {
    const parameters = gases.map(([, label], i) => ({ parameter_name: label, parameter_value: String(i) }));
    const { payload, warnings } = await copy([
      row("s1", gases.map(([key]) => `form:A:${key}`), parameters),
      row("s2", gases.map(([key]) => `form:B:${key}`), parameters),
      row("s3", [], parameters),
    ]);
    expect(payload.measurements).toHaveLength(3);
    for (const [i, prefix] of ["A", "B"].entries()) {
      const uid = payload.measurements?.[i]?.uid ?? "";
      expect(payload.measurementFormValues?.[uid]).toEqual({ temperature: 250, ...Object.fromEntries(gases.map(([key], n) => [`form:${prefix}:${key}`, n])) });
    }
    expect(warnings.map(w => [w.serviceId, w.parameterName])).toEqual(gases.map(([, label]) => ["s3", label]));
  });
  it("duplicate result rows for one identity count as one candidate", () => {
    expect(resolveParameterField("NO", [], linked, [{ result_name: "form:B:no" }, { result_name: "form:B:no" }])?.key).toBe("form:B:no");
  });
  it("nonexact and unrelated references do not disambiguate", () => {
    expect(() => resolveParameterField("NO", [], linked, [{ result_name: "form:B:no:extra" }, { result_name: "form:C:no" }])).toThrow("nicht eindeutig");
  });
  it("duplicate parameter labels are all skipped, not overwritten", async () => {
    const { payload, warnings } = await copy([row("s", ["form:A:no"], [{ parameter_name: "NO", parameter_value: "0" }, { parameter_name: "NO", parameter_value: "12" }])]);
    expect(warnings).toHaveLength(1);
    expect(payload.measurementFormValues?.[payload.measurements?.[0]?.uid ?? ""]).toEqual({ temperature: 250 });
  });
  it("unresolvable legacy parameters warn instead of aborting", async () => {
    const { payload, warnings } = await copy([row("s", [], [{ parameter_name: "old", parameter_value: "5" }])]);
    expect(warnings[0].parameterName).toBe("old");
    expect(payload.measurementFormValues?.[payload.measurements?.[0]?.uid ?? ""]).toEqual({ temperature: 250 });
  });
});
