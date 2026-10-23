import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "durchfuehrer" }) }));
vi.mock("@/context/ProcessContextProvider", () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock("@/lib/api", () => ({ api: { globalFields: { list: async () => [] } } }));
vi.mock("@/components/forms/RichText", () => ({ default: ({ value }: { value: string }) => <>{value}</> }));
vi.mock("@/components/measurementImport/MeasurementCaseEditorDialog", () => ({ default: () => null }));

const f = (id: string, key: string, name: string, type = "decimal", metadata = {}): FormField => ({
  id, form_id: "f", field_key: key, display_name: name, field_type: type, metadata, parent_field_id: null,
  sort_order: 0, select_options: [], readonly: false, validation: {}, is_result: false, default_value: null,
} as FormField);
const ref = (id: string, key: string) => ({ id: `p-${id}`, type: "field", field_id: id, key, value_key: key, width: 12 });
const layout = (items: unknown[]) => ({ version: 1, gap: "md", items });
const fields = [
  f("b", "runs", "Durchläufe", "measurement_block", { measurement_block: { layout: layout([ref("o", "o2"), ref("p", "points")]) } }),
  f("p", "points", "Temperaturpunkte", "repeater", { repeater: { add_label: "Punkt hinzufügen", layout: layout([ref("t", "temperature"), { id: "pc", type: "calculation", calc_id: "c", calc_key: "answer", width: 12 }]) } }),
  f("o", "o2", "O₂"), f("t", "temperature", "Temperatur"),
];
const calcs = [{ id: "c", form_id: "f", calc_key: "answer", display_name: "Ergebnis", formula: "temperature * o2", expression: [], decimals: 2, rounding: "none" } as FormCalculation];
const formLayout = { version: 1, nodes: [{ id: "b", type: "field", field_id: "b", width: 12 }] } as FormLayoutTree;
const initial = { runs: [
  { __instance_id: "A", o2: 2, points: [{ __instance_id: "A1", temperature: 200, answer: 400 }, { __instance_id: "A2", temperature: 280, answer: 560 }] },
  { __instance_id: "B", o2: 5, points: [{ __instance_id: "B1", temperature: 200, answer: 1000 }] },
] };
function Harness({ readOnly = false, restored = initial }: { readOnly?: boolean; restored?: typeof initial }) {
  const [values, setValues] = useState<Record<string, unknown>>(restored);
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <FormLayoutRenderer fields={fields} layout={formLayout} localCalculations={calcs} values={values} readOnly={readOnly}
      onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))} />
    <output data-testid="values">{JSON.stringify(values)}</output>
  </QueryClientProvider>;
}
const values = () => JSON.parse(screen.getByTestId("values").textContent ?? "{}");
afterEach(cleanup);

describe("nested renderer, no backend writes", () => {
  it("does not recompute historical nested values on hydration", async () => {
    const old = { runs: [{ ...initial.runs[0], points: [{ __instance_id: "A1", temperature: 200, answer: 123 }] }] };
    render(<Harness restored={old} />);
    await waitFor(() => expect(screen.getAllByRole("spinbutton")).toHaveLength(2));
    expect(values().runs[0].points[0].answer).toBe(123);
  });
  it("edits own O2 and point, saves JSON and restores the exact independent values", async () => {
    render(<Harness />);
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "3" } });
    await waitFor(() => expect(values().runs[0].points[0].answer).toBe(600));
    expect(values().runs[1].points[0].answer).toBe(1000);
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "250" } });
    await waitFor(() => expect(values().runs[0].points[0].answer).toBe(750));
    expect(values().runs[0].points[1].answer).toBe(840);
    const saved = JSON.parse(JSON.stringify(values()));
    cleanup();
    render(<Harness restored={saved} />);
    expect(values().runs).toEqual(saved.runs);
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(250);
  });
  it("adds, reorders, duplicates and removes points without touching another run", () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole("button", { name: "Punkt hinzufügen" })[0]);
    const added = values().runs[0].points[2].__instance_id;
    expect(added).toBeTruthy();
    expect(values().runs[1]).toEqual(initial.runs[1]);
    fireEvent.click(screen.getAllByTitle("Nach oben")[3]);
    expect(values().runs[0].points.map((p: { __instance_id: string }) => p.__instance_id)).toEqual(["A1", added, "A2"]);
    fireEvent.click(screen.getAllByTitle("Duplizieren")[1]);
    expect(values().runs[0].points[1].__instance_id).not.toBe("A1");
    fireEvent.click(screen.getAllByTitle("Entfernen")[1]);
    expect(values().runs[1]).toEqual(initial.runs[1]);
  });
  it("readonly disables edits and never writes computed values", () => {
    render(<Harness readOnly />);
    expect(screen.queryByRole("button", { name: "Punkt hinzufügen" })).toBeNull();
    expect(screen.getAllByRole("spinbutton").every((i) => (i as HTMLInputElement).disabled)).toBe(true);
    expect(values()).toEqual(initial);
  });
});