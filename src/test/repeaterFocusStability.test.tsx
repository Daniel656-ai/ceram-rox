import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import { normalizeRepeaterLayout } from "@/lib/repeaterLayout";
import type { FormField } from "@/lib/api/formFields";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "durchfuehrer" }) }));
vi.mock("@/context/ProcessContextProvider", () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock("@/lib/api", () => ({ api: { globalFields: { list: async () => [] }, formCalculations: { listForForm: async () => [] } } }));
vi.mock("@/components/measurementImport/MeasurementCaseEditorDialog", () => ({ default: () => null }));

afterEach(cleanup);

describe("normalizeRepeaterLayout – stabile IDs", () => {
  it("vergibt bei wiederholter Normalisierung ohne gespeichertes Layout identische IDs", () => {
    const a = normalizeRepeaterLayout(undefined, ["rohstoff", "lotnummer", "menge"]);
    const b = normalizeRepeaterLayout(undefined, ["rohstoff", "lotnummer", "menge"]);
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
    expect(new Set(a.items.map((i) => i.id)).size).toBe(3);
  });
  it("gleiche Feldschlüssel in unterschiedlichen Repeatern sind je Layout stabil", () => {
    const x = normalizeRepeaterLayout(undefined, ["rohstoff"]);
    const y = normalizeRepeaterLayout({ items: [{ type: "group", title: "G", children: [{ type: "field", key: "rohstoff" }] }] }, ["rohstoff"]);
    expect(normalizeRepeaterLayout(undefined, ["rohstoff"]).items[0].id).toBe(x.items[0].id);
    const again = normalizeRepeaterLayout({ items: [{ type: "group", title: "G", children: [{ type: "field", key: "rohstoff" }] }] }, ["rohstoff"]);
    expect(again).toEqual(y);
  });
  it("erhält explizit gespeicherte IDs und Zuordnungen unverändert und vermeidet Kollisionen", () => {
    const raw = { items: [
      { id: "auto-f:a", type: "field", key: "b", width: 4 },
      { id: "keep", type: "field", field_id: "F1", key: "a", value_key: "a_v", width: 6 },
      { type: "spacer", width: 2 },
    ] };
    const refs = { fields: [{ id: "F1", field_key: "a" }], calculations: [] };
    const n1 = normalizeRepeaterLayout(raw, ["a", "b", "c"], undefined, refs);
    const n2 = normalizeRepeaterLayout(raw, ["a", "b", "c"], undefined, refs);
    expect(n1).toEqual(n2);
    expect(n1.items[0]).toMatchObject({ id: "auto-f:a", key: "b", width: 4 });
    expect(n1.items[1]).toMatchObject({ id: "keep", field_id: "F1", key: "a", value_key: "a_v" });
    expect(new Set(n1.items.map((i) => i.id)).size).toBe(n1.items.length);
  });
});

const f = (id: string, key: string, name: string, type = "text", parent: string | null = null, metadata = {}): FormField => ({
  id, form_id: "f", field_key: key, display_name: name, field_type: type, metadata, parent_field_id: parent,
  sort_order: 0, select_options: [], readonly: false, validation: {}, is_result: false, default_value: null,
} as FormField);

function Harness({ fields, rootKey, initial }: { fields: FormField[]; rootKey: string; initial: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const layout = { version: 1, nodes: [{ id: "n", type: "field", field_id: fields[0].id, width: 12 }] } as FormLayoutTree;
  return <QueryClientProvider client={new QueryClient()}>
    <FormLayoutRenderer fields={fields} layout={layout} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
    <output data-testid="values">{JSON.stringify(values[rootKey])}</output>
  </QueryClientProvider>;
}

const textInputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"]'));

function typeKeepsFocus(index: number, text: string) {
  const input = textInputs()[index];
  input.focus();
  let current = "";
  for (const ch of text) {
    current += ch;
    fireEvent.change(document.activeElement as HTMLInputElement, { target: { value: current } });
    expect(textInputs()[index]).toBe(input);
    expect(document.activeElement).toBe(input);
  }
  expect(input.value).toBe(text);
}

describe("Repeater-Unterfelder behalten beim Tippen den Fokus", () => {
  const rohstoffFields = [
    f("r", "zusatzstoff", "Zusatzstoff", "repeater"),
    f("c1", "rohstoff", "Rohstoff", "text", "r"),
    f("c2", "lotnummer", "Lotnummer", "text", "r"),
  ];
  const initial = { zusatzstoff: [{ __instance_id: "R1", rohstoff: "", lotnummer: "" }, { __instance_id: "R2", rohstoff: "X", lotnummer: "1" }] };

  it("Lotnummer 644000123 und Rohstoff mit mehreren Zeichen", () => {
    render(<Harness fields={rohstoffFields} rootKey="zusatzstoff" initial={initial} />);
    // Reihenfolge je Zeile: Rohstoff, Lotnummer
    const lot = textInputs()[1];
    lot.focus();
    let v = "";
    for (const ch of "644000123") {
      v += ch;
      fireEvent.change(lot, { target: { value: v } });
      expect(document.activeElement).toBe(lot);
      expect(textInputs()[1]).toBe(lot);
    }
    const roh = textInputs()[0];
    roh.focus();
    v = "";
    for (const ch of "Kaolin") {
      v += ch;
      fireEvent.change(roh, { target: { value: v } });
      expect(document.activeElement).toBe(roh);
    }
    const saved = JSON.parse(screen.getByTestId("values").textContent!);
    expect(saved[0]).toMatchObject({ __instance_id: "R1", rohstoff: "Kaolin", lotnummer: "644000123" });
    expect(saved[1]).toEqual({ __instance_id: "R2", rohstoff: "X", lotnummer: "1" });
  });

  it("m³ Verantwortlich/Bearbeitet nimmt einen mehrteiligen Namen auf", () => {
    const fields = [f("m", "m3_rows", "Zeilen", "repeater"), f("rr", "row_responsible", "verantwortlich / bearbeitet", "text", "m")];
    render(<Harness fields={fields} rootKey="m3_rows" initial={{ m3_rows: [{ __instance_id: "M1", row_responsible: "" }] }} />);
    typeKeepsFocus(0, "Maria Muster-Huber");
    expect(JSON.parse(screen.getByTestId("values").textContent!)[0].row_responsible).toBe("Maria Muster-Huber");
  });
});
