import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMock = vi.hoisted(() => ({
  orderKindFormTemplates: { get: vi.fn() },
  formDefinitions: { get: vi.fn() },
  formFields: { listForForm: vi.fn() },
  formFieldPermissions: { getEffectiveMap: vi.fn() },
}));
vi.mock("@/lib/api", () => ({ api: { ...apiMock, measurementParameters: { amend: vi.fn() }, users: { list: vi.fn() } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, role: "master" }) }));
vi.mock("@/hooks/useSamples", () => ({
  useSamples: () => ({
    data: [
      { id: "a", sample_number: "P1", sample_name: "Fliese", project_id: null },
      { id: "b", sample_number: "P2", sample_name: "Glasur", project_id: null },
    ],
  }),
  useCreateSample: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ data: [] }) }));
vi.mock("@/hooks/useRawMaterials", () => ({ useStorageLocations: () => ({ data: [] }) }));
const rendererProps = vi.hoisted(() => ({ last: null as any }));
vi.mock("@/components/ServiceDesigner/FormLayoutRenderer", () => ({
  default: (p: any) => {
    rendererProps.last = p;
    return null;
  },
}));

import SampleSelector from "@/components/SampleSelector";
import OrderKindDynamicForm from "@/components/OrderKindDynamicForm";
import ExistingServicesReadOnly from "@/components/order/ExistingServicesReadOnly";
import type { OrderEditFacts } from "@/lib/orders/orderEdit";

beforeEach(() => vi.clearAllMocks());

describe("Probenauswahl im Bearbeiten-Modus", () => {
  const setup = (props: Record<string, unknown> = {}) => {
    const onChange = vi.fn();
    render(<SampleSelector values={["a", "b"]} onValuesChange={onChange} lockedValues={["a"]} {...props} />);
    return onChange;
  };

  it("gesperrte Probe hat keinen Entfernen-Knopf (Schloss mit Hinweis), die andere schon", () => {
    const onChange = setup();
    expect(screen.queryByLabelText("P1 entfernen")).toBeNull();
    expect(screen.getByLabelText("P1 gesperrt").getAttribute("title")).toMatch(/Aufgaben/);
    fireEvent.click(screen.getByLabelText("P2 entfernen"));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("„Alle entfernen“ lässt gesperrte Proben stehen", () => {
    const onChange = setup();
    fireEvent.click(screen.getByText("Alle entfernen"));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("ohne Sperren verhält sich die Auswahl wie beim Erstellen", () => {
    const onChange = vi.fn();
    render(<SampleSelector values={["a", "b"]} onValuesChange={onChange} />);
    fireEvent.click(screen.getByLabelText("P1 entfernen"));
    expect(onChange).toHaveBeenCalledWith(["b"]);
    fireEvent.click(screen.getByText("Alle entfernen"));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("komplett gesperrt: nichts entfernbar, „Alle entfernen“ ohne Wirkung", () => {
    const onChange = setup({ disabled: true, lockedValues: undefined });
    expect(screen.queryByLabelText("P2 entfernen")).toBeNull();
    fireEvent.click(screen.getByText("Alle entfernen"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Auftragsformular im Bearbeiten-Modus", () => {
  const fields = [
    { id: "f-dl", field_key: "dienstleistungen", display_name: "Dienstleistungen", field_type: "multiselect" },
    { id: "f-v", field_key: "versuchsnummer", display_name: "Versuchsnummer", field_type: "text" },
  ];
  const mount = (props: Record<string, unknown>) => {
    apiMock.orderKindFormTemplates.get.mockResolvedValue({ form_definition_id: "form1" });
    apiMock.formDefinitions.get.mockResolvedValue({ name: "Formular", layout: null });
    apiMock.formFields.listForForm.mockResolvedValue(fields);
    apiMock.formFieldPermissions.getEffectiveMap.mockResolvedValue(new Map());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <OrderKindDynamicForm orderKind="labor" values={{}} onChange={() => {}} {...(props as any)} />
      </QueryClientProvider>,
    );
  };

  it("gesperrte Felder (Dienstleistungs-Auswahl) werden über die vorhandene „locked“-Berechtigung gesperrt", async () => {
    mount({ lockedFieldKeys: ["dienstleistungen"] });
    await waitFor(() => expect(apiMock.formFieldPermissions.getEffectiveMap).toHaveBeenCalled());
    const args = apiMock.formFieldPermissions.getEffectiveMap.mock.calls.at(-1)!;
    expect(args[3]).toEqual(["f-dl"]);
  });

  it("nur lesbar: alle Felder gesperrt", async () => {
    mount({ readOnly: true });
    await waitFor(() => expect(apiMock.formFieldPermissions.getEffectiveMap).toHaveBeenCalled());
    expect(apiMock.formFieldPermissions.getEffectiveMap.mock.calls.at(-1)![3]).toEqual(["f-dl", "f-v"]);
  });

  it("beim Erstellen (keine Sperren) bleibt die Liste gesperrter Felder leer", async () => {
    mount({});
    await waitFor(() => expect(apiMock.formFieldPermissions.getEffectiveMap).toHaveBeenCalled());
    expect(apiMock.formFieldPermissions.getEffectiveMap.mock.calls.at(-1)![3]).toEqual([]);
  });
});

describe("Dienstleistungen im Bearbeiten-Modus (nur lesbar)", () => {
  const facts = {
    measurements: [
      { measurement_id: "m1", untouched: false, blockers: ["status_not_open", "results"], status: "in_progress", counts: {} },
      { measurement_id: "m2", untouched: true, blockers: [], status: "open", counts: {} },
    ],
  } as unknown as OrderEditFacts;
  const measurements = [
    {
      id: "m1", service_id: "s-rfa", measurement_number: "M1", status: "in_progress", measurement_services: { service_name: "RFA" },
      samples: { sample_number: "P1" },
      measurement_parameters: [
        { id: "p1", parameter_name: "Temperatur", parameter_value: "300", unit: "°C" },
        { id: "p2", parameter_name: "repeat:Zeilen", parameter_value: JSON.stringify([{ a: 1 }, { a: 2 }]), unit: null },
        { id: "p3", parameter_name: "Objekt", parameter_value: JSON.stringify({ x: 1 }), unit: null },
      ],
    },
    {
      id: "m2", service_id: "s-bet", measurement_number: "M2", status: "open", measurement_services: { service_name: "BET" },
      samples: { sample_number: "P2" }, measurement_parameters: [],
    },
  ];

  it("zeigt je Dienstleistung ihre Aufgaben mit Sperrstatus und Gründen", () => {
    render(<ExistingServicesReadOnly measurements={measurements} facts={facts} />);
    expect(screen.getByText("nur lesbar")).toBeTruthy();
    expect(screen.getByText("BET")).toBeTruthy();
    expect(screen.getByText("RFA")).toBeTruthy();
    expect(screen.getByText(/bereits in Bearbeitung/)).toBeTruthy();
    expect(screen.getByText(/Aufgabe bereits begonnen, Ergebnisse vorhanden/)).toBeTruthy();
    expect(screen.getByText("unberührt")).toBeTruthy();
  });

  it("Vorgaben werden gelesen, strukturierte Werte nie als Rohtext", () => {
    const { container } = render(<ExistingServicesReadOnly measurements={measurements} facts={facts} />);
    expect(screen.getByText("300 °C")).toBeTruthy();
    expect(screen.getByText("Liste mit 2 Einträgen")).toBeTruthy();
    expect(screen.getByText("Mehrere Angaben")).toBeTruthy();
    expect(container.textContent).not.toMatch(/\{|\[\{/);
  });

  it("ohne Dienstleistungen ein Hinweis", () => {
    render(<ExistingServicesReadOnly measurements={[]} facts={null} />);
    expect(screen.getByText("Keine Dienstleistungen im Auftrag.")).toBeTruthy();
  });
});

describe("Stufe 2: Vorgaben je Aufgabe ändern", () => {
  const measurements = [
    {
      id: "m1", service_id: "s-rfa", measurement_number: "M1", status: "open", measurement_services: { service_name: "RFA" },
      samples: { sample_number: "P1" },
      measurement_parameters: [{ id: "p1", parameter_name: "Temperatur", parameter_value: "300", unit: "°C" }],
    },
    {
      id: "m2", service_id: "s-rfa", measurement_number: "M2", status: "completed", measurement_services: { service_name: "RFA" },
      samples: { sample_number: "P2" },
      measurement_parameters: [{ id: "p2", parameter_name: "Temperatur", parameter_value: "400", unit: "°C" }],
    },
  ];

  it("ohne Berechtigung kein Änderungs-Knopf", () => {
    render(<ExistingServicesReadOnly measurements={measurements} facts={null} />);
    expect(screen.queryByLabelText("Vorgabe Temperatur ändern")).toBeNull();
  });

  it("mit Berechtigung: Knopf nur bei nicht abgeschlossenen Aufgaben, öffnet den Dialog mit Begründungspflicht", () => {
    render(<ExistingServicesReadOnly measurements={measurements} facts={null} canAmend />);
    const buttons = screen.getAllByLabelText("Vorgabe Temperatur ändern");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(screen.getByText(/Vorgabe ändern: Temperatur/)).toBeTruthy();
    expect(screen.getByText("Begründung *")).toBeTruthy();
    expect((screen.getByText("Speichern") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Stufe 3a: Dienstleistung entfernen (Oberfläche)", () => {
  const mk = (id: string, service: string, sid: string, sample: string, status = "open") => ({
    id, service_id: sid, measurement_number: `M-${id}`, status, measurement_services: { service_name: service },
    samples: { sample_number: sample }, measurement_parameters: [],
  });
  const measurements = [mk("a1", "RFA", "rfa", "P1"), mk("a2", "RFA", "rfa", "P2"), mk("b1", "BET", "bet", "P1", "in_progress")];
  const facts = {
    can_edit: true,
    measurements: [
      { measurement_id: "a1", untouched: true, blockers: [] },
      { measurement_id: "a2", untouched: true, blockers: [] },
      { measurement_id: "b1", untouched: false, blockers: ["work_logs"] },
    ],
  } as unknown as OrderEditFacts;

  it("unberührt: „Entfernen“, begonnen: „nicht entfernbar“; Markierung zeigt Folgen und lässt sich zurücknehmen", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ExistingServicesReadOnly measurements={measurements} facts={facts} canAmend onToggleRemove={onToggle} removedServiceIds={[]} />,
    );
    expect(screen.getByLabelText("Dienstleistung RFA entfernen")).toBeTruthy();
    expect(screen.queryByLabelText("Dienstleistung BET entfernen")).toBeNull();
    expect(screen.getByText("nicht entfernbar").getAttribute("title")).toMatch(/Arbeitszeit gebucht/);
    fireEvent.click(screen.getByLabelText("Dienstleistung RFA entfernen"));
    expect(onToggle).toHaveBeenCalledWith("rfa");

    rerender(<ExistingServicesReadOnly measurements={measurements} facts={facts} canAmend onToggleRemove={onToggle} removedServiceIds={["rfa"]} />);
    expect(screen.getByRole("alert").textContent).toMatch(/alle 2 Aufgaben/);
    expect(screen.getByRole("alert").textContent).toMatch(/nicht rückgängig/);
    fireEvent.click(screen.getByLabelText("Entfernen von RFA rückgängig"));
    expect(onToggle).toHaveBeenLastCalledWith("rfa");
  });

  it("ohne Berechtigung oder ohne Umschalter keine Entfernen-Knöpfe", () => {
    render(<ExistingServicesReadOnly measurements={measurements} facts={facts} />);
    expect(screen.queryByLabelText("Dienstleistung RFA entfernen")).toBeNull();
  });
});
