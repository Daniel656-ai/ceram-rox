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
    const uid = payload.measurements![0].uid;
    expect(payload.measurementFormValues![uid]).toEqual({
      no_36cd: 0, nh3_09e9: 240, so2_a4fa: "", o2_3147: 12, h2o_ac6f: 12, temperatur_1_5f0d: 250, flag: false,
    });
  });
});
