import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import type { FormField } from "@/lib/api/formFields";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";

/**
 * Aufgabe 019 (Optik, docs/gestaltungsregeln.md): gemeinsamer Formular-Renderer.
 * - „Hervorheben“ bei Feldern = Beschriftung fett, KEIN farbiger Kasten; Pflicht nur mit *.
 * - Reiter umbrechen und bleiben innerhalb der Karte.
 * - Container (Abschnitt) behalten ihre Hervorhebung.
 */
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ role: "durchfuehrer" }) }));
vi.mock("@/context/ProcessContextProvider", () => ({ useSystemTextRenderer: () => (v: string) => v }));
vi.mock("@/lib/api", () => ({ api: { globalFields: { list: async () => [] } } }));
vi.mock("@/components/measurementImport/MeasurementCaseEditorDialog", () => ({ default: () => null }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const f = (id: string, key: string, name: string, extra: Partial<FormField> = {}): FormField =>
  ({
    id, form_id: "f", field_key: key, display_name: name, field_type: "text", metadata: {}, parent_field_id: null,
    sort_order: 0, select_options: [], readonly: false, validation: {}, is_result: false, default_value: null,
    is_required: false, ...extra,
  }) as FormField;

const fields = [
  f("a", "gebaeude", "Gebäude", { is_required: true }),
  f("b", "massetyp", "Massetyp"),
  f("c", "rezeptbasis", "Rezeptbasis"),
];
const layout = {
  version: 1,
  nodes: [
    { id: "n1", type: "field", field_id: "a", width: 6, highlight: true },
    { id: "n2", type: "field", field_id: "b", width: 6, highlight: true },
    {
      id: "tabs", type: "tabs", width: 12, children: [
        { id: "t1", title: "Rezeptbasis", children: [{ id: "n3", type: "field", field_id: "c", width: 12 }] },
        { id: "t2", title: "Rezeptvariante", children: [] },
        { id: "t3", title: "Rezeptversion", children: [] },
      ],
    },
    { id: "sec", type: "section", title: "Abschnitt", highlight: true, children: [] },
  ],
} as unknown as FormLayoutTree;

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FormLayoutRenderer fields={fields} layout={layout} values={{}} onChange={() => {}} />
    </QueryClientProvider>,
  );
afterEach(cleanup);

describe("Formular-Renderer: ruhige Darstellung", () => {
  it("hervorgehobene Felder haben keinen farbigen Kasten; Beschriftung fett; Pflicht nur mit *", () => {
    mount();
    const label = screen.getByText("Gebäude").closest("label") as HTMLElement;
    const shell = label.parentElement as HTMLElement;
    expect(shell.className).not.toContain("ring-");
    expect(shell.className).not.toContain("bg-primary");
    expect(label.querySelector(".font-semibold")).toBeTruthy();
    // Pflicht: roter Stern, kein roter Kasten
    expect(label.querySelector(".text-destructive")?.textContent).toBe("*");
    expect(screen.getByText("Massetyp").closest("label")?.parentElement?.className).not.toContain("ring-");
  });

  it("Reiter umbrechen und bleiben innerhalb der Karte", () => {
    mount();
    const list = screen.getByRole("tablist");
    expect(list.className).toContain("flex-wrap");
    expect(list.className).toContain("w-full");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("Abschnitte behalten ihre Hervorhebung (nur Felder wurden beruhigt)", () => {
    mount();
    const section = screen.getByText("Abschnitt").closest("div[class*='ring-']");
    expect(section).toBeTruthy();
  });
});

/* ---- Auftragsformular-Karte und Dienstleistungs-Karte ---- */
import ServiceTabsCard from "@/components/order/ServiceTabsCard";

describe("Auftragserstellung: Karten", () => {
  it("leere Dienstleistungs-Karte ist kompakt (weniger Innenabstand)", () => {
    const { container } = render(
      <ServiceTabsCard
        measurements={[]} allMeasurements={[]} activeUid={null} onActivate={() => {}} formValues={{}}
        onFormChange={() => {}} onDuplicate={() => {}} onRemove={() => {}} t={(_k: string, o?: any) => o?.defaultValue ?? _k}
      />,
    );
    expect(container.innerHTML).toContain("py-3");
    expect(container.innerHTML).toContain("pt-0 pb-3");
    expect(screen.getByText(/Wählen Sie links eine Dienstleistung/)).toBeTruthy();
  });
});

import de from "@/i18n/locales/de/orders.json";
import en from "@/i18n/locales/en/orders.json";
describe("Texte der Auftragserstellung", () => {
  it("duplicate_hint ist in de und en übersetzt (kein Rohtext)", () => {
    expect((de as any).duplicate_hint).toMatch(/mehrfach/);
    expect((en as any).duplicate_hint).toMatch(/several times/);
  });
});
