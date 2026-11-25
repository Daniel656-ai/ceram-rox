import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import { TemperatureOrderLockCtx } from "@/components/ServiceDesigner/fillRowsContext";
import type { FormField } from "@/lib/api/formFields";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "durchfuehrer" }) }));
vi.mock("@/context/ProcessContextProvider", () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock("@/lib/api", () => ({ api: { globalFields: { list: async () => [] } } }));
vi.mock("@/components/forms/RichText", () => ({ default: ({ value }: { value: string }) => <>{value}</> }));
vi.mock("@/components/measurementImport/MeasurementCaseEditorDialog", () => ({ default: () => null }));

const f = (id: string, key: string, name: string, type: string, metadata = {}, extra = {}): FormField => ({
  id, form_id: "f", field_key: key, display_name: name, field_type: type, metadata, parent_field_id: null,
  sort_order: 0, select_options: [], readonly: false, validation: {}, is_result: false, default_value: null, unit: null, ...extra,
} as FormField);

// Struktur aus dem NOx-Diff: Block temperatur_12, Unterfeld temperatur_13 (°C)
const TEMP_FIELDS = [
  f("r", "temperatur_12", "Temperatur 12", "repeater", { repeater: { storage_key: "temperatur_12", item_label: "Temperatur", add_label: "Temperatur hinzufügen", layout: { version: 1, gap: "md", items: [{ id: "a", type: "field", key: "temperatur_13", width: 12 }] } } }, { unit: "°C" }),
  { ...f("c", "temperatur_13", "Temperatur", "number", {}, { unit: "°C" }), parent_field_id: "r" } as FormField,
];
const ETA = f("eta", "eta_nox", "η-NOx", "number");

function Harness({ fields, initial, lock = false }: { fields: FormField[]; initial: Record<string, unknown>; lock?: boolean }) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const nodes = fields.filter((x) => !x.parent_field_id).map((x) => ({ id: `n-${x.id}`, type: "field", field_id: x.id, width: 12 }));
  return <QueryClientProvider client={new QueryClient()}>
    <TemperatureOrderLockCtx.Provider value={lock}>
      <FormLayoutRenderer fields={fields} layout={{ version: 1, nodes } as unknown as FormLayoutTree}
        localCalculations={[]} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
    </TemperatureOrderLockCtx.Provider>
    <output data-testid="values">{JSON.stringify(values)}</output>
  </QueryClientProvider>;
}
afterEach(cleanup);

const LIST = [{ temperatur_13: 200 }, { temperatur_13: 300 }, { temperatur_13: 400 }];

describe("Temperaturblock: Sperre von Verschieben/Löschen", () => {
  it("ohne Messwerte: Verschieben, Kopieren und Löschen sind möglich", () => {
    render(<Harness fields={TEMP_FIELDS} initial={{ temperatur_12: LIST }} />);
    expect(screen.getAllByTitle("Nach oben")).toHaveLength(3);
    expect(screen.getAllByTitle("Entfernen")).toHaveLength(3);
    expect(screen.queryByTestId("temperature-lock-note")).toBeNull();
  });

  it("mit Messwerten im Formular (η-NOx): kein Verschieben/Kopieren/Löschen, Hinweis sichtbar", () => {
    render(<Harness fields={[...TEMP_FIELDS, ETA]} initial={{ temperatur_12: LIST, eta_nox: 12.5 }} />);
    expect(screen.queryByTitle("Nach oben")).toBeNull();
    expect(screen.queryByTitle("Nach unten")).toBeNull();
    expect(screen.queryByTitle("Duplizieren")).toBeNull();
    expect(screen.queryByTitle("Entfernen")).toBeNull();
    expect(screen.getByTestId("temperature-lock-note")).toBeTruthy();
  });

  it("Auftrag bearbeiten (Messwerte beim Auftrag): gleiche Sperre ohne Werte im Formular", () => {
    render(<Harness fields={TEMP_FIELDS} initial={{ temperatur_12: LIST }} lock />);
    expect(screen.queryByTitle("Nach oben")).toBeNull();
    expect(screen.queryByTitle("Entfernen")).toBeNull();
    expect(screen.getByTestId("temperature-lock-note")).toBeTruthy();
  });

  it("gesperrt: Wert ändern (200 -> 250) und hinten anhängen bleibt erlaubt, Reihenfolge unverändert", () => {
    render(<Harness fields={TEMP_FIELDS} initial={{ temperatur_12: LIST }} lock />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "250" } });
    let stored = JSON.parse(screen.getByTestId("values").textContent!).temperatur_12;
    expect(stored.map((e: any) => e.temperatur_13)).toEqual([250, 300, 400]);
    fireEvent.click(screen.getByText("Temperatur hinzufügen"));
    stored = JSON.parse(screen.getByTestId("values").textContent!).temperatur_12;
    expect(stored).toHaveLength(4);
    expect(stored.slice(0, 3).map((e: any) => e.temperatur_13)).toEqual([250, 300, 400]);
  });

  it("gesperrt: nur ein leerer LETZTER Eintrag lässt sich noch löschen (keine Stufe verrutscht)", () => {
    render(<Harness fields={TEMP_FIELDS} initial={{ temperatur_12: [...LIST, {}] }} lock />);
    const buttons = screen.getAllByTitle("Entfernen");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const stored = JSON.parse(screen.getByTestId("values").textContent!).temperatur_12;
    expect(stored.map((e: any) => e.temperatur_13)).toEqual([200, 300, 400]);
  });

  it("anderer Wiederholungsblock wird nicht gesperrt, auch wenn Messwerte vorliegen", () => {
    const other = [f("r2", "proben", "Proben", "repeater", { repeater: { storage_key: "proben" } }), { ...f("c2", "menge", "Menge", "number", {}, { unit: "g" }), parent_field_id: "r2" } as FormField];
    render(<Harness fields={[...other, ETA]} initial={{ proben: [{ menge: 1 }, { menge: 2 }], eta_nox: 5 }} />);
    expect(screen.getAllByTitle("Nach oben")).toHaveLength(2);
    expect(screen.queryByTestId("temperature-lock-note")).toBeNull();
  });
});
