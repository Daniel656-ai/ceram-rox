import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import OrdersPage from "@/pages/OrdersPage";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resolveTaskSample } from "@/lib/samples/activeSampleContext";
import deOrders from "@/i18n/locales/de/orders.json";

const state = vi.hoisted(() => ({
  assigned: [] as Record<string, unknown>[],
  free: [] as Record<string, unknown>[],
  others: [] as Record<string, unknown>[],
  claimSpy: vi.fn(),
}));

vi.mock("@/hooks/useOrders", () => ({
  useOrders: () => ({ data: [], isLoading: false }),
  useOrderReleaseLabels: () => ({ data: new Map<string, string>() }),
  useDeleteOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOrderDeletePreview: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useCopyOrder: () => ({ mutateAsync: vi.fn() }),
  useUpdateOrderRanking: () => ({ mutateAsync: vi.fn() }),
  useUpdateOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useMeasurements", () => ({
  useMyMeasurements: () => ({ data: state.assigned, isLoading: false }),
  useUnassignedQualifiedMeasurements: () => ({ data: state.free, isLoading: false }),
  useOpenMeasurementsOverview: () => ({ data: state.others }),
  useClaimMeasurement: () => ({ mutateAsync: state.claimSpy }),
  useServices: () => ({ data: [{ id: "svc-rfa", service_name: "RFA" }, { id: "svc-bet", service_name: "BET" }] }),
  useMyQualifiedServiceIds: () => ({ data: ["svc-rfa", "svc-bet"] }),
  useQualifiedServiceIds: () => ({ data: ["svc-rfa", "svc-bet"] }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "tech-1" },
    role: "durchfuehrer",
    hasRole: (r: string) => r === "durchfuehrer",
    customRoleIds: [],
  }),
}));
vi.mock("@/hooks/useProjectMembers", () => ({ useIsAnyProjectLead: () => ({ data: false }) }));
vi.mock("@/hooks/useUsers", () => ({ useUsers: () => ({ data: [] }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const clean = key.replace(/^orders:/, "");
      const parts = clean.split(".");
      let cur: unknown = deOrders;
      for (const p of parts) {
        cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[p] : undefined;
      }
      return typeof cur === "string" ? cur : (fallback ?? key);
    },
    i18n: { language: "de" },
  }),
}));

function MockTaskExecutionRoute() {
  const { id } = useParams();
  const all = [...state.assigned, ...state.free];
  const m = all.find((x) => x.id === id);
  const resolved = resolveTaskSample(m);
  return (
    <div
      data-testid="task-execution-target"
      data-measurement-id={id}
      data-sample-status={resolved.status}
      data-sample-id={resolved.status === "resolved" ? resolved.id : ""}
      data-sample-number={resolved.status === "resolved" ? (resolved.sampleNumber ?? "") : ""}
    />
  );
}

function renderMyTasks() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/auftraege"]}>
        <Routes>
          <Route path="/auftraege" element={<OrdersPage />} />
          <Route path="/aufgaben/:id" element={<MockTaskExecutionRoute />} />
          <Route path="/proben/:id" element={<div data-testid="sample-detail-target" />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  state.claimSpy = vi.fn().mockResolvedValue(true);
  state.assigned = [
    {
      id: "m-1",
      order_id: "o-1",
      service_id: "svc-rfa",
      sample_id: "s-1",
      status: "open",
      assigned_to: "tech-1",
      measurement_number: "M260101",
      due_date: "2026-12-10",
      ranking: 1,
      workstations: { id: "ws-rfa", name: "RFA-Arbeitsplatz" },
      samples: {
        id: "s-1",
        sample_number: "P260101",
        sample_name: "Keramik Alpha",
        description: "Kunden-ID 2026-ABC-0085\nSpezialcharge Nord",
      },
      measurement_services: { service_name: "RFA" },
      measurement_orders: {
        id: "o-1",
        order_number: "SW260101",
        order_kind: "pilot_plant",
        pp_experiment_number: "TE-2026-77",
        projects: { project_number: "PR-777", project_name: "Entwicklung Keramik" },
      },
    },
    {
      id: "m-2",
      order_id: "o-2",
      service_id: "svc-bet",
      sample_id: null,
      status: "completed",
      assigned_to: "tech-1",
      measurement_number: "M260102",
      due_date: "2026-12-12",
      ranking: 2,
      workstations: { id: "ws-bet", name: "BET-Arbeitsplatz" },
      samples: null,
      measurement_services: { service_name: "BET" },
      measurement_orders: {
        id: "o-2",
        order_number: "SW260102",
        order_kind: "labor",
        projects: { project_number: "PR-888", project_name: "Standardprüfung" },
      },
    },
  ];
  state.free = [
    {
      id: "m-free-1",
      order_id: "o-3",
      service_id: "svc-bet",
      sample_id: "s-3",
      status: "open",
      assigned_to: null,
      measurement_number: "M260103",
      due_date: "2026-12-15",
      ranking: 2,
      workstations: { id: "ws-bet", name: "BET-Arbeitsplatz" },
      samples: {
        id: "s-3",
        sample_number: "P260103",
        sample_name: "Pulver Gamma",
        description: "Sonderprobe_A/B-12.3",
      },
      measurement_services: { service_name: "BET" },
      measurement_orders: {
        id: "o-3",
        order_number: "SW260103",
        order_kind: "labor",
        projects: { project_number: "PR-999", project_name: "Oberflächenanalyse" },
      },
    },
  ];
  state.others = [];
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("Meine Aufgaben (DurchfuehrerTasksView) – Suche, Beschreibung & Navigation", () => {
  it("zeigt den neuen Such-Platzhalter sowie Probenbeschreibung in beiden unteren Tabellen", () => {
    renderMyTasks();

    expect(
      screen.getByPlaceholderText("Suche nach Probe, Probenbeschreibung, Auftrag, Versuch oder Projekt …"),
    ).toBeInTheDocument();

    // Beide unteren Tabellen enthalten die Spalte „Probenbeschreibung“
    expect(screen.getAllByRole("columnheader", { name: "Probenbeschreibung" })).toHaveLength(2);

    // Zugewiesene Tabelle: Beschreibung sichtbar, Link zur Probe erhalten, Aufgabe ohne Probe zeigt "–"
    const assignedDesc = screen.getByTitle(/Kunden-ID 2026-ABC-0085/);
    expect(assignedDesc.getAttribute("title")).toBe("Kunden-ID 2026-ABC-0085\nSpezialcharge Nord");
    expect(screen.getByRole("link", { name: "Keramik Alpha" }).getAttribute("href")).toBe("/proben/s-1");
    expect(screen.getByRole("link", { name: "M260102" }).getAttribute("href")).toBe("/aufgaben/m-2");

    // Verfügbare Tabelle: Beschreibung sichtbar und "Auftrag übernehmen" bleibt erhalten
    expect(screen.getByTitle("Sonderprobe_A/B-12.3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Auftrag übernehmen/ })).toBeInTheDocument();
  });

  it("sucht in Probenbeschreibung (inkl. 2026-abc-0085, Copy-Paste-Leerzeichen, Sonderzeichen) und klappt Treffergruppen automatisch auf", () => {
    renderMyTasks();
    const searchInput = screen.getByPlaceholderText(
      "Suche nach Probe, Probenbeschreibung, Auftrag, Versuch oder Projekt …",
    );

    // Vor der Suche: Picker-Gruppen sind eingeklappt (kein „Bearbeiten“-Button sichtbar)
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).toBeNull();

    // Suche nach Kunden-ID mit Copy-Paste-Leerzeichen & Kleinschreibung
    fireEvent.change(searchInput, { target: { value: "  2026-abc-0085  " } });
    expect(screen.getByRole("button", { name: "Bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByText("M260103")).toBeNull();

    // Suche nach Sonderzeichen in der freien Aufgabe
    fireEvent.change(searchInput, { target: { value: "sonderprobe_a/b-12.3" } });
    expect(screen.getByRole("button", { name: "Übernehmen & bearbeiten" })).toBeInTheDocument();
    expect(screen.queryByText("M260101")).toBeNull();

    // Suche nach Versuchsnummer & Projektname funktioniert weiterhin
    fireEvent.change(searchInput, { target: { value: "te-2026-77" } });
    expect(screen.getByText("M260101")).toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: "oberflächenanalyse" } });
    expect(screen.getByText("M260103")).toBeInTheDocument();

    // Suche leeren stellt eingeklappten Zustand im Picker wieder her
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).toBeNull();
    expect(screen.getByText("M260101")).toBeInTheDocument();
    expect(screen.getByText("M260103")).toBeInTheDocument();
  });

  it("öffnet aus dem Messdurchlauf-Picker die richtige measurementId inkl. eindeutiger Probenauflösung über resolveTaskSample", () => {
    renderMyTasks();
    const searchInput = screen.getByPlaceholderText(
      "Suche nach Probe, Probenbeschreibung, Auftrag, Versuch oder Projekt …",
    );
    fireEvent.change(searchInput, { target: { value: "2026-abc-0085" } });

    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));

    const target = screen.getByTestId("task-execution-target");
    expect(target.getAttribute("data-measurement-id")).toBe("m-1");
    expect(target.getAttribute("data-sample-status")).toBe("resolved");
    expect(target.getAttribute("data-sample-id")).toBe("s-1");
    expect(target.getAttribute("data-sample-number")).toBe("P260101");
  });

  it("übernimmt freie Aufgabe über 'Übernehmen & bearbeiten' vor Navigation zur Aufgabenbearbeitung", async () => {
    renderMyTasks();
    const searchInput = screen.getByPlaceholderText(
      "Suche nach Probe, Probenbeschreibung, Auftrag, Versuch oder Projekt …",
    );
    fireEvent.change(searchInput, { target: { value: "Pulver Gamma" } });

    fireEvent.click(screen.getByRole("button", { name: "Übernehmen & bearbeiten" }));

    await waitFor(() => {
      expect(state.claimSpy).toHaveBeenCalledWith("m-free-1");
      const target = screen.getByTestId("task-execution-target");
      expect(target.getAttribute("data-measurement-id")).toBe("m-free-1");
      expect(target.getAttribute("data-sample-id")).toBe("s-3");
    });
  });
});