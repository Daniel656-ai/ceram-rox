import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormField } from "@/lib/api/formFields";

const { listForms, listFields, createField, createForm } = vi.hoisted(() => ({
  listForms: vi.fn(),
  listFields: vi.fn(),
  createField: vi.fn(),
  createForm: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    formDefinitions: { list: listForms, create: createForm },
    formFields: { listForForm: listFields, create: createField },
  },
}));

import {
  ensureM3Template,
  M3_CALC_FIELDS,
  M3_CONFIRM_FIELDS,
  M3_CONTROL_FIELDS,
  M3_HEADER_FIELDS,
  M3_ROWS_KEY,
  M3_ROW_FIELDS,
  seedMissingM3Fields,
} from "../template";

const formId = "m3-form-id";

const existingField = (field_key: string, overrides: Partial<FormField> = {}): FormField => ({
  id: `${field_key}-id`,
  form_id: formId,
  field_key,
  display_name: `Benutzerlabel ${field_key}`,
  description: null,
  field_type: field_key === M3_ROWS_KEY ? "repeater" : "text",
  category: "Benutzergruppe",
  unit: null,
  is_required: false,
  default_value: null,
  validation: {},
  min_value: null,
  max_value: null,
  decimal_places: null,
  readonly: false,
  formula: null,
  select_options: [],
  ref_target: null,
  parent_field_id: null,
  sort_order: 99,
  metadata: { custom: true },
  global_field_id: null,
  binding_path: null,
  is_result: false,
  result_label: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  createField.mockImplementation(async (payload) => existingField(payload.field_key, {
    ...payload,
    id: `${payload.field_key}-created-id`,
  }));
});

describe("m³-Vorlagenstruktur", () => {
  it("ergänzt eine leere bestehende Vorlage um exakt 44 Elemente", async () => {
    const result = await seedMissingM3Fields(formId, []);

    expect(result.existingKeys).toEqual([]);
    expect(result.createdKeys).toHaveLength(44);
    expect(result.createdKeys).toContain(M3_ROWS_KEY);
    expect(createField).toHaveBeenCalledTimes(44);
    const repeater = createField.mock.calls.find(([payload]) => payload.field_key === M3_ROWS_KEY)?.[0];
    const rowFields = createField.mock.calls.filter(([payload]) => M3_ROW_FIELDS.some((field) => field.field_key === payload.field_key));
    expect(rowFields).toHaveLength(4);
    expect(rowFields.every(([payload]) => payload.parent_field_id === `${repeater.field_key}-created-id`)).toBe(true);
  });

  it("ergänzt nach einem Teil-Seed nur fehlende Schlüssel und ändert vorhandene Felder nicht", async () => {
    const repeater = existingField(M3_ROWS_KEY, { id: "existing-repeater", sort_order: 7 });
    const present = [
      existingField("length_mm", { display_name: "Eigene Länge", sort_order: 3 }),
      repeater,
      existingField("volume_m3", { parent_field_id: repeater.id, sort_order: 5 }),
    ];

    const result = await seedMissingM3Fields(formId, present);

    expect(result.existingKeys).toEqual(["length_mm", M3_ROWS_KEY, "volume_m3"]);
    expect(result.createdKeys).not.toContain("length_mm");
    expect(result.createdKeys).not.toContain(M3_ROWS_KEY);
    expect(result.createdKeys).not.toContain("volume_m3");
    expect(createField).toHaveBeenCalledTimes(41);
    expect(createField.mock.calls.some(([payload]) => payload.display_name === "Eigene Länge")).toBe(false);
    const missingRows = createField.mock.calls.filter(([payload]) => M3_ROW_FIELDS.some((field) => field.field_key === payload.field_key));
    expect(missingRows.every(([payload]) => payload.parent_field_id === repeater.id)).toBe(true);
  });

  it("ändert eine vollständige Vorlage nicht", async () => {
    const repeater = existingField(M3_ROWS_KEY, { id: "complete-repeater" });
    const regularFields = [
      ...M3_HEADER_FIELDS,
      ...M3_CONTROL_FIELDS,
      ...M3_CALC_FIELDS,
      ...M3_CONFIRM_FIELDS,
    ].map((field) => existingField(field.field_key));
    const rowFields = M3_ROW_FIELDS.map((field) =>
      existingField(field.field_key, { parent_field_id: repeater.id })
    );

    const result = await seedMissingM3Fields(formId, [...regularFields, repeater, ...rowFields]);

    expect(result.createdKeys).toEqual([]);
    expect(createField).not.toHaveBeenCalled();
  });

  it("überschreibt keine strukturell abweichenden vorhandenen Repeater-Felder", async () => {
    const repeater = existingField(M3_ROWS_KEY, { id: "existing-repeater" });
    const misplaced = existingField("volume_m3", { parent_field_id: null });

    await expect(seedMissingM3Fields(formId, [repeater, misplaced])).rejects.toThrow(
      /volume_m3.*nicht zum Repeater.*nicht verschoben/
    );
    expect(createField.mock.calls.some(([payload]) => payload.field_key === "volume_m3")).toBe(false);
  });

  it("meldet den konkreten Feldschlüssel und kann beim nächsten Aufruf fortsetzen", async () => {
    createField.mockRejectedValueOnce({ message: "insert denied", code: "42501" });
    await expect(seedMissingM3Fields(formId, [])).rejects.toThrow(/order_number.*insert denied.*42501/);

    createField.mockClear();
    createField.mockImplementation(async (payload) => existingField(payload.field_key, {
      ...payload,
      id: `${payload.field_key}-created-id`,
    }));
    const partial = [existingField("order_number")];
    const retried = await seedMissingM3Fields(formId, partial);
    expect(retried.createdKeys).not.toContain("order_number");
    expect(retried.createdKeys).toHaveLength(43);
  });

  it("verwendet ausschließlich die vorhandene Vorlage und erzeugt bei fehlender Vorlage keine neue", async () => {
    listForms.mockResolvedValueOnce([{ id: formId, name: " m3-Liste ", scope: "template" }]);
    listFields.mockResolvedValueOnce([]);
    await expect(ensureM3Template()).resolves.toBe(formId);
    expect(createForm).not.toHaveBeenCalled();

    listForms.mockResolvedValueOnce([]);
    await expect(ensureM3Template()).rejects.toThrow(/keine neue Vorlage erzeugt/);
    expect(createForm).not.toHaveBeenCalled();
  });
});