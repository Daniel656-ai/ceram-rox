import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import MeasurementRunPicker from "@/components/measurementRun/MeasurementRunPicker";
import deOrders from "@/i18n/locales/de/orders.json";

const toastSpies = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastSpies }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "tech-1" }, role: "durchfuehrer" }),
}));
vi.mock("@/hooks/useMeasurements", () => ({
  useQualifiedServiceIds: () => ({ data: ["svc-rfa"] }),
}));
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

function TaskTarget() {
  const { id } = useParams();
  const [params] = useSearchParams();
  return (
    <div data-testid="task-target" data-id={id} data-run={params.get("run") ?? ""}>
      Task {id}
    </div>
  );
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    service_id: "svc-rfa",
    sample_id: "s-1",
    status: "open",
    assigned_to: "tech-1",
    measurement_number: "M260001",
    due_date: "2026-12-01",
    ranking: 1,
    workstations: { id: "ws-1", name: "RFA-Labor" },
    samples: {
      id: "s-1",
      sample_number: "P260001",
      sample_name: "Katalysator Alpha",
      description: "Kunden-ID 2026-ABC-0085\nZweite Zeile für Detailprüfung",
    },
    measurement_services: { service_name: "RFA" },
    measurement_orders: {
      id: "o-1",
      order_number: "ABC260001",
      order_kind: "labor",
      projects: { project_number: "PR-100", project_name: "Projekt Nord" },
    },
    ...overrides,
  };
}

function renderPicker(props: React.ComponentProps<typeof MeasurementRunPicker>) {
  return render(
    <MemoryRouter initialEntries={["/auftraege"]}>
      <Routes>
        <Route path="/auftraege" element={<MeasurementRunPicker {...props} />} />
        <Route path="/aufgaben/:id" element={<TaskTarget />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  toastSpies.error.mockReset();
  toastSpies.warning.mockReset();
  toastSpies.success.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("MeasurementRunPicker – Tabelle, Beschreibung, direkte Navigation & Suche", () => {
  it("rendert alle Spalten inkl. Probenbeschreibung (mit title) ohne Aktionsbutton in einem <label>", () => {
    renderPicker({ tasks: [makeTask()] });
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));

    const table = screen.getByRole("table");
    for (const heading of [
      "Auswahl",
      "Probennummer",
      "Probenname",
      "Probenbeschreibung",
      "Auftrag / Versuch",
      "Projekt",
      "Priorität",
      "Fälligkeit",
      "Status",
      "Aktion",
    ]) {
      expect(within(table).getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }

    const descEl = within(table).getByTitle(/Kunden-ID 2026-ABC-0085/);
    expect(descEl).toBeInTheDocument();
    expect(descEl.getAttribute("title")).toBe("Kunden-ID 2026-ABC-0085\nZweite Zeile für Detailprüfung");
    expect(descEl.className).toContain("line-clamp-2");

    const editBtn = within(table).getByRole("button", { name: "Bearbeiten" });
    expect(editBtn.closest("label")).toBeNull();
    const checkbox = within(table).getByRole("checkbox", { name: /Probe P260001 auswählen/ });
    expect(checkbox.closest("label")).toBeNull();
  });

  it("navigiert bei eigener Aufgabe direkt zu /aufgaben/:measurementId und unterscheidet mehrere Proben derselben Dienstleistung", () => {
    const t1 = makeTask({
      id: "m-1",
      sample_id: "s-1",
      samples: { id: "s-1", sample_number: "P260001", sample_name: "Probe 1", description: "Beschreibung 1" },
    });
    const t2 = makeTask({
      id: "m-2",
      sample_id: "s-2",
      samples: { id: "s-2", sample_number: "P260002", sample_name: "Probe 2", description: "Beschreibung 2" },
    });
    renderPicker({ tasks: [t1, t2] });
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));

    const row2 = screen.getByText("P260002").closest("tr")!;
    expect(within(row2).getByText("Beschreibung 2")).toBeInTheDocument();
    fireEvent.click(within(row2).getByRole("button", { name: "Bearbeiten" }));

    const target = screen.getByTestId("task-target");
    expect(target.getAttribute("data-id")).toBe("m-2");
    expect(target.getAttribute("data-run")).toBe("");
  });

  it("übernimmt freie qualifizierte Aufgabe per claim() vor Navigation und navigiert danach zu /aufgaben/:id", async () => {
    const claim = vi.fn().mockResolvedValue(true);
    const freeTask = makeTask({ id: "m-free", assigned_to: null });
    renderPicker({ tasks: [], freeTasks: [freeTask], claim });
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));

    fireEvent.click(screen.getByRole("button", { name: "Übernehmen & bearbeiten" }));

    await waitFor(() => {
      expect(claim).toHaveBeenCalledWith("m-free");
      expect(screen.getByTestId("task-target").getAttribute("data-id")).toBe("m-free");
    });
  });

  it("verhindert Navigation bei fehlgeschlagener Übernahme (z. B. Race Condition) und zeigt Fehlermeldung", async () => {
    const claim = vi.fn().mockRejectedValue(new Error("Measurement already assigned"));
    const freeTask = makeTask({ id: "m-race", assigned_to: null });
    renderPicker({ tasks: [], freeTasks: [freeTask], claim });
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));

    fireEvent.click(screen.getByRole("button", { name: "Übernehmen & bearbeiten" }));

    await waitFor(() => {
      expect(claim).toHaveBeenCalledWith("m-race");
      expect(toastSpies.error).toHaveBeenCalledWith(
        "Bereits vergeben",
        expect.objectContaining({ description: expect.stringContaining("anderen Mitarbeiter") }),
      );
    });
    expect(screen.queryByTestId("task-target")).toBeNull();
  });

  it("bietet bei fremd zugewiesenen oder nicht qualifizierten Aufgaben keine aktive Bearbeitungsaktion", () => {
    const foreignTask = makeTask({
      id: "m-other",
      assigned_to: "tech-2",
      __assigneeName: "Max Mustermann",
    });
    const unqualifiedTask = makeTask({
      id: "m-unqual",
      assigned_to: null,
      service_id: "svc-other",
      samples: { id: "s-u", sample_number: "P260009", sample_name: "Unqual", description: "" },
    });
    renderPicker({ tasks: [], otherTasks: [foreignTask, unqualifiedTask] });
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));

    expect(screen.getByText("Zugewiesen: Max Mustermann")).toBeInTheDocument();
    expect(screen.getByText("Keine Qualifikation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bearbeiten" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Übernehmen & bearbeiten" })).toBeNull();
  });

  it("zeigt bei Aufgaben ohne Probe '–' für Nummer/Name/Beschreibung und erlaubt direkte Bearbeitung", () => {
    const noSampleTask = makeTask({ id: "m-nosample", sample_id: null, samples: null });
    renderPicker({ tasks: [noSampleTask] });
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));

    const row = screen.getByRole("button", { name: "Bearbeiten" }).closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    expect(cells[1].textContent).toBe("–"); // Probennummer
    expect(cells[2].textContent).toContain("–"); // Probenname
    expect(cells[3].textContent).toBe("–"); // Probenbeschreibung

    fireEvent.click(within(row).getByRole("button", { name: "Bearbeiten" }));
    expect(screen.getByTestId("task-target").getAttribute("data-id")).toBe("m-nosample");
  });

  it("zeigt abgeschlossene Aufgaben nicht im offenen Messdurchlauf-Picker an", () => {
    const completedTask = makeTask({ id: "m-done", status: "completed" });
    const { container } = renderPicker({ tasks: [completedTask] });
    expect(container.textContent).toBe("");
  });

  it("erhält Mehrfachauswahl und Start eines Messdurchlaufs (eigene + freie Aufgabe)", async () => {
    const claim = vi.fn().mockResolvedValue(true);
    const own = makeTask({ id: "m-own" });
    const free = makeTask({
      id: "m-free",
      assigned_to: null,
      sample_id: "s-2",
      samples: { id: "s-2", sample_number: "P260002", sample_name: "Probe 2", description: null },
    });
    renderPicker({ tasks: [own], freeTasks: [free], claim });
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));

    fireEvent.click(screen.getByRole("checkbox", { name: /Probe P260001 auswählen/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Probe P260002 auswählen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Messdurchlauf starten \(2 Proben ausgewählt\)/ }));

    await waitFor(() => {
      expect(claim).toHaveBeenCalledWith("m-free");
      const target = screen.getByTestId("task-target");
      expect(target.getAttribute("data-id")).toBe("m-own");
      expect(target.getAttribute("data-run")).toBe("m-own,m-free");
    });
  });

  it("klappt Gruppen bei aktiver Suche automatisch auf, erhält manuelles Zuklappen und stellt Ausgangszustand nach Löschen wieder her", () => {
    const task = makeTask({ id: "m-1" });
    const { rerender } = render(
      <MemoryRouter initialEntries={["/auftraege"]}>
        <MeasurementRunPicker tasks={[task]} searchQuery="" />
      </MemoryRouter>,
    );
    // Ohne Suche: eingeklappt
    expect(screen.queryByRole("table")).toBeNull();

    // Mit Suche: automatisch aufgeklappt
    rerender(
      <MemoryRouter initialEntries={["/auftraege"]}>
        <MeasurementRunPicker tasks={[task]} searchQuery="2026-abc-0085" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();

    // Manuelles Zuklappen während Suche funktioniert
    fireEvent.click(screen.getByRole("button", { name: /RFA-Labor/ }));
    expect(screen.queryByRole("table")).toBeNull();

    // Suche löschen: kehrt zum vorherigen (eingeklappten) Zustand zurück
    rerender(
      <MemoryRouter initialEntries={["/auftraege"]}>
        <MeasurementRunPicker tasks={[task]} searchQuery="" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});