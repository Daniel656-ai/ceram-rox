import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import { m3DisplayFields } from "@/lib/m3List/template";
import { deriveM3Values, stripDerivedValues } from "@/lib/m3List/derive";
import { applyTestMarking, resolveTestMarking } from "@/lib/m3List/testMarking";
import type { FormField } from "@/lib/api/formFields";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "durchfuehrer" }) }));
vi.mock("@/context/ProcessContextProvider", () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock("@/lib/api", () => ({ api: { globalFields: { list: async () => [] }, formCalculations: { listForForm: async () => [] } } }));
vi.mock("@/components/measurementImport/MeasurementCaseEditorDialog", () => ({ default: () => null }));
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const field = (id: string, key: string, name: string, type: string, parent: string | null = null, metadata = {}): FormField => ({
  id, form_id: "local", field_key: key, display_name: name, field_type: type, parent_field_id: parent, metadata,
  readonly: key === "element_count", unit: key === "element_count" ? "Stk" : null,
  sort_order: 0, select_options: [], validation: {}, is_result: false, default_value: null,
} as FormField);
const legacy = [
  field("r", "m3_rows", "Zeilen", "repeater", null, { repeater: { table_view: true, item_label: "m³-Zeile", add_label: "m³-Zeile hinzufügen", layout: { items: [{ id: "old", type: "field", key: "element_count", label_override: "Elemente" }] } } }),
  field("v", "volume_m3", "m³", "decimal", "r"),
  field("e", "element_count", "Elemente", "number", "r"),
  field("a", "row_responsible", "Verantwortlich", "text", "r"),
];
const fields = m3DisplayFields(legacy);
const constants = { crossSectionM: 0.15, pressureTestMm: 150, rsmMaxMm: 350, laborKatAddMm: 50, elementRounding: 10 };
function Harness() {
  const [stored, setStored] = useState<Record<string, unknown>>({ m3_rows: [{ volume_m3: 4, row_responsible: "AB", __m3_row_id: "stable" }], test_charge_row_id: "stable" });
  const derived = deriveM3Values({ stored, release: { length_mm: 520 }, orderNumber: null, constants });
  const rows = derived.values.m3_rows as Record<string, unknown>[];
  const values = { ...derived.values, m3_rows: rows.map((r) => ({ ...r, element_count: r.element_number ?? "—" })) };
  const layout = { version: 1, nodes: [{ id: "node", type: "field", field_id: "r", width: 12 }] } as FormLayoutTree;
  return <QueryClientProvider client={new QueryClient()}>
    <FormLayoutRenderer fields={fields} layout={layout} values={values} onChange={(k, v) => setStored((p) => ({ ...p, [k]: v }))} />
    <output data-testid="saved">{JSON.stringify(stripDerivedValues(derived.values))}</output>
  </QueryClientProvider>;
}

describe("m³ legacy display and editing", () => {
  it("edits responsibilities, adds rows and preserves only inputs plus the stable mark", () => {
    render(<Harness />);
    const responsible = screen.getByDisplayValue("AB");
    fireEvent.change(responsible, { target: { value: "Maria Muster" } });
    fireEvent.click(screen.getByRole("button", { name: /m³-Zeile hinzufügen/ }));
    const saved = JSON.parse(screen.getByTestId("saved").textContent ?? "{}");
    expect(saved.m3_rows).toHaveLength(2);
    expect(saved.m3_rows[0]).toEqual({ volume_m3: 4, row_responsible: "Maria Muster", __m3_row_id: "stable" });
    expect(saved.m3_rows[1]).toEqual({});
    expect(resolveTestMarking(saved, saved.m3_rows)).toEqual({ status: "ok", rowIndex: 0 });
    expect(legacy[2].field_type).toBe("number");
    expect(legacy[2].unit).toBe("Stk");
  });
  it("derived inputs survive roundtrip while unmarking immediately clears the effective mark", () => {
    const marked = applyTestMarking({ m3_rows: [{ volume_m3: 4 }] }, "m3_rows", 0, () => "stable");
    const first = deriveM3Values({ stored: marked, release: { length_mm: 520 }, orderNumber: null, constants });
    const saved = stripDerivedValues(first.values);
    const reopened = deriveM3Values({ stored: saved, release: { length_mm: 520 }, orderNumber: null, constants });
    expect((reopened.values.m3_rows as Record<string, unknown>[])[0].element_number).toBe("00340");
    const cleared = applyTestMarking(saved, "m3_rows", null, () => "unused");
    expect(resolveTestMarking(cleared, cleared.m3_rows as Record<string, unknown>[])).toEqual({ status: "none", rowIndex: null });
  });
});