import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "durchfuehrer" }) }));
vi.mock("@/context/ProcessContextProvider", () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock("@/lib/api", () => ({ api: { globalFields: { list: async () => [] } } }));
vi.mock("@/components/measurementImport/MeasurementCaseEditorDialog", () => ({ default: () => null }));

const f = (id: string, key: string, name: string, type = "decimal", metadata = {}): FormField => ({
  id, form_id: "f", field_key: key, display_name: name, field_type: type, metadata, parent_field_id: null,
  sort_order: 0, select_options: [], readonly: false, validation: {}, is_result: false, default_value: null,
} as FormField);
const calcs = [{ id: "c", form_id: "f", calc_key: "umsatz", display_name: "Standard-Umsatz", formula: "a * 2", expression: [], decimals: 2, rounding: "none" } as FormCalculation];
const formLayout = { version: 1, nodes: [{ id: "r", type: "field", field_id: "r", width: 12 }] } as FormLayoutTree;
const initial = { rows: [{ __instance_id: "R1", a: 21, umsatz: 42 }] };

function setup(labelOverride?: string) {
  const calcItem: Record<string, unknown> = { id: "pc", type: "calculation", calc_id: "c", calc_key: "umsatz", width: 12 };
  if (labelOverride !== undefined) calcItem.label_override = labelOverride;
  const fields = [
    f("r", "rows", "Einträge", "repeater", { repeater: { add_label: "Hinzufügen", layout: { version: 1, gap: "md", items: [
      { id: "pa", type: "field", field_id: "a", key: "a", value_key: "a", width: 12 }, calcItem,
    ] } } }),
    f("a", "a", "A"),
  ];
  function Harness() {
    const [values, setValues] = useState<Record<string, unknown>>(initial);
    return <QueryClientProvider client={new QueryClient()}>
      <FormLayoutRenderer fields={fields} layout={formLayout} localCalculations={calcs} values={values}
        onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </QueryClientProvider>;
  }
  render(<Harness />);
  return () => JSON.parse(screen.getByTestId("values").textContent ?? "{}");
}
afterEach(cleanup);

describe("calculation display names inside repeater entries", () => {
  it("renders the override with subscript x instead of the standard name", () => {
    setup("Spezifischer NO_{x}-Umsatz");
    const sub = Array.from(document.querySelectorAll("sub")).find((s) => s.textContent === "x");
    expect(sub).toBeTruthy();
    expect(sub!.parentElement!.textContent).toContain("Spezifischer NOx-Umsatz");
    expect(screen.queryByText("Standard-Umsatz")).toBeNull();
  });
  it("falls back to the standard name without override", () => {
    setup();
    expect(screen.getByText("Standard-Umsatz")).toBeTruthy();
  });
  it("falls back to the standard name with an empty override", () => {
    setup("");
    expect(screen.getByText("Standard-Umsatz")).toBeTruthy();
  });
  it("keeps computed value and calculation key unchanged", () => {
    const values = setup("Spezifischer NO_{x}-Umsatz");
    expect(values().rows[0]).toEqual({ __instance_id: "R1", a: 21, umsatz: 42 });
    expect(values()).not.toHaveProperty("Spezifischer NO_{x}-Umsatz");
  });
});
