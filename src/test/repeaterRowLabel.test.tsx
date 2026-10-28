import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import type { FormField } from "@/lib/api/formFields";
import { readRepeaterMeta } from "@/lib/api/formFields";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";
import { formatRepeaterRowLabel } from "@/lib/repeaterRowLabel";
import { normalizeRepeaterLayout } from "@/lib/repeaterLayout";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "durchfuehrer" }) }));
vi.mock("@/context/ProcessContextProvider", () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock("@/lib/api", () => ({ api: { globalFields: { list: async () => [] } } }));
vi.mock("@/components/forms/RichText", () => ({ default: ({ value }: { value: string }) => <>{value}</> }));
vi.mock("@/components/measurementImport/MeasurementCaseEditorDialog", () => ({ default: () => null }));

const sel = { field_key: "ms", field_type: "select", select_options: [{ value: "0014", label: "MS 0014" }] };
const temp = { field_key: "t", field_type: "decimal", unit: "°C" };

describe("formatRepeaterRowLabel", () => {
  it("keeps numbering without reference field", () => {
    expect(formatRepeaterRowLabel({ entry: { ms: "0014" }, itemLabel: "Mundstück", index: 0 })).toBe("Mundstück 1");
  });
  it("falls back on empty value", () => {
    expect(formatRepeaterRowLabel({ entry: { ms: "" }, labelFieldKey: "ms", field: sel, itemLabel: "Mundstück", index: 1 })).toBe("Mundstück 2");
  });
  it("shows select option label", () => {
    expect(formatRepeaterRowLabel({ entry: { ms: "0014" }, labelFieldKey: "ms", field: sel, itemLabel: "Mundstück", index: 0 })).toBe("MS 0014");
  });
  it("adds unit to numbers", () => {
    expect(formatRepeaterRowLabel({ entry: { t: 280 }, labelFieldKey: "t", field: temp, itemLabel: "Temperaturpunkt", index: 1 })).toBe("280 °C");
  });
  it("reads the stored value key", () => {
    expect(formatRepeaterRowLabel({ entry: { old: 200 }, labelFieldKey: "t", valueKey: "old", field: temp, itemLabel: "T", index: 0 })).toBe("200 °C");
  });
  it("reads label_field_key from meta", () => {
    expect(readRepeaterMeta({ metadata: { repeater: { label_field_key: " ms " } } } as any).label_field_key).toBe("ms");
    expect(readRepeaterMeta({ metadata: {} } as any).label_field_key).toBeUndefined();
  });
});

describe("label_override normalization", () => {
  const raw = (o: unknown) => ({ version: 1, gap: "md", items: [{ id: "a", type: "field", key: "x", width: 6, label_override: o }] });
  it("keeps override, drops empty, legacy unchanged", () => {
    expect(normalizeRepeaterLayout(raw("Eigener Name"), ["x"]).items[0]).toMatchObject({ label_override: "Eigener Name" });
    expect(normalizeRepeaterLayout(raw("   "), ["x"]).items[0]).not.toHaveProperty("label_override");
    expect(normalizeRepeaterLayout({ items: [{ id: "a", type: "field", key: "x", width: 6 }] }, ["x"]).items[0]).toEqual({ id: "a", type: "field", key: "x", width: 6 });
  });
});

const f = (id: string, key: string, name: string, type = "decimal", metadata = {}, extra = {}): FormField => ({
  id, form_id: "f", field_key: key, display_name: name, field_type: type, metadata, parent_field_id: null,
  sort_order: 0, select_options: [], readonly: false, validation: {}, is_result: false, default_value: null, unit: null, ...extra,
} as FormField);

function Harness({ fields, initial }: { fields: FormField[]; initial: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  return <QueryClientProvider client={new QueryClient()}>
    <FormLayoutRenderer fields={fields} layout={{ version: 1, nodes: [{ id: "r", type: "field", field_id: "r", width: 12 }] } as FormLayoutTree}
      localCalculations={[]} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
    <output data-testid="values">{JSON.stringify(values)}</output>
  </QueryClientProvider>;
}
afterEach(cleanup);

describe("repeater renderer", () => {
  const build = (meta: Record<string, unknown>) => [
    f("r", "punkte", "Punkte", "repeater", { repeater: { item_label: "Temperaturpunkt", layout: { version: 1, gap: "md", items: [
      { id: "pt", type: "field", key: "t", width: 6, label_override: "Ofentemperatur" }, { id: "pn", type: "field", key: "n", width: 6 },
    ] }, ...meta } }),
    { ...f("t", "t", "Temperatur", "decimal", {}, { unit: "°C" }), parent_field_id: "r" } as FormField,
    { ...f("n", "n", "Notiz", "text"), parent_field_id: "r" } as FormField,
  ];
  it("shows override and default names, numbering without reference", () => {
    render(<Harness fields={build({})} initial={{ punkte: [{ t: 200 }] }} />);
    expect(screen.getByText("Ofentemperatur")).toBeTruthy();
    expect(screen.getByText("Notiz")).toBeTruthy();
    expect(screen.queryByText("Temperatur")).toBeNull();
    expect(screen.getByTestId("repeater-row-label").textContent).toBe("Temperaturpunkt 1");
  });
  it("labels rows by value, updates live, duplicates independent", () => {
    render(<Harness fields={build({ label_field_key: "t" })} initial={{ punkte: [{ t: 280 }, { t: 280 }, {}] }} />);
    expect(screen.getAllByTestId("repeater-row-label").map((e) => e.textContent)).toEqual(["280 °C", "280 °C", "Temperaturpunkt 3"]);
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[1], { target: { value: "360" } });
    expect(screen.getAllByTestId("repeater-row-label").map((e) => e.textContent)).toEqual(["280 °C", "360 °C", "Temperaturpunkt 3"]);
    const stored = JSON.parse(screen.getByTestId("values").textContent!).punkte;
    expect(stored[0].t).toBe(280);
    expect(Object.keys(stored[0])).toEqual(["t"]);
  });
});

describe("nested measurement block → temperature repeater", () => {
  const ref = (id: string, key: string, extra = {}) => ({ id: `p-${id}`, type: "field", field_id: id, key, value_key: key, width: 12, ...extra });
  const lay = (items: unknown[]) => ({ version: 1, gap: "md", items });
  const fields = [
    f("r", "runs", "Durchläufe", "measurement_block", { measurement_block: { layout: lay([ref("o", "o2", { label_override: "Sauerstoff" }), ref("p", "points")]) } }),
    f("p", "points", "Temperaturpunkte", "repeater", { repeater: { item_label: "Temperatur", label_field_key: "temperature", layout: lay([ref("t", "temperature")]) } }),
    f("o", "o2", "O₂"), f("t", "temperature", "Temperatur", "decimal", {}, { unit: "°C" }),
  ];
  it("inner rows use their own reference; outer keeps its label; values unchanged", () => {
    const initial = { runs: [
      { __instance_id: "A", o2: 2, points: [{ __instance_id: "A1", temperature: 200 }, { __instance_id: "A2", temperature: 360 }] },
      { __instance_id: "B", o2: 5, points: [{ __instance_id: "B1", temperature: 200 }] },
    ] };
    render(<Harness fields={fields} initial={initial} />);
    expect(screen.getAllByTestId("repeater-row-label").map((e) => e.textContent)).toEqual(["Messung 1 1", "200 °C", "360 °C", "Messung 2 2", "200 °C"]);
    expect(screen.getAllByText("Sauerstoff").length).toBe(2);
    const stored = JSON.parse(screen.getByTestId("values").textContent!);
    expect(stored.runs[0].points[1]).toMatchObject({ __instance_id: "A2", temperature: 360 });
  });
});
