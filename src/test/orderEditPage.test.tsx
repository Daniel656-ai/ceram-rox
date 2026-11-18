import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Rauchtest der Seite „Auftrag erstellen“ im Bearbeiten-Modus (/auftraege/<id>/bearbeiten):
 * dieselbe Maske, vorausgefüllt, mit Sperren; Speichern ruft die atomare Datenbankfunktion auf.
 * (Datenbank, Formular-Engine und Berechtigungen sind ersetzt.)
 */

const hoisted = vi.hoisted(() => {
  // Stabile Rückgabewerte (die Seite reagiert auf jede neue Listen-Instanz)
  const stable = {
    projects: { data: [{ id: "p1", project_number: "P-1", project_name: "Alpha" }, { id: "p2", project_number: "P-2", project_name: "Beta" }] },
    services: { data: [] as any[], isSuccess: true, isLoading: false },
    templates: { data: [] as any[] },
    samples: {
      data: [
        { id: "s1", sample_number: "P1", sample_name: "Fliese", project_id: null },
        { id: "s2", sample_number: "P2", sample_name: "Glasur", project_id: null },
        { id: "s3", sample_number: "P3", sample_name: "Neu", project_id: null },
      ],
    },
    locations: { data: [] as any[] },
    auth: { user: { id: "u1" }, role: "master" },
    perms: { hasPermission: () => false },
    autosave: { state: "idle", dirty: false, saveNow: () => undefined, discard: () => undefined },
    mut: { mutateAsync: undefined as any },
    createSample: { mutateAsync: () => undefined, isPending: false },
    createOrder: { mutateAsync: undefined as any },
  };
  const state = { order: null as any, facts: null as any };
  const calls = { applyChanges: vi.fn(), setBilled: vi.fn(), create: vi.fn(), navigate: vi.fn(), logAdded: vi.fn() };
  stable.createOrder.mutateAsync = calls.create;
  const addTask = vi.fn();
  stable.mut.mutateAsync = addTask;
  (calls as any).addTask = addTask;
  return { state, calls, stable };
});

vi.mock("@/lib/api", () => {
  const make = (path: string[]): any =>
    new Proxy(() => undefined, {
      get: (_t, prop: string) => make([...path, prop]),
      apply: () => Promise.resolve([]),
    });
  const base = make([]);
  const api: any = new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "orders") {
        return {
          get: () => Promise.resolve(hoisted.state.order),
          editFacts: () => Promise.resolve(hoisted.state.facts),
          applyChanges: hoisted.calls.applyChanges,
          setBilled: hoisted.calls.setBilled,
          logServicesAdded: hoisted.calls.logAdded,
        };
      }
      return base[prop];
    },
  });
  return { api };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => hoisted.stable.auth }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => hoisted.stable.perms }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => hoisted.stable.projects }));
vi.mock("@/hooks/useOrders", () => ({ useCreateOrder: () => hoisted.stable.createOrder }));
vi.mock("@/hooks/useMeasurements", () => ({
  useServices: () => hoisted.stable.services,
  useAddOrderMeasurement: () => hoisted.stable.mut,
}));
vi.mock("@/hooks/useTemplates", () => ({ useTemplates: () => hoisted.stable.templates, useApplyTemplate: () => hoisted.stable.mut }));
vi.mock("@/hooks/useSamples", () => ({ useSamples: () => hoisted.stable.samples, useCreateSample: () => hoisted.stable.createSample }));
vi.mock("@/hooks/useRawMaterials", () => ({ useStorageLocations: () => hoisted.stable.locations }));
vi.mock("@/hooks/useOrderDraftAutosave", () => ({ useOrderDraftAutosave: () => hoisted.stable.autosave }));
vi.mock("@/lib/refreshGuard", () => ({ useRefreshGuard: () => {} }));
vi.mock("@/components/orders/OrderDraftsPanel", () => ({ default: () => <div data-testid="drafts-panel" /> }));
vi.mock("@/components/orders/TemplateReviewPanel", () => ({ default: () => null }));
vi.mock("@/components/TemplateManager", () => ({ default: () => null }));
vi.mock("@/components/order/ServiceTabsCard", () => ({ default: () => <div data-testid="service-tabs" /> }));
vi.mock("@/components/OrderKindDynamicForm", () => ({
  default: (p: any) => {
    useEffect(() => {
      p.onTemplateResolved?.("f1");
      p.onFieldsResolved?.([
        { id: "fd", field_key: "dienstleistungen", display_name: "Dienstleistungen", field_type: "multiselect", select_options: [] },
        { id: "fv", field_key: "versuchsnummer", display_name: "Versuchsnummer", field_type: "text" },
      ]);
      p.onReady?.(p.orderKind, true);
    }, []);
    return (
      <div>
        <div data-testid="locked-keys">{(p.lockedFieldKeys ?? []).join(",")}</div>
        <button type="button" onClick={() => p.onChange({ versuchsnummer: "V-77" })}>Versuchsnummer ändern</button>
      </div>
    );
  },
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => hoisted.calls.navigate };
});

import CreateOrderPage from "@/pages/CreateOrderPage";

const baseOrder = (over: Record<string, unknown> = {}) => ({
  id: "o1", order_number: "MWI260003", order_type: "customer", project_id: "p1", priority: "normal", due_date: "2026-12-01",
  notes: "alt", is_billed: false, order_kind: "labor", sample_id: "s1",
  order_samples: [{ sample_id: "s1" }, { sample_id: "s2" }],
  order_measurements: [
    { id: "m1", service_id: "svc1", sample_id: "s1", status: "open", measurement_number: "M1", measurement_services: { service_name: "RFA" }, samples: { sample_number: "P1" }, measurement_parameters: [] },
  ],
  shared_form_data: { template: { form_definition_id: "f1", values: { a: 1 } } },
  ...over,
});
const baseFacts = (over: Record<string, unknown> = {}) => ({
  order_id: "o1", order_number: "MWI260003", order_type: "customer", order_kind: "labor", status: "open", workflow_status: "entwurf",
  project_id: "p1", created_by: "u1", updated_at: "2026-11-18T10:00:00Z", is_billed: false, is_master: true, can_edit: true,
  internal: false, locked: false, started: false, type_locked: false, project_locked: false,
  measurements: [{ measurement_id: "m1", untouched: true, blockers: [], status: "open", counts: {} }],
  samples: [
    { sample_id: "s1", sample_number: "P1", sample_name: "Fliese", locked: true, reasons: ["has_tasks"] },
    { sample_id: "s2", sample_number: "P2", sample_name: "Glasur", locked: false, reasons: [] },
  ],
  ...over,
});

const mount = (path = "/auftraege/o1/bearbeiten") => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/auftraege/:id/bearbeiten" element={<CreateOrderPage />} />
          <Route path="/auftraege/neu" element={<CreateOrderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
(Element.prototype as any).scrollIntoView ??= () => {};
(Element.prototype as any).hasPointerCapture ??= () => false;

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.state.order = baseOrder();
  hoisted.state.facts = baseFacts();
  hoisted.calls.applyChanges.mockResolvedValue({ changed: true, fields: [] });
  hoisted.calls.setBilled.mockResolvedValue(true);
  (hoisted.calls as any).addTask.mockResolvedValue({ id: "neu-1" });
  hoisted.stable.services.data = [];
});

describe("Seite „Auftrag erstellen“ im Bearbeiten-Modus", () => {
  it("zeigt dieselbe Maske vorausgefüllt mit Auftragsnummer im Titel; Entwurfs-/Batch-Bedienung entfällt", async () => {
    mount();
    expect(await screen.findByText("Auftrag MWI260003 bearbeiten")).toBeTruthy();
    expect((screen.getByDisplayValue("alt") as HTMLTextAreaElement).value).toBe("alt");
    expect(screen.getByDisplayValue("2026-12-01")).toBeTruthy();
    expect(screen.queryByTestId("drafts-panel")).toBeNull();
    expect(screen.queryByText("Batch-Planung")).toBeNull();
    expect(screen.queryByText(/Entwurf speichern/)).toBeNull();
    expect(screen.getByText("Änderungen speichern")).toBeTruthy();
    expect(screen.getByText("Änderungen verwerfen")).toBeTruthy();
  });

  it("Dienstleistungen sind nur lesbar (mit Hinweis); Auswahlfelder des Auftragsformulars sind gesperrt", async () => {
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    expect(screen.getByText("nur lesbar")).toBeTruthy();
    expect(screen.getByText("RFA")).toBeTruthy();
    expect(screen.getByText("unberührt")).toBeTruthy();
    expect(screen.queryByText("Prozessvorlage (optional)")).toBeNull();
    expect(screen.getByTestId("locked-keys").textContent).toBe("dienstleistungen");
  });

  it("nichts geändert: Speichern ist gesperrt, es wird nichts gesendet", async () => {
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    expect((screen.getByText("Änderungen speichern").closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Noch keine Änderungen.")).toBeTruthy();
    expect(hoisted.calls.applyChanges).not.toHaveBeenCalled();
  });

  it("Anmerkung ändern: Zusammenfassung, ohne Begründung speicherbar, Datenbankfunktion mit Ausgangszeitstempel", async () => {
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    fireEvent.change(screen.getByDisplayValue("alt"), { target: { value: "neu" } });
    expect(await screen.findByText("Anmerkungen geändert")).toBeTruthy();
    fireEvent.click(screen.getByText("Änderungen speichern"));
    await waitFor(() => expect(hoisted.calls.applyChanges).toHaveBeenCalledTimes(1));
    const [id, changes, reason] = hoisted.calls.applyChanges.mock.calls[0];
    expect(id).toBe("o1");
    expect(changes).toEqual({ expected_updated_at: "2026-11-18T10:00:00Z", header: { notes: "neu" } });
    expect(reason).toBe("");
    await waitFor(() => expect(hoisted.calls.navigate).toHaveBeenCalledWith("/auftraege/o1"));
    expect(hoisted.calls.create).not.toHaveBeenCalled(); // nie ein zweiter Auftrag
  });

  it("Auftragsformular geändert: Versuchsnummer wird mitgegeben; Begründung nur bei begonnenem Auftrag", async () => {
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    fireEvent.click(screen.getByText("Versuchsnummer ändern"));
    expect(await screen.findByText("Auftragsformular geändert")).toBeTruthy();
    fireEvent.click(screen.getByText("Änderungen speichern"));
    await waitFor(() => expect(hoisted.calls.applyChanges).toHaveBeenCalled());
    const changes = hoisted.calls.applyChanges.mock.calls[0][1];
    expect(changes.template).toMatchObject({ form_definition_id: "f1", values: { a: 1, versuchsnummer: "V-77" } });
  });

  it("begonnener Auftrag: Typ und Projekt gesperrt; Formularänderung verlangt Begründung", async () => {
    hoisted.state.facts = baseFacts({ started: true, type_locked: true, project_locked: true });
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    expect(screen.getAllByText(/Gesperrt: Am Auftrag wurde bereits gearbeitet/).length).toBe(2);
    fireEvent.click(screen.getByText("Versuchsnummer ändern"));
    expect(await screen.findByText(/Begründung erforderlich/)).toBeTruthy();
    fireEvent.click(screen.getByText("Änderungen speichern"));
    await Promise.resolve();
    expect(hoisted.calls.applyChanges).not.toHaveBeenCalled();
  });

  it("gesperrte Probe zeigt ein Schloss und lässt sich nicht entfernen", async () => {
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    expect(screen.getByLabelText("P1 gesperrt")).toBeTruthy();
    expect(screen.queryByLabelText("P1 entfernen")).toBeNull();
    expect(screen.getByLabelText("P2 entfernen")).toBeTruthy();
  });

  it("Auftragsart ist nie änderbar", async () => {
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    expect(screen.getByText(/Die Auftragsart kann nicht geändert werden/)).toBeTruthy();
  });

  it("nicht bearbeitbarer Auftrag (z. B. abgeschlossen): klare Meldung statt Maske", async () => {
    hoisted.state.facts = baseFacts({ can_edit: false, locked: true });
    mount();
    expect(await screen.findByText("Dieser Auftrag kann nicht bearbeitet werden.")).toBeTruthy();
    expect(screen.getByText(/abgeschlossen und schreibgeschützt/)).toBeTruthy();
    expect(screen.queryByText("Änderungen speichern")).toBeNull();
  });

  it("Erstellen (/auftraege/neu) bleibt unverändert: Entwurfs-Bedienung da, keine Bearbeiten-Elemente", async () => {
    mount("/auftraege/neu");
    expect(await screen.findByTestId("drafts-panel")).toBeTruthy();
    expect(screen.queryByText("Änderungen speichern")).toBeNull();
    expect(screen.queryByText("nur lesbar")).toBeNull();
    expect(screen.getByText("Batch-Planung")).toBeTruthy();
  });

  it("Dienstleistung entfernen: nur mit zweiter Dienstleistung, Begründung (mind. 5 Zeichen) Pflicht, Auftrag gesendet", async () => {
    hoisted.state.order = baseOrder({
      order_measurements: [
        { id: "m1", service_id: "svc1", sample_id: "s1", status: "open", measurement_number: "M1", measurement_services: { service_name: "RFA" }, samples: { sample_number: "P1" }, measurement_parameters: [] },
        { id: "m2", service_id: "svc2", sample_id: "s1", status: "open", measurement_number: "M2", measurement_services: { service_name: "BET" }, samples: { sample_number: "P1" }, measurement_parameters: [] },
      ],
    });
    hoisted.state.facts = baseFacts({
      measurements: [
        { measurement_id: "m1", untouched: true, blockers: [], status: "open", counts: {} },
        { measurement_id: "m2", untouched: true, blockers: [], status: "open", counts: {} },
      ],
    });
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    fireEvent.click(screen.getByLabelText("Dienstleistung BET entfernen"));
    expect(await screen.findByText("Dienstleistung(en) entfernt: BET (1 Aufgabe)")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/nicht rückgängig/);

    fireEvent.click(screen.getByText("Änderungen speichern"));
    expect(hoisted.calls.applyChanges).not.toHaveBeenCalled(); // ohne Begründung

    const reason = screen.getByLabelText(/Grund der Änderung/);
    fireEvent.change(reason, { target: { value: "kurz" } });
    fireEvent.click(screen.getByText("Änderungen speichern"));
    expect(hoisted.calls.applyChanges).not.toHaveBeenCalled(); // zu kurz

    fireEvent.change(reason, { target: { value: "Nicht mehr benötigt" } });
    fireEvent.click(screen.getByText("Änderungen speichern"));
    await waitFor(() => expect(hoisted.calls.applyChanges).toHaveBeenCalledTimes(1));
    const [id, changes, why] = hoisted.calls.applyChanges.mock.calls[0];
    expect(id).toBe("o1");
    expect(changes).toEqual({ expected_updated_at: "2026-11-18T10:00:00Z", services: { remove: ["svc2"] } });
    expect(why).toBe("Nicht mehr benötigt");
  });

  it("Letzte Dienstleistung entfernen wird vor dem Senden abgewiesen", async () => {
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    fireEvent.click(screen.getByLabelText("Dienstleistung RFA entfernen"));
    fireEvent.change(screen.getByLabelText(/Grund der Änderung/), { target: { value: "Nicht mehr benötigt" } });
    fireEvent.click(screen.getByText("Änderungen speichern"));
    await Promise.resolve();
    expect(hoisted.calls.applyChanges).not.toHaveBeenCalled();
  });

  it("Dienstleistung hinzufügen: Vorschau, Speichern legt je Probe eine Aufgabe an (Erstellen-Ablauf), ohne Begründung", async () => {
    hoisted.stable.services.data = [{ id: "svcN", service_name: "BET-Messung", category: "labor" }];
    mount();
    await screen.findByText("Auftrag MWI260003 bearbeiten");
    fireEvent.click(screen.getAllByRole("combobox").find((el) => /select_service/.test(el.textContent ?? ""))!);
    fireEvent.click(await screen.findByText("BET-Messung"));
    expect(await screen.findByText("Dienstleistung(en) hinzugefügt: BET-Messung (je Probe eine Aufgabe, 2 Proben)")).toBeTruthy();
    expect(screen.getByText(/für alle 2 Proben des Auftrags angelegt/)).toBeTruthy();

    fireEvent.click(screen.getByText("Änderungen speichern"));
    await waitFor(() => expect(hoisted.calls.navigate).toHaveBeenCalledWith("/auftraege/o1"));
    expect(hoisted.calls.applyChanges).not.toHaveBeenCalled(); // nur Dienstleistung: keine Kopfdaten-Änderung
    const addTask = (hoisted.calls as any).addTask;
    expect(addTask).toHaveBeenCalledTimes(2); // 2 Proben -> 2 Aufgaben
    expect(addTask.mock.calls.map((c: any[]) => c[0].sample_id).sort()).toEqual(["s1", "s2"]);
    expect(addTask.mock.calls.every((c: any[]) => c[0].order_id === "o1" && c[0].service_id === "svcN")).toBe(true);
    expect(hoisted.calls.create).not.toHaveBeenCalled();
    expect(hoisted.calls.logAdded).toHaveBeenCalledWith("o1", ["BET-Messung"], 2);
  });

});
