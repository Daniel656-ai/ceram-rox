import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  counts: { data: { open: 40, in_progress: 74, completed: 2 } as any, isError: false },
  ordersEnabled: [] as boolean[],
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
  useRecentOrders: () => ({ data: [] }),
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

  it("zeigt keine GitHub-Kachel mehr", () => {
    renderPage();
    expect(screen.queryByText("GitHub-Status")).toBeNull();
  });
});
