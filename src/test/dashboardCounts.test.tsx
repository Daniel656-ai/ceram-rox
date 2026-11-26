import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  counts: { data: { open: 40, in_progress: 74, completed: 2 } as any, isError: false },
  ordersEnabled: [] as boolean[],
  recent: [] as any[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, d?: string) => (typeof d === "string" ? d : k.split(":").pop()) }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { first_name: "Test" }, role: "master" }),
}));
vi.mock("@/hooks/useOrders", () => ({
  useOrders: (o?: { enabled?: boolean }) => {
    state.ordersEnabled.push(o?.enabled ?? true);
    return { data: [] };
  },
  useOrderStatusCounts: () => ({ ...state.counts, refetch: vi.fn() }),
  useRecentOrders: () => ({ data: state.recent }),
}));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ data: new Array(24).fill({}), isError: false }) }));
vi.mock("@/hooks/useMeasurements", () => ({ useMyMeasurements: () => ({ data: [] }) }));
vi.mock("@/hooks/useSamples", () => ({ useSamples: () => ({ data: [] }) }));
vi.mock("@/components/ActivityFeed", () => ({ ActivityFeed: () => null }));
vi.mock("@/lib/api", () => ({ api: { measurements: { listForDashboardSearch: vi.fn() } } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));

import Dashboard from "@/pages/Dashboard";

const renderPage = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

afterEach(() => {
  cleanup();
  state.ordersEnabled.length = 0;
  state.recent = [];
  state.counts = { data: { open: 40, in_progress: 74, completed: 2 }, isError: false };
});

describe("Dashboard: Auftragszahlen", () => {
  it("zeigt die Zahlen aus der Zählung neben der Projektanzahl", () => {
    renderPage();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("74")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("zeigt bei Ladefehler Strich und Hinweis statt 0", () => {
    state.counts = { data: undefined, isError: true };
    renderPage();
    expect(screen.getByText(/konnten nicht geladen werden/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeTruthy();
    expect(screen.getAllByText("–").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("lädt die schwere Auftragsliste ohne Suche nicht", () => {
    renderPage();
    expect(state.ordersEnabled.every((e) => e === false)).toBe(true);
  });

  it("zeigt je Auftrag Nummer, Typ, Datum, Status und verlinkt den Auftrag; ohne Projekt kein Strich", () => {
    state.recent = [{ id: "o1", order_number: "PA-0001", order_type: "production", status: "open", created_at: "2026-11-05T10:00:00Z", projects: null }];
    renderPage();
    expect(screen.getByText("PA-0001")).toBeTruthy();
    expect(screen.getByText("production")).toBeTruthy();
    expect(screen.queryByText("–")).toBeNull();
    expect(screen.getByText("05.11.2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: /PA-0001/ }).getAttribute("href")).toBe("/auftraege/o1");
  });

  it("zeigt beim Laden weder Zahl noch Strich und verlinkt die Kacheln", () => {
    state.counts = { data: undefined, isError: false, isLoading: true } as any;
    const { container } = renderPage();
    expect(screen.queryByText("40")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
    expect(container.querySelectorAll('a[href="/auftraege"]').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('a[href="/projekte"]')).not.toBeNull();
  });

  it("zeigt bei leerer Auftragsliste einen kurzen Hinweis", () => {
    renderPage();
    expect(screen.getByText("Noch keine Aufträge vorhanden.")).toBeTruthy();
  });

  it("zeigt keine GitHub-Kachel mehr", () => {
    renderPage();
    expect(screen.queryByText("GitHub-Status")).toBeNull();
  });
});
